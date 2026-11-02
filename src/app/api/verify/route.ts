import { NextRequest, NextResponse } from "next/server";
import { generateDiplomaHash } from "@/lib/crypto";
import { getDiplomaBySerial } from "@/lib/store";

export type VerificationStatus = "valid" | "invalid" | "not_found";

export interface VerifyApiResponse {
  success: boolean;
  status: VerificationStatus;
  message: string;
  serialNumber?: string;
  inputHash?: string;
  storedHash?: string;
  isIntegrityIntact?: boolean;
  diploma?: {
    serialNumber: string;
    studentId: string;
    studentName: string;
    issueDate: string;
    major?: string;
    university?: string;
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * GET /api/verify?serial=...&hash=...
 * Performs cryptographic integrity verification of diploma records.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const serial = searchParams.get("serial")?.trim();
  const inputHash = searchParams.get("hash")?.trim();

  if (!serial) {
    return NextResponse.json(
      {
        success: false,
        status: "invalid",
        message: "The 'serial' query parameter is required.",
      },
      { status: 400 }
    );
  }

  // 1. Look up diploma by serial number
  const record = getDiplomaBySerial(serial);

  if (!record) {
    return NextResponse.json(
      {
        success: false,
        status: "not_found",
        message: `Diploma serial number "${serial}" was not found in the official registry.`,
        serialNumber: serial,
        inputHash: inputHash ?? undefined,
      },
      { status: 404 }
    );
  }

  // 2. Compute canonical hash directly from stored data to ensure ground-truth integrity
  const canonicalHash = generateDiplomaHash(record);

  // If no hash was provided by caller, return record with status info
  if (!inputHash) {
    return NextResponse.json({
      success: true,
      status: "valid",
      message: "Diploma record located. However, no hash fingerprint was provided for cryptographic cross-verification.",
      serialNumber: record.serialNumber,
      storedHash: canonicalHash,
      isIntegrityIntact: true,
      diploma: {
        serialNumber: record.serialNumber,
        studentId: record.studentId,
        studentName: record.studentName,
        issueDate: record.issueDate,
        major: record.major,
        university: record.university,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    });
  }

  // 3. Cryptographic hash comparison
  const isMatch = canonicalHash.toLowerCase() === inputHash.toLowerCase();

  if (!isMatch) {
    return NextResponse.json(
      {
        success: false,
        status: "invalid",
        message: "HASH MISMATCH / TAMPERING DETECTED. The provided SHA-256 fingerprint does not match the official registry record.",
        serialNumber: record.serialNumber,
        inputHash,
        storedHash: canonicalHash,
        isIntegrityIntact: false,
        diploma: {
          serialNumber: record.serialNumber,
          studentId: record.studentId,
          studentName: record.studentName,
          issueDate: record.issueDate,
          major: record.major,
          university: record.university,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        },
      },
      { status: 200 }
    );
  }

  // 4. Verification Successful
  return NextResponse.json({
    success: true,
    status: "valid",
    message: "CREDENTIAL AUTHENTIC & VERIFIED. Document integrity is 100% bit-by-bit identical with the official issuer record.",
    serialNumber: record.serialNumber,
    inputHash,
    storedHash: canonicalHash,
    isIntegrityIntact: true,
    diploma: {
      serialNumber: record.serialNumber,
      studentId: record.studentId,
      studentName: record.studentName,
      issueDate: record.issueDate,
      major: record.major,
      university: record.university,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
  });
}
