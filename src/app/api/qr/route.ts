import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { generateDiplomaHash } from "@/lib/crypto";
import { getRegistry } from "@/lib/registry";

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto") ||
    (host && host.includes("localhost") ? "http" : "https");

  if (host) {
    return `${protocol}://${host}`;
  }
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
}

/**
 * GET /api/qr
 * Returns all currently registered diplomas in memory
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const serial = searchParams.get("serial");

  try {
    const registry = getRegistry();

    if (serial) {
      const item = await registry.getBySerial(serial);
      if (!item) {
        return NextResponse.json({ success: false, error: "Diploma not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, diploma: item });
    }

    const items = await registry.list();
    return NextResponse.json({ success: true, count: items.length, diplomas: items });
  } catch (error: unknown) {
    console.error("[api/qr] registry read failed:", error);
    return NextResponse.json({ success: false, error: "Registry unavailable" }, { status: 503 });
  }
}

/**
 * POST /api/qr
 * Generates or regenerates deterministic SHA-256 hash & high-resolution QR code
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serialNumber, studentId, studentName, issueDate, major, university } = body;

    // Validation
    if (!serialNumber || !studentId || !studentName || !issueDate) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: serialNumber, studentId, studentName, issueDate",
        },
        { status: 400 }
      );
    }

    const payload = {
      serialNumber: String(serialNumber).trim(),
      studentId: String(studentId).trim(),
      studentName: String(studentName).trim(),
      issueDate: String(issueDate).trim(),
      major: major ? String(major).trim() : undefined,
      university: university ? String(university).trim() : "Universitas Indonesia",
    };

    // 1. Compute deterministic SHA-256 hash
    const hash = generateDiplomaHash(payload);

    // 2. Build verification URL
    const baseUrl = getBaseUrl(request);
    const verifyUrl = `${baseUrl}/verify?serial=${encodeURIComponent(payload.serialNumber)}&hash=${hash}`;

    // 3. Generate high-resolution QR code (Data URL Base64)
    // Error correction level H (30% redundancy) for robust real-world scanning
    const qrCodeUrl = await QRCode.toDataURL(verifyUrl, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: "H",
      color: {
        dark: "#0f172a", // slate-900 for sharp contrast
        light: "#ffffff",
      },
    });

    // 4. Append record to the registry (memory or Supabase ledger)
    const record = await getRegistry().issue({ ...payload, hash });

    return NextResponse.json({
      success: true,
      serialNumber: record.serialNumber,
      hash: record.hash,
      qrCodeUrl,
      verifyUrl,
      diploma: record,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
