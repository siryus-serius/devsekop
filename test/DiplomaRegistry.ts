import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { keccak256, sha256, toBytes, zeroHash } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const STATUS = { None: 0, Valid: 1, Revoked: 2 } as const;

describe("DiplomaRegistry", () => {
  async function deployFixture() {
    const [admin, approverA, approverB, approverC, outsider] = await hre.viem.getWalletClients();
    const kms = privateKeyToAccount(generatePrivateKey());

    const registry = await hre.viem.deployContract("DiplomaRegistry", [
      admin!.account.address,
      [approverA!.account.address, approverB!.account.address, approverC!.account.address],
      2,
      kms.address,
    ]);

    const asA = await hre.viem.getContractAt("DiplomaRegistry", registry.address, { client: { wallet: approverA! } });
    const asB = await hre.viem.getContractAt("DiplomaRegistry", registry.address, { client: { wallet: approverB! } });
    const asOutsider = await hre.viem.getContractAt("DiplomaRegistry", registry.address, {
      client: { wallet: outsider! },
    });

    const serialKey = keccak256(toBytes("UNIV-2026-000001"));
    const docHash = sha256(toBytes("isi pdf ijazah"));
    const sign = async (s = serialKey, h = docHash, signer = kms) => {
      const digest = await registry.read.issuanceDigest([s, h]);
      return signer.signMessage({ message: { raw: digest } });
    };

    return { registry, asA, asB, asOutsider, kms, serialKey, docHash, sign };
  }

  it("menerbitkan ijazah hanya setelah ambang multi-sig tercapai", async () => {
    const { registry, asA, asB, serialKey, docHash, sign } = await loadFixture(deployFixture);
    await asA.write.proposeIssue([serialKey, docHash, await sign()]);

    let [status] = await registry.read.getBySerial([serialKey]);
    expect(status).to.equal(STATUS.None);

    await asB.write.approve([1n]);
    [status] = await registry.read.getBySerial([serialKey]);
    expect(status).to.equal(STATUS.Valid);

    const [byHashStatus, byHashSerial, diploma] = await registry.read.getByHash([docHash]);
    expect(byHashStatus).to.equal(STATUS.Valid);
    expect(byHashSerial).to.equal(serialKey);
    expect(diploma.docHash).to.equal(docHash);
  });

  it("menolak tanda tangan yang bukan dari kunci KMS issuer", async () => {
    const { asA, serialKey, docHash, sign } = await loadFixture(deployFixture);
    const rogue = privateKeyToAccount(generatePrivateKey());
    await expect(asA.write.proposeIssue([serialKey, docHash, await sign(serialKey, docHash, rogue)])).to.be.rejectedWith(
      "InvalidSignature",
    );
  });

  it("menolak tanda tangan yang diputar ulang untuk dokumen lain", async () => {
    const { asA, serialKey, sign } = await loadFixture(deployFixture);
    const otherHash = sha256(toBytes("dokumen palsu"));
    await expect(asA.write.proposeIssue([serialKey, otherHash, await sign()])).to.be.rejectedWith("InvalidSignature");
  });

  it("menolak pengusul yang bukan approver", async () => {
    const { asOutsider, serialKey, docHash, sign } = await loadFixture(deployFixture);
    await expect(asOutsider.write.proposeIssue([serialKey, docHash, await sign()])).to.be.rejectedWith(
      "AccessControlUnauthorizedAccount",
    );
  });

  it("mencegah approver yang sama menyetujui dua kali", async () => {
    const { asA, serialKey, docHash, sign } = await loadFixture(deployFixture);
    await asA.write.proposeIssue([serialKey, docHash, await sign()]);
    await expect(asA.write.approve([1n])).to.be.rejectedWith("AlreadyApproved");
  });

  it("menolak nomor seri atau hash yang sudah terdaftar", async () => {
    const { asA, asB, serialKey, docHash, sign } = await loadFixture(deployFixture);
    await asA.write.proposeIssue([serialKey, docHash, await sign()]);
    await asB.write.approve([1n]);

    await expect(asA.write.proposeIssue([serialKey, docHash, await sign()])).to.be.rejectedWith("AlreadyIssued");

    const otherSerial = keccak256(toBytes("UNIV-2026-000002"));
    await expect(asA.write.proposeIssue([otherSerial, docHash, await sign(otherSerial)])).to.be.rejectedWith(
      "HashAlreadyRegistered",
    );
  });

  it("mencabut ijazah melalui multi-sig", async () => {
    const { registry, asA, asB, serialKey, docHash, sign } = await loadFixture(deployFixture);
    await asA.write.proposeIssue([serialKey, docHash, await sign()]);
    await asB.write.approve([1n]);

    await asA.write.proposeRevoke([serialKey]);
    await asB.write.approve([2n]);

    const [status, , diploma] = await registry.read.getByHash([docHash]);
    expect(status).to.equal(STATUS.Revoked);
    expect(diploma.revoked).to.equal(true);
  });

  it("mengembalikan status None untuk hash yang tidak dikenal (dokumen dipalsukan)", async () => {
    const { registry } = await loadFixture(deployFixture);
    const [status, serial] = await registry.read.getByHash([sha256(toBytes("pdf yang diubah"))]);
    expect(status).to.equal(STATUS.None);
    expect(serial).to.equal(zeroHash);
  });

  it("menolak persetujuan untuk proposal kedaluwarsa", async () => {
    const { asA, asB, serialKey, docHash, sign } = await loadFixture(deployFixture);
    await asA.write.proposeIssue([serialKey, docHash, await sign()]);
    const testClient = await hre.viem.getTestClient();
    await testClient.increaseTime({ seconds: 8 * 24 * 60 * 60 });
    await testClient.mine({ blocks: 1 });
    await expect(asB.write.approve([1n])).to.be.rejectedWith("ProposalExpired");
  });

  it("tidak mengizinkan threshold lebih besar dari jumlah approver", async () => {
    const { registry } = await loadFixture(deployFixture);
    await expect(registry.write.setThreshold([4])).to.be.rejectedWith("InvalidThreshold");
  });
});
