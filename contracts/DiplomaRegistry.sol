// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title DiplomaRegistry
/// @notice Registri ijazah digital on-chain. HANYA menyimpan bukti integritas:
///         hash SHA-256 dokumen, kunci nomor seri (keccak256), tanda tangan KMS issuer,
///         timestamp, dan status pencabutan. Tidak ada PII yang disimpan di sini (REQ-02).
/// @dev    Setiap penerbitan/pencabutan membutuhkan persetujuan M-dari-N approver
///         (multi-signature, REQ-04). Payload penerbitan wajib ditandatangani oleh kunci
///         issuer yang dikelola HSM/KMS; tanda tangan diverifikasi on-chain.
///         Di produksi, DEFAULT_ADMIN_ROLE sebaiknya dipegang oleh dompet multisig (mis. Safe).
contract DiplomaRegistry is AccessControl {
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");
    uint64 public constant PROPOSAL_TTL = 7 days;

    enum Action {
        Issue,
        Revoke
    }

    enum Status {
        None,
        Valid,
        Revoked
    }

    struct Diploma {
        bytes32 docHash;
        uint64 issuedAt;
        uint64 revokedAt;
        bool revoked;
        bytes signature;
    }

    struct Proposal {
        Action action;
        bytes32 serialKey;
        bytes32 docHash;
        bytes signature;
        uint64 createdAt;
        uint8 approvals;
        bool executed;
    }

    address public kmsSigner;
    uint8 public threshold;
    uint8 public approverCount;
    uint256 public proposalCount;

    mapping(bytes32 serialKey => Diploma) private _diplomas;
    mapping(bytes32 docHash => bytes32 serialKey) public serialOfHash;
    mapping(uint256 proposalId => Proposal) private _proposals;
    mapping(uint256 proposalId => mapping(address approver => bool)) public hasApproved;

    event ProposalCreated(uint256 indexed proposalId, Action indexed action, bytes32 indexed serialKey, address proposer);
    event ProposalApproved(uint256 indexed proposalId, address indexed approver, uint8 approvals);
    event DiplomaIssued(bytes32 indexed serialKey, bytes32 indexed docHash, uint64 issuedAt, uint256 proposalId);
    event DiplomaRevoked(bytes32 indexed serialKey, uint64 revokedAt, uint256 proposalId);
    event KmsSignerUpdated(address indexed previousSigner, address indexed newSigner);
    event ThresholdUpdated(uint8 previousThreshold, uint8 newThreshold);

    error ZeroValue();
    error InvalidThreshold();
    error InvalidSignature();
    error AlreadyIssued();
    error HashAlreadyRegistered();
    error NotIssued();
    error AlreadyRevoked();
    error UnknownProposal();
    error ProposalAlreadyExecuted();
    error ProposalExpired();
    error AlreadyApproved();

    constructor(address admin, address[] memory approvers, uint8 threshold_, address kmsSigner_) {
        if (admin == address(0) || kmsSigner_ == address(0)) revert ZeroValue();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        for (uint256 i = 0; i < approvers.length; ++i) {
            if (approvers[i] == address(0)) revert ZeroValue();
            _grantRole(APPROVER_ROLE, approvers[i]);
        }
        if (threshold_ == 0 || threshold_ > approverCount) revert InvalidThreshold();
        threshold = threshold_;
        kmsSigner = kmsSigner_;
        emit KmsSignerUpdated(address(0), kmsSigner_);
        emit ThresholdUpdated(0, threshold_);
    }

    // ------------------------------------------------------------------
    // Multi-signature workflow
    // ------------------------------------------------------------------

    /// @notice Mengusulkan penerbitan ijazah. Pengusul otomatis dihitung sebagai 1 persetujuan.
    function proposeIssue(bytes32 serialKey, bytes32 docHash, bytes calldata signature)
        external
        onlyRole(APPROVER_ROLE)
        returns (uint256 proposalId)
    {
        _checkIssuable(serialKey, docHash, signature);
        proposalId = _createProposal(Action.Issue, serialKey, docHash, signature);
    }

    /// @notice Mengusulkan pencabutan ijazah yang sudah terbit.
    function proposeRevoke(bytes32 serialKey) external onlyRole(APPROVER_ROLE) returns (uint256 proposalId) {
        _checkRevocable(serialKey);
        proposalId = _createProposal(Action.Revoke, serialKey, bytes32(0), "");
    }

    /// @notice Menyetujui proposal; dieksekusi otomatis saat ambang batas tercapai.
    function approve(uint256 proposalId) external onlyRole(APPROVER_ROLE) {
        Proposal storage p = _proposals[proposalId];
        if (p.createdAt == 0) revert UnknownProposal();
        if (p.executed) revert ProposalAlreadyExecuted();
        if (block.timestamp > p.createdAt + PROPOSAL_TTL) revert ProposalExpired();
        if (hasApproved[proposalId][msg.sender]) revert AlreadyApproved();
        _recordApproval(proposalId, p);
    }

    function _createProposal(Action action, bytes32 serialKey, bytes32 docHash, bytes memory signature)
        private
        returns (uint256 proposalId)
    {
        proposalId = ++proposalCount;
        Proposal storage p = _proposals[proposalId];
        p.action = action;
        p.serialKey = serialKey;
        p.docHash = docHash;
        p.signature = signature;
        p.createdAt = uint64(block.timestamp);
        emit ProposalCreated(proposalId, action, serialKey, msg.sender);
        _recordApproval(proposalId, p);
    }

    function _recordApproval(uint256 proposalId, Proposal storage p) private {
        hasApproved[proposalId][msg.sender] = true;
        p.approvals += 1;
        emit ProposalApproved(proposalId, msg.sender, p.approvals);
        if (p.approvals >= threshold) _execute(proposalId, p);
    }

    function _execute(uint256 proposalId, Proposal storage p) private {
        p.executed = true;
        uint64 nowTs = uint64(block.timestamp);
        if (p.action == Action.Issue) {
            // Kondisi diperiksa ulang: state bisa berubah sejak proposal dibuat.
            _checkIssuable(p.serialKey, p.docHash, p.signature);
            _diplomas[p.serialKey] =
                Diploma({docHash: p.docHash, issuedAt: nowTs, revokedAt: 0, revoked: false, signature: p.signature});
            serialOfHash[p.docHash] = p.serialKey;
            emit DiplomaIssued(p.serialKey, p.docHash, nowTs, proposalId);
        } else {
            _checkRevocable(p.serialKey);
            Diploma storage d = _diplomas[p.serialKey];
            d.revoked = true;
            d.revokedAt = nowTs;
            emit DiplomaRevoked(p.serialKey, nowTs, proposalId);
        }
    }

    function _checkIssuable(bytes32 serialKey, bytes32 docHash, bytes memory signature) private view {
        if (serialKey == bytes32(0) || docHash == bytes32(0)) revert ZeroValue();
        if (_diplomas[serialKey].issuedAt != 0) revert AlreadyIssued();
        if (serialOfHash[docHash] != bytes32(0)) revert HashAlreadyRegistered();
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(issuanceDigest(serialKey, docHash));
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        if (err != ECDSA.RecoverError.NoError || recovered != kmsSigner) revert InvalidSignature();
    }

    function _checkRevocable(bytes32 serialKey) private view {
        Diploma storage d = _diplomas[serialKey];
        if (d.issuedAt == 0) revert NotIssued();
        if (d.revoked) revert AlreadyRevoked();
    }

    // ------------------------------------------------------------------
    // Read-only verification API (dipakai mesin verifikasi publik, REQ-05)
    // ------------------------------------------------------------------

    /// @notice Digest yang harus ditandatangani KMS issuer (terikat ke kontrak & chain ini).
    function issuanceDigest(bytes32 serialKey, bytes32 docHash) public view returns (bytes32) {
        return keccak256(abi.encode(address(this), block.chainid, serialKey, docHash));
    }

    function getBySerial(bytes32 serialKey) public view returns (Status status, Diploma memory diploma) {
        diploma = _diplomas[serialKey];
        if (diploma.issuedAt == 0) status = Status.None;
        else if (diploma.revoked) status = Status.Revoked;
        else status = Status.Valid;
    }

    function getByHash(bytes32 docHash)
        external
        view
        returns (Status status, bytes32 serialKey, Diploma memory diploma)
    {
        serialKey = serialOfHash[docHash];
        (status, diploma) = getBySerial(serialKey);
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return _proposals[proposalId];
    }

    // ------------------------------------------------------------------
    // Administrasi
    // ------------------------------------------------------------------

    function setKmsSigner(address newSigner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newSigner == address(0)) revert ZeroValue();
        emit KmsSignerUpdated(kmsSigner, newSigner);
        kmsSigner = newSigner;
    }

    function setThreshold(uint8 newThreshold) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newThreshold == 0 || newThreshold > approverCount) revert InvalidThreshold();
        emit ThresholdUpdated(threshold, newThreshold);
        threshold = newThreshold;
    }

    function _grantRole(bytes32 role, address account) internal override returns (bool granted) {
        granted = super._grantRole(role, account);
        if (granted && role == APPROVER_ROLE) approverCount += 1;
    }

    function _revokeRole(bytes32 role, address account) internal override returns (bool revoked) {
        revoked = super._revokeRole(role, account);
        if (revoked && role == APPROVER_ROLE) {
            approverCount -= 1;
            if (approverCount < threshold) revert InvalidThreshold();
        }
    }
}
