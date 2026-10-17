import "server-only";
import { createHmac } from "node:crypto";
import QRCode from "qrcode";
import {
  PDFDocument,
  PDFName,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { env } from "../env";
import { canonicalJson } from "../audit/audit";

/**
 * PDF documents (FR-N-002 certificate, FR-PAY-007 receipt, FR-WIZ-014 acknowledgment, FR-M-015
 * decision letter, FR-L-011 watermarked downloads). Generated with pdf-lib in-process. The pilot
 * seal is a server HMAC over the certificate payload (Plan E13: self-signed; PAdES with an
 * accredited CA in R2); the public verification page shows the same seal to detect tampering.
 */
const BRAND = rgb(0.08, 0.12, 0.43);
const PRIMARY = rgb(0.18, 0.31, 0.88);
const SUN = rgb(0.95, 0.83, 0.29);
const INK = rgb(0.07, 0.08, 0.1);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.88, 0.89, 0.92);

const A4: [number, number] = [595.28, 841.89];

/** Standard fonts are WinAnsi: replace anything outside it so generation never throws. */
export function pdfText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

async function newDocument(title: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator("REBP Portal");
  pdf.setProducer("REBP Portal (pilot)");
  pdf.setCreationDate(new Date());
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  return { pdf, fonts };
}

function header(page: PDFPage, fonts: Fonts, title: string, subtitle: string) {
  const { width: w, height: h } = page.getSize();
  page.drawRectangle({ x: 0, y: h - 96, width: w, height: 96, color: BRAND });
  page.drawRectangle({ x: 0, y: h - 100, width: w, height: 4, color: SUN });
  page.drawText("REBP", { x: 40, y: h - 46, size: 22, font: fonts.bold, color: rgb(1, 1, 1) });
  page.drawText(pdfText("Real Estate Brokerage Practitioners - Professional Body"), {
    x: 40,
    y: h - 64,
    size: 9,
    font: fonts.regular,
    color: rgb(0.85, 0.88, 1),
  });
  page.drawText(pdfText(title), { x: 40, y: h - 140, size: 20, font: fonts.bold, color: INK });
  page.drawText(pdfText(subtitle), {
    x: 40,
    y: h - 158,
    size: 10,
    font: fonts.regular,
    color: MUTED,
  });
}

function footer(page: PDFPage, fonts: Fonts, text: string) {
  const { width } = page.getSize();
  page.drawLine({
    start: { x: 40, y: 56 },
    end: { x: width - 40, y: 56 },
    thickness: 0.6,
    color: LINE,
  });
  page.drawText(pdfText(text), {
    x: 40,
    y: 40,
    size: 7.5,
    font: fonts.regular,
    color: MUTED,
    maxWidth: width - 80,
  });
  page.drawText(pdfText("PILOT - synthetic data only. Not valid for practice until go-live."), {
    x: 40,
    y: 28,
    size: 7.5,
    font: fonts.bold,
    color: rgb(0.7, 0.35, 0.1),
  });
}

/** Label/value rows; returns the next y. */
function rows(
  page: PDFPage,
  fonts: Fonts,
  entries: Array<[string, string]>,
  x: number,
  y: number,
  width: number,
) {
  let cursor = y;
  for (const [label, value] of entries) {
    page.drawText(pdfText(label).toUpperCase(), {
      x,
      y: cursor,
      size: 7,
      font: fonts.bold,
      color: MUTED,
    });
    const lines = wrap(pdfText(value) || "-", fonts.regular, 10.5, width);
    lines.forEach((line, i) =>
      page.drawText(line, {
        x,
        y: cursor - 13 - i * 13,
        size: 10.5,
        font: fonts.regular,
        color: INK,
      }),
    );
    cursor -= 22 + lines.length * 13;
  }
  return cursor;
}

export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

async function qrPng(url: string) {
  return QRCode.toBuffer(url, { type: "png", margin: 1, width: 360, errorCorrectionLevel: "M" });
}

/** Pilot seal: HMAC-SHA256 over the canonical payload (tamper evidence). */
export function sealOf(payload: Record<string, unknown>): string {
  return createHmac("sha256", `${env().AUTH_SECRET}:certificate-seal`)
    .update(canonicalJson(payload))
    .digest("hex")
    .slice(0, 24)
    .toUpperCase()
    .replace(/(.{4})(?!$)/g, "$1-");
}

// ---------------------------------------------------------------------------
// Certificate (FR-N-002)
// ---------------------------------------------------------------------------

export interface CertificateData {
  holder: string;
  registrationNo: string;
  licenceNo: string;
  categoryName: string;
  status: string;
  scope: string;
  arrangement: string;
  firm: string | null;
  supervisor: string | null;
  issuedOn: string;
  expiresOn: string;
  conditions: string[];
  verifyUrl: string;
  certificateVersion: number;
  photo?: { bytes: Buffer; mimeType: string } | null;
  seal: string;
}

export async function certificatePdf(data: CertificateData): Promise<Uint8Array> {
  const { pdf, fonts } = await newDocument(`Licence ${data.licenceNo}`);
  const page = pdf.addPage(A4);
  const { width } = page.getSize();
  header(
    page,
    fonts,
    "Professional Licence Certificate",
    `Certificate version ${data.certificateVersion} - issued electronically`,
  );

  // Photo (FR-B-014: used on the certificate).
  const photoX = width - 40 - 120;
  const topY = 841.89 - 190;
  if (data.photo) {
    const image =
      data.photo.mimeType === "image/png"
        ? await pdf.embedPng(data.photo.bytes)
        : await pdf.embedJpg(data.photo.bytes);
    page.drawImage(image, { x: photoX, y: topY - 150, width: 120, height: 150 });
  } else {
    page.drawRectangle({
      x: photoX,
      y: topY - 150,
      width: 120,
      height: 150,
      borderColor: LINE,
      borderWidth: 1,
    });
  }

  page.drawText(pdfText(data.holder), {
    x: 40,
    y: topY - 10,
    size: 22,
    font: fonts.bold,
    color: BRAND,
    maxWidth: width - 220,
  });
  page.drawText(pdfText(data.categoryName), {
    x: 40,
    y: topY - 32,
    size: 13,
    font: fonts.regular,
    color: PRIMARY,
  });

  let y = rows(
    page,
    fonts,
    [
      ["Registration number", data.registrationNo],
      ["Licence number", data.licenceNo],
      ["Status", data.status],
      ["Valid", `${data.issuedOn} to ${data.expiresOn}`],
    ],
    40,
    topY - 70,
    width - 240,
  );
  y = rows(
    page,
    fonts,
    [
      ["Authorised scope", data.scope],
      ["Practice arrangement", data.arrangement],
      ...(data.firm ? ([["Brokerage firm", data.firm]] as Array<[string, string]>) : []),
      ...(data.supervisor
        ? ([["Supervising practitioner", data.supervisor]] as Array<[string, string]>)
        : []),
      ["Conditions", data.conditions.length ? data.conditions.join("; ") : "None"],
    ],
    40,
    Math.min(y, topY - 180),
    width - 80,
  );

  // QR to the public verification page (FR-REG-004) and the seal.
  const qr = await pdf.embedPng(await qrPng(data.verifyUrl));
  const qrY = Math.max(90, y - 150);
  page.drawImage(qr, { x: 40, y: qrY, width: 120, height: 120 });
  page.drawText("Verify this licence", {
    x: 175,
    y: qrY + 96,
    size: 11,
    font: fonts.bold,
    color: INK,
  });
  page.drawText(pdfText(data.verifyUrl), {
    x: 175,
    y: qrY + 80,
    size: 8.5,
    font: fonts.regular,
    color: PRIMARY,
    maxWidth: width - 220,
  });
  page.drawText("Scan the code or open the link to see the live status.", {
    x: 175,
    y: qrY + 64,
    size: 8.5,
    font: fonts.regular,
    color: MUTED,
  });
  page.drawRectangle({ x: 175, y: qrY + 8, width: 260, height: 44, color: rgb(0.96, 0.97, 1) });
  page.drawText("DIGITAL SEAL (PILOT)", {
    x: 185,
    y: qrY + 36,
    size: 7,
    font: fonts.bold,
    color: MUTED,
  });
  page.drawText(data.seal, { x: 185, y: qrY + 18, size: 11, font: fonts.bold, color: BRAND });

  footer(
    page,
    fonts,
    "Issued under the Professional Body's registration and licensing rules. The register shows the authoritative status at any time.",
  );
  return pdf.save();
}

// ---------------------------------------------------------------------------
// Receipt (FR-PAY-007), acknowledgment (FR-WIZ-014), decision letter (FR-M-015)
// ---------------------------------------------------------------------------

export async function simpleDocumentPdf({
  title,
  subtitle,
  entries,
  paragraphs = [],
  table,
  footerText,
}: {
  title: string;
  subtitle: string;
  entries: Array<[string, string]>;
  paragraphs?: string[];
  table?: { head: [string, string]; rows: Array<[string, string]>; total?: [string, string] };
  footerText: string;
}): Promise<Uint8Array> {
  const { pdf, fonts } = await newDocument(title);
  const page = pdf.addPage(A4);
  const { width, height } = page.getSize();
  header(page, fonts, title, subtitle);
  let y = rows(page, fonts, entries, 40, height - 200, width - 80);

  if (table) {
    y -= 6;
    page.drawRectangle({
      x: 40,
      y: y - 6,
      width: width - 80,
      height: 22,
      color: rgb(0.95, 0.96, 0.99),
    });
    page.drawText(pdfText(table.head[0]), { x: 50, y, size: 9, font: fonts.bold, color: MUTED });
    page.drawText(pdfText(table.head[1]), {
      x: width - 160,
      y,
      size: 9,
      font: fonts.bold,
      color: MUTED,
    });
    y -= 24;
    for (const [label, value] of table.rows) {
      page.drawText(pdfText(label), { x: 50, y, size: 10.5, font: fonts.regular, color: INK });
      page.drawText(pdfText(value), {
        x: width - 160,
        y,
        size: 10.5,
        font: fonts.regular,
        color: INK,
      });
      y -= 18;
    }
    if (table.total) {
      page.drawLine({
        start: { x: 40, y: y + 8 },
        end: { x: width - 40, y: y + 8 },
        thickness: 0.6,
        color: LINE,
      });
      y -= 6;
      page.drawText(pdfText(table.total[0]), {
        x: 50,
        y,
        size: 11.5,
        font: fonts.bold,
        color: INK,
      });
      page.drawText(pdfText(table.total[1]), {
        x: width - 160,
        y,
        size: 11.5,
        font: fonts.bold,
        color: BRAND,
      });
      y -= 26;
    }
  }
  for (const paragraph of paragraphs) {
    const lines = wrap(pdfText(paragraph), fonts.regular, 10.5, width - 80);
    for (const line of lines) {
      if (y < 80) break;
      page.drawText(line, { x: 40, y, size: 10.5, font: fonts.regular, color: INK });
      y -= 14;
    }
    y -= 8;
  }
  footer(page, fonts, footerText);
  return pdf.save();
}

// ---------------------------------------------------------------------------
// Watermarked officer downloads (FR-L-011)
// ---------------------------------------------------------------------------

export async function watermarked(
  bytes: Buffer,
  mimeType: string,
  mark: string,
): Promise<Uint8Array> {
  let pdf: PDFDocument;
  if (mimeType === "application/pdf") {
    pdf = await PDFDocument.load(bytes, { ignoreEncryption: false });
  } else {
    pdf = await PDFDocument.create();
    const image = mimeType === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const scale = Math.min(1, (A4[0] - 60) / image.width, (A4[1] - 60) / image.height);
    const page = pdf.addPage(A4);
    page.drawImage(image, {
      x: (A4[0] - image.width * scale) / 2,
      y: (A4[1] - image.height * scale) / 2,
      width: image.width * scale,
      height: image.height * scale,
    });
  }
  // Strip every script entry point before an officer opens the file (security review M4).
  for (const key of ["OpenAction", "AA", "AcroForm", "Names"]) pdf.catalog.delete(PDFName.of(key));
  for (const page of pdf.getPages()) page.node.delete(PDFName.of("AA"));
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const text = pdfText(mark);
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    page.drawText(text, {
      x: width * 0.12,
      y: height * 0.3,
      size: 18,
      font,
      color: rgb(0.8, 0.1, 0.1),
      opacity: 0.22,
      rotate: degrees(35),
    });
    page.drawText(text, { x: 20, y: 12, size: 7, font, color: rgb(0.8, 0.1, 0.1), opacity: 0.7 });
  }
  return pdf.save();
}
