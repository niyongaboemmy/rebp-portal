import { describe, expect, it } from "vitest";
import {
  cn,
  describeUserAgent,
  formatCurrency,
  formatDate,
  initials,
  maskEmailForDisplay,
  maskPhoneForDisplay,
} from "../utils";

describe("cn", () => {
  it("merges and de-duplicates Tailwind classes", () => {
    expect(cn("px-2 py-1", false && "hidden", "px-4")).toBe("py-1 px-4");
  });
});

describe("formatting (UX-014)", () => {
  it("formats dates as DD/MM/YYYY in Kigali time", () => {
    expect(formatDate("2026-10-18T23:30:00Z")).toBe("19/10/2026");
  });

  it("formats RWF without decimals", () => {
    expect(formatCurrency(150000)).toMatch(/150,000/);
    expect(formatCurrency(150000)).toMatch(/RWF|FRw|RF/);
  });
});

describe("display helpers", () => {
  it("derives initials", () => {
    expect(initials("Aline Uwase")).toBe("AU");
    expect(initials("Grace")).toBe("GR");
    expect(initials("Jean Paul Habimana")).toBe("JH");
  });

  it("masks contact details", () => {
    expect(maskEmailForDisplay("aline@example.rw")).toBe("al***@example.rw");
    expect(maskPhoneForDisplay("+250788123456")).toBe("+250 *** *** 456");
  });

  it("describes user agents", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36",
      ),
    ).toBe("Chrome · macOS");
    expect(
      describeUserAgent("Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36"),
    ).toBe("Chrome · Android");
    expect(describeUserAgent(null)).toBeNull();
  });
});
