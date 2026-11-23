import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { keccak256, sha256, toBytes, zeroHash } from "viem";

const STATUS = { NotFound: 0, Valid: 1, Revoked: 2 } as const;

describe("DiplomaRegistry", () => {
  async function deployFixture() {
    const [admin, issuer, outsider] = await hre.viem.getWalletClients();
    const registry = await hre.viem.deployContract("DiplomaRegistry", [
      admin!.account.address,
      issuer!.account.address,
    ]);
    const as = (wallet: typeof admin) =>
      hre.viem.getContractAt("DiplomaRegistry", registry.address, { client: { wallet: wallet! } });

    return {
      registry,
      asAdmin: await as(admin),
      asIssuer: await as(issuer),
      asOutsider: await as(outsider),
      issuer: issuer!.account.address,
      serialKey: keccak256(toBytes("UNIV-2026-000001")),
      docHash: sha256(toBytes("isi pdf ijazah")),
    };
  }

  describe("Penerbitan", () => {
    it("issuer dapat menerbitkan dan ijazah bisa dicek lewat serial maupun hash", async () => {
      const { registry, asIssuer, serialKey, docHash } = await loadFixture(deployFixture);
      await asIssuer.write.issue([serialKey, docHash]);

      const [status, diploma] = await registry.read.getBySerial([serialKey]);
      expect(status).to.equal(STATUS.Valid);
      expect(diploma.docHash).to.equal(docHash);

      const [byHashStatus, byHashSerial] = await registry.read.getByHash([docHash]);
      expect(byHashStatus).to.equal(STATUS.Valid);
      expect(byHashSerial).to.equal(serialKey);
    });

    it("memancarkan event DiplomaIssued", async () => {
      const { registry, asIssuer, serialKey, docHash } = await loadFixture(deployFixture);
      await asIssuer.write.issue([serialKey, docHash]);
      const events = await registry.getEvents.DiplomaIssued();
      expect(events).to.have.lengthOf(1);
      expect(events[0]!.args.serialKey).to.equal(serialKey);
    });

    it("menolak akun yang bukan issuer", async () => {
      const { asOutsider, serialKey, docHash } = await loadFixture(deployFixture);
      await expect(asOutsider.write.issue([serialKey, docHash])).to.be.rejectedWith(
        "AccessControlUnauthorizedAccount",
      );
    });

    it("menolak nilai kosong", async () => {
      const { asIssuer, serialKey, docHash } = await loadFixture(deployFixture);
      await expect(asIssuer.write.issue([zeroHash, docHash])).to.be.rejectedWith("ZeroValue");
      await expect(asIssuer.write.issue([serialKey, zeroHash])).to.be.rejectedWith("ZeroValue");
    });

    it("menolak nomor seri ganda", async () => {
      const { asIssuer, serialKey, docHash } = await loadFixture(deployFixture);
      await asIssuer.write.issue([serialKey, docHash]);
      const otherHash = sha256(toBytes("pdf lain"));
      await expect(asIssuer.write.issue([serialKey, otherHash])).to.be.rejectedWith("AlreadyIssued");
    });

    it("menolak file PDF yang sama didaftarkan dua kali", async () => {
      const { asIssuer, serialKey, docHash } = await loadFixture(deployFixture);
      await asIssuer.write.issue([serialKey, docHash]);
      const otherSerial = keccak256(toBytes("UNIV-2026-000002"));
      await expect(asIssuer.write.issue([otherSerial, docHash])).to.be.rejectedWith("HashAlreadyRegistered");
    });
  });

  describe("Verifikasi", () => {
    it("PDF yang diubah menghasilkan status NotFound", async () => {
      const { registry, asIssuer, serialKey, docHash } = await loadFixture(deployFixture);
      await asIssuer.write.issue([serialKey, docHash]);
      const [status, serial] = await registry.read.getByHash([sha256(toBytes("isi pdf ijazah (diedit)"))]);
      expect(status).to.equal(STATUS.NotFound);
      expect(serial).to.equal(zeroHash);
    });
  });

  describe("Pencabutan", () => {
    it("issuer dapat mencabut, dan catatan terbit tetap tersimpan", async () => {
      const { registry, asIssuer, serialKey, docHash } = await loadFixture(deployFixture);
      await asIssuer.write.issue([serialKey, docHash]);
      await asIssuer.write.revoke([serialKey]);

      const [status, , diploma] = await registry.read.getByHash([docHash]);
      expect(status).to.equal(STATUS.Revoked);
      expect(diploma.issuedAt > 0n).to.equal(true);
      expect(diploma.revokedAt > 0n).to.equal(true);
    });

    it("menolak mencabut ijazah yang belum terbit", async () => {
      const { asIssuer, serialKey } = await loadFixture(deployFixture);
      await expect(asIssuer.write.revoke([serialKey])).to.be.rejectedWith("NotIssued");
    });

    it("menolak mencabut dua kali", async () => {
      const { asIssuer, serialKey, docHash } = await loadFixture(deployFixture);
      await asIssuer.write.issue([serialKey, docHash]);
      await asIssuer.write.revoke([serialKey]);
      await expect(asIssuer.write.revoke([serialKey])).to.be.rejectedWith("AlreadyRevoked");
    });

    it("menolak akun yang bukan issuer", async () => {
      const { asIssuer, asOutsider, serialKey, docHash } = await loadFixture(deployFixture);
      await asIssuer.write.issue([serialKey, docHash]);
      await expect(asOutsider.write.revoke([serialKey])).to.be.rejectedWith("AccessControlUnauthorizedAccount");
    });
  });

  describe("Respon insiden", () => {
    it("admin dapat mencabut peran issuer sehingga kunci yang bocor tidak bisa dipakai", async () => {
      const { registry, asAdmin, asIssuer, issuer, serialKey, docHash } = await loadFixture(deployFixture);
      await asAdmin.write.revokeRole([await registry.read.ISSUER_ROLE(), issuer]);
      await expect(asIssuer.write.issue([serialKey, docHash])).to.be.rejectedWith(
        "AccessControlUnauthorizedAccount",
      );
    });

    it("issuer tidak bisa memberi peran ke akun lain", async () => {
      const { registry, asIssuer, asOutsider } = await loadFixture(deployFixture);
      const outsider = asOutsider.address;
      await expect(asIssuer.write.grantRole([await registry.read.ISSUER_ROLE(), outsider])).to.be.rejectedWith(
        "AccessControlUnauthorizedAccount",
      );
    });
  });
});
