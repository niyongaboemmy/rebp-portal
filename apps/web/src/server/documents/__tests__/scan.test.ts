import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { extensionMatches, imageSize, inspectPdf, signatureScanner, sniffMime } from "../scan";

/** FR-DOC-001…004 upload inspection, including the bypasses from the security review (M4). */
const pdf = (body: string) => Buffer.from(`%PDF-1.7\n${body}\n%%EOF\n`, "latin1");

describe("PDF inspection (FR-DOC-003)", () => {
  it.each([
    ["plain document", "1 0 obj<</Type/Catalog>>endobj", "ok"],
    ["page-destination OpenAction", "1 0 obj<</Type/Catalog/OpenAction [3 0 R /Fit]>>endobj", "ok"],
    ["JavaScript action", "1 0 obj<</S/JavaScript/JS(app.alert(1))>>endobj", "activeContent"],
    ["hex-escaped name", "1 0 obj<</S/J#61vaScript/J#53(x)>>endobj", "activeContent"],
    ["Launch action", "1 0 obj<</S/Launch/F(cmd.exe)>>endobj", "activeContent"],
    [
      "OpenAction dictionary",
      "1 0 obj<</OpenAction <</S/URI/URI(http://x)>>>>endobj",
      "activeContent",
    ],
    ["additional actions", "1 0 obj<</AA<</O 2 0 R>>>>endobj", "activeContent"],
    ["encrypted", "trailer<</Encrypt 9 0 R>>", "encrypted"],
  ])("%s → %s", (_label, body, expected) => {
    expect(inspectPdf(pdf(body))).toBe(expected);
  });

  it("finds JavaScript hidden in a compressed object stream", () => {
    const hidden = deflateSync(Buffer.from("<</S/JavaScript/JS(app.alert(1))>>", "latin1"));
    const data = Buffer.concat([
      Buffer.from(
        "%PDF-1.7\n4 0 obj<</Type/ObjStm/Filter/FlateDecode/Length 1>>stream\n",
        "latin1",
      ),
      hidden,
      Buffer.from("\nendstream endobj\n%%EOF\n", "latin1"),
    ]);
    expect(inspectPdf(data)).toBe("activeContent");
  });
});

describe("type sniffing and scanning (FR-DOC-001/004)", () => {
  it("sniffs magic bytes, not the name", () => {
    expect(sniffMime(pdf(""))).toBe("application/pdf");
    expect(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(Buffer.from("<html>"))).toBeNull();
  });
  it.each([
    ["a.pdf", "application/pdf", true],
    ["a.PDF", "application/pdf", true],
    ["a.jpeg", "image/jpeg", true],
    ["a.png", "application/pdf", false],
    ["a.pdf.exe", "application/pdf", false],
  ] as const)("extension %s for %s → %s", (name, mime, ok) => {
    expect(extensionMatches(name, mime)).toBe(ok);
  });
  it("reads PNG dimensions from IHDR", () => {
    const header = Buffer.alloc(24);
    header.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    header.writeUInt32BE(640, 16);
    header.writeUInt32BE(480, 20);
    expect(imageSize(header, "image/png")).toEqual({ width: 640, height: 480 });
  });
  it("detects the EICAR test file", async () => {
    const eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
    expect((await signatureScanner.scan(Buffer.from(`junk ${eicar} junk`))).clean).toBe(false);
    expect((await signatureScanner.scan(pdf("clean"))).clean).toBe(true);
  });
});
