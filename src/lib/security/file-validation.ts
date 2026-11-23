import "server-only";
import { connect } from "node:net";
import { serverEnv } from "@/lib/env";

export class FileRejectedError extends Error {}

const PDF_MAGIC = Buffer.from("%PDF-");
// Fitur PDF aktif yang tidak dibutuhkan ijazah dan sering disalahgunakan untuk malware.
// (/AcroForm sengaja diizinkan karena dipakai oleh PDF bertanda tangan digital/PAdES.)
const DANGEROUS_PDF_TOKENS = ["/JavaScript", "/JS", "/Launch", "/EmbeddedFile", "/RichMedia", "/XFA"];

/** Validasi struktural: ukuran, magic bytes, penanda EOF, dan fitur aktif berbahaya. */
export function validatePdf(buf: Buffer): void {
  const { MAX_UPLOAD_BYTES } = serverEnv();
  if (buf.length === 0) throw new FileRejectedError("File kosong.");
  if (buf.length > MAX_UPLOAD_BYTES) throw new FileRejectedError("Ukuran file melebihi batas.");
  if (!buf.subarray(0, 1024).includes(PDF_MAGIC)) throw new FileRejectedError("File bukan PDF yang valid.");
  if (!buf.subarray(Math.max(0, buf.length - 1024)).includes(Buffer.from("%%EOF"))) {
    throw new FileRejectedError("Struktur PDF tidak lengkap.");
  }
  // Pemeriksaan biner (latin1) mencakup objek yang tidak terkompresi.
  const text = buf.toString("latin1");
  for (const token of DANGEROUS_PDF_TOKENS) {
    // Pastikan token berdiri sendiri (mis. "/JS" bukan bagian dari "/JSomething").
    const re = new RegExp(`${token.replace("/", "\\/")}(?![A-Za-z])`);
    if (re.test(text)) throw new FileRejectedError(`PDF mengandung fitur aktif yang tidak diizinkan (${token}).`);
  }
}

/**
 * Pemindaian malware via ClamAV (protokol clamd INSTREAM).
 * Produksi: CLAMAV_HOST wajib di-set (fail-closed). Pengembangan: dilewati dengan peringatan.
 */
export async function scanForMalware(buf: Buffer): Promise<void> {
  const env = serverEnv();
  if (!env.CLAMAV_HOST) {
    if (env.NODE_ENV === "production") throw new Error("CLAMAV_HOST wajib di-set di produksi.");
    console.warn("[malware-scan] CLAMAV_HOST tidak di-set — pemindaian dilewati (hanya untuk pengembangan).");
    return;
  }
  const verdict = await clamdInstream(env.CLAMAV_HOST, env.CLAMAV_PORT, buf);
  if (!/stream: OK/.test(verdict)) throw new FileRejectedError("File terdeteksi berbahaya oleh pemindai malware.");
}

function clamdInstream(host: string, port: number, data: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    const chunks: Buffer[] = [];
    socket.setTimeout(30_000, () => socket.destroy(new Error("Timeout pemindaian ClamAV")));
    socket.on("data", (c) => chunks.push(c));
    socket.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    socket.on("error", reject);
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      const CHUNK = 64 * 1024;
      for (let i = 0; i < data.length; i += CHUNK) {
        const part = data.subarray(i, i + CHUNK);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(part.length);
        socket.write(len);
        socket.write(part);
      }
      socket.end(Buffer.alloc(4)); // panjang 0 = akhir stream
    });
  });
}
