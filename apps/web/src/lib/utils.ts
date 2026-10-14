import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges class names, letting later Tailwind utilities override earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TIME_ZONE = "Africa/Kigali";

/** UX-014: dates as DD/MM/YYYY in the UI, in Kigali time. */
export function formatDate(value: Date | string | number, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

export function formatDateTime(value: Date | string | number, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

/** UX-014: RWF with thousands separators and no decimals. */
export function formatCurrency(amount: number, currency = "RWF", locale = "en-RW"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? [parts[0]![0], parts[parts.length - 1]![0]] : [parts[0]?.[0], parts[0]?.[1]];
  return letters.filter(Boolean).join("").toUpperCase();
}

/** Hides most of an email for display: "al***@example.rw". */
export function maskEmailForDisplay(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}${"*".repeat(Math.max(1, Math.min(local.length - 2, 5)))}@${domain}`;
}

/** Hides most of a phone number for display: "+250 *** *** 456". */
export function maskPhoneForDisplay(phone: string): string {
  return `${phone.slice(0, 4)} *** *** ${phone.slice(-3)}`;
}

/** Short, human description of a user agent string ("Chrome on macOS"). */
export function describeUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : null;
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iOS/.test(ua)
      ? "iOS"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  if (!browser && !os) return null;
  return [browser, os].filter(Boolean).join(" · ");
}

/** Masks the destination of a one-time code for display, by channel. */
export function maskDestination(
  method: "TOTP" | "SMS" | "EMAIL",
  destination: string | null | undefined,
): string | null {
  if (!destination) return null;
  if (method === "SMS") return maskPhoneForDisplay(destination);
  if (method === "EMAIL") return maskEmailForDisplay(destination);
  return null;
}
