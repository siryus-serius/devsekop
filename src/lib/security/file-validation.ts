import "server-only";
import { serverEnv } from "@/lib/env";

export class FileRejectedError extends Error {}

const PDF_MAGIC = Buffer.from("%PDF-");
// Fitur PDF aktif yang tidak dibutuhkan ijazah dan sering disalahgunakan untuk malware.
const DANGEROUS_PDF_TOKENS = ["/JavaScript", "/JS", "/Launch", "/EmbeddedFile", "/RichMedia", "/XFA"];

/** Validasi unggahan: ukuran, magic bytes PDF, penanda akhir file, dan fitur aktif berbahaya. */
export function validatePdf(buf: Buffer): void {
  const { MAX_UPLOAD_BYTES } = serverEnv();
  if (buf.length === 0) throw new FileRejectedError("File kosong.");
  if (buf.length > MAX_UPLOAD_BYTES) throw new FileRejectedError("Ukuran file melebihi batas.");
  if (!buf.subarray(0, 1024).includes(PDF_MAGIC)) throw new FileRejectedError("File bukan PDF yang valid.");
  if (!buf.subarray(Math.max(0, buf.length - 1024)).includes(Buffer.from("%%EOF"))) {
    throw new FileRejectedError("Struktur PDF tidak lengkap.");
  }
  const text = buf.toString("latin1");
  for (const token of DANGEROUS_PDF_TOKENS) {
    // Token harus berdiri sendiri (mis. "/JS" bukan bagian dari "/JSomething").
    const re = new RegExp(`${token.replace("/", "\\/")}(?![A-Za-z])`);
    if (re.test(text)) throw new FileRejectedError(`PDF mengandung fitur aktif yang tidak diizinkan (${token}).`);
  }
}
