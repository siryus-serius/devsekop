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
        message: "Parameter 'serial' wajib disertakan.",
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
        message: `Nomor seri ijazah "${serial}" tidak ditemukan dalam repositori resmi.`,
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
      message: "Data ijazah ditemukan. Namun sidik jari hash tidak disertakan untuk verifikasi silang.",
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
        message: "DATA TIDAK COCOK / TELAH DIMODIFIKASI. Sidik jari hash tidak sesuai dengan catatan resmi.",
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
    message: "IJAZAH ASLI & TERVERIFIKASI. Integritas data terjamin dan identik dengan data penerbit.",
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
