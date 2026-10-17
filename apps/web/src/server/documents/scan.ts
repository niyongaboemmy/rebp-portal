import { inflateSync } from "node:zlib";
import type { MimeType } from "@rebp/contracts";

/**
 * Upload inspection (FR-DOC-001…004, SEC-008): magic-byte sniffing, extension match, PDF
 * active-content and encryption checks, image dimensions, and malware scanning. The pilot's
 * scanner detects the EICAR test signature; a ClamAV adapter plugs into `MalwareScanner`
 * (Plan WP-1.9) without changing callers.
 */
export function sniffMime(data: Buffer): MimeType | null {
  if (data.length >= 5 && data.subarray(0, 5).toString("latin1") === "%PDF-")
    return "application/pdf";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff)
    return "image/jpeg";
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "image/png";
  return null;
}

const EXTENSIONS: Record<MimeType, readonly string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
};

export function extensionMatches(fileName: string, mime: MimeType): boolean {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return EXTENSIONS[mime].includes(ext);
}

/** PDF features that can execute or hide content (FR-DOC-003). */
const PDF_ACTIVE = [
  /\/JavaScript\b/,
  /\/JS\b/,
  /\/Launch\b/,
  /\/EmbeddedFile\b/,
  /\/RichMedia\b/,
  /\/XFA\b/,
  /\/AA\b/,
  /\/SubmitForm\b/,
  /\/ImportData\b/,
];

export type PdfVerdict = "ok" | "activeContent" | "encrypted";

/** Undo PDF name escapes (/J#61vaScript → /JavaScript) so obfuscated names are still caught. */
function normaliseNames(text: string): string {
  return text.replace(/\/[^\s/<>[\]()]*#[0-9a-fA-F]{2}[^\s/<>[\]()]*/g, (name) =>
    name.replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))),
  );
}

/** Text of the file plus its decompressed streams (object streams can hide actions). */
function inspectableText(data: Buffer): string {
  const raw = data.toString("latin1");
  const parts = [raw];
  let total = 0;
  const pattern = /stream\r?\n/g;
  let match: RegExpExecArray | null;
  let count = 0;
  while ((match = pattern.exec(raw)) && count < 500 && total < 20 * 1024 * 1024) {
    count++;
    const begin = match.index + match[0].length;
    const finish = raw.indexOf("endstream", begin);
    if (finish < 0) break;
    try {
      const inflated = inflateSync(data.subarray(begin, finish), {
        maxOutputLength: 5 * 1024 * 1024,
      });
      total += inflated.length;
      parts.push(inflated.toString("latin1"));
    } catch {
      /* not a Flate stream (images, fonts): nothing to inspect */
    }
    pattern.lastIndex = finish;
  }
  return normaliseNames(parts.join("\n"));
}

export function inspectPdf(data: Buffer): PdfVerdict {
  const text = inspectableText(data);
  if (/\/Encrypt\b/.test(text)) return "encrypted";
  if (PDF_ACTIVE.some((pattern) => pattern.test(text))) return "activeContent";
  // An OpenAction is only allowed to be a plain page destination, never an action dictionary.
  if (/\/OpenAction\s*<</.test(text)) return "activeContent";
  return "ok";
}

/** Width × height from PNG IHDR or JPEG SOFn, without decoding the image. */
export function imageSize(data: Buffer, mime: MimeType): { width: number; height: number } | null {
  if (mime === "image/png" && data.length >= 24) {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  if (mime === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) return null;
      const marker = data[offset + 1]!;
      const length = data.readUInt16BE(offset + 2);
      // SOF0–SOF15 except DHT (C4), JPG (C8) and DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

export interface ScanResult {
  clean: boolean;
  signature?: string;
}

export interface MalwareScanner {
  name: string;
  scan(data: Buffer): Promise<ScanResult>;
}

const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

/** Signature scanner for the pilot; detects the EICAR test file anywhere in the upload. */
export const signatureScanner: MalwareScanner = {
  name: "signature",
  async scan(data) {
    return data.toString("latin1").includes(EICAR)
      ? { clean: false, signature: "EICAR-Test-File" }
      : { clean: true };
  },
};

export const malwareScanner: MalwareScanner = signatureScanner;
