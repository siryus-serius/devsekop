// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title DiplomaRegistry
/// @notice Buku catatan ijazah on-chain. Yang disimpan HANYA bukti integritas:
///         hash SHA-256 file PDF, kunci nomor seri (keccak256), waktu terbit, dan waktu cabut.
///         Tidak ada data pribadi (nama, NIK, IPK) yang disimpan di sini.
/// @dev    Dua peran:
///         - DEFAULT_ADMIN_ROLE : memberi/mencabut peran (dompet admin kampus).
///         - ISSUER_ROLE        : menerbitkan dan mencabut ijazah (dompet server / relayer).
///         Bila kunci relayer bocor, admin cukup mencabut ISSUER_ROLE-nya (tombol darurat).
contract DiplomaRegistry is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    enum Status {
        NotFound,
        Valid,
        Revoked
    }

    struct Diploma {
        bytes32 docHash; // SHA-256 dari file PDF final
        uint64 issuedAt; // 0 = belum pernah diterbitkan
        uint64 revokedAt; // 0 = belum dicabut
    }

    /// @dev serialKey = keccak256(nomor seri). Nomor seri mentah tetap off-chain.
    mapping(bytes32 serialKey => Diploma) private _diplomas;
    mapping(bytes32 docHash => bytes32 serialKey) private _serialOfHash;

    event DiplomaIssued(bytes32 indexed serialKey, bytes32 indexed docHash, address indexed issuer);
    event DiplomaRevoked(bytes32 indexed serialKey, address indexed revoker);

    error ZeroValue();
    error AlreadyIssued();
    error HashAlreadyRegistered();
    error NotIssued();
    error AlreadyRevoked();

    constructor(address admin, address issuer) {
        if (admin == address(0) || issuer == address(0)) revert ZeroValue();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, issuer);
    }

    /// @notice Mencatat ijazah baru.
    function issue(bytes32 serialKey, bytes32 docHash) external onlyRole(ISSUER_ROLE) {
        if (serialKey == bytes32(0) || docHash == bytes32(0)) revert ZeroValue();
        if (_diplomas[serialKey].issuedAt != 0) revert AlreadyIssued();
        if (_serialOfHash[docHash] != bytes32(0)) revert HashAlreadyRegistered();

        _diplomas[serialKey] = Diploma({docHash: docHash, issuedAt: uint64(block.timestamp), revokedAt: 0});
        _serialOfHash[docHash] = serialKey;
        emit DiplomaIssued(serialKey, docHash, msg.sender);
    }

    /// @notice Mencabut ijazah. Catatan penerbitan tetap ada sebagai jejak audit.
    function revoke(bytes32 serialKey) external onlyRole(ISSUER_ROLE) {
        Diploma storage d = _diplomas[serialKey];
        if (d.issuedAt == 0) revert NotIssued();
        if (d.revokedAt != 0) revert AlreadyRevoked();

        d.revokedAt = uint64(block.timestamp);
        emit DiplomaRevoked(serialKey, msg.sender);
    }

    /// @notice Cek ijazah lewat nomor seri (alur scan QR). Gratis, tanpa gas.
    function getBySerial(bytes32 serialKey) public view returns (Status status, Diploma memory diploma) {
        diploma = _diplomas[serialKey];
        if (diploma.issuedAt == 0) status = Status.NotFound;
        else if (diploma.revokedAt != 0) status = Status.Revoked;
        else status = Status.Valid;
    }

    /// @notice Cek ijazah lewat hash file PDF (alur unggah PDF). Gratis, tanpa gas.
    function getByHash(bytes32 docHash)
        external
        view
        returns (Status status, bytes32 serialKey, Diploma memory diploma)
    {
        serialKey = _serialOfHash[docHash];
        (status, diploma) = getBySerial(serialKey);
    }
}
