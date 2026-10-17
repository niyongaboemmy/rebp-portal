import "server-only";
import { createTranslator } from "next-intl";
import { db } from "../db";
import { env, isDevMode } from "../env";
import { loadMessages, resolveLocale } from "@/i18n/messages";
import { createSmtpTransport } from "./smtp";

/**
 * Notification adapters (ADR-005, FR-NOT-001…003). Email goes through SMTP when configured;
 * otherwise, and for the SMS mock, the message is logged. In APP_ENV=dev the body and code are kept
 * so the UI can display the code (see devCodeFor); in other modes only delivery metadata is stored.
 */
export type TemplateId =
  | "emailVerify"
  | "phoneVerify"
  | "mfaLoginCode"
  | "mfaEnrolCode"
  | "passwordReset"
  | "passwordChanged"
  | "mfaChanged"
  | "contactChanged"
  | "accessChanged"
  | "signatureCode";

interface Recipient {
  locale?: string | null;
}

async function render(
  template: TemplateId,
  locale: string | null | undefined,
  values: Record<string, string>,
) {
  const resolved = resolveLocale(locale);
  const t = createTranslator({
    locale: resolved,
    messages: loadMessages(resolved),
    namespace: "notifications",
  });
  return {
    subject: t(`${template}.subject`, values),
    body: t(`${template}.body`, values),
  };
}

/** Renders a domain event message (Appendix C) from the "inbox" catalogue in the reader's language. */
export function renderEvent(
  messageKey: string,
  locale: string | null | undefined,
  values: Record<string, string | number>,
) {
  const resolved = resolveLocale(locale);
  // Event keys are data (stored with each notification), so the translator is used untyped here.
  const t = createTranslator({ locale: resolved, messages: loadMessages(resolved) }) as unknown as (
    key: string,
    values?: Record<string, string | number>,
  ) => string;
  return {
    subject: t(`inbox.${messageKey}.title`, values),
    body: t(`inbox.${messageKey}.body`, values),
  };
}

/**
 * Sends a domain event (e.g. N-011 submitted) by email or SMS. The text is the in-app message
 * plus a link, so all channels say the same thing (FR-NOT-002).
 */
export async function sendEvent(
  channel: "EMAIL" | "SMS",
  to: string,
  messageKey: string,
  values: Record<string, string | number>,
  { locale, href }: { locale?: string | null; href?: string | null } = {},
) {
  const { subject, body } = renderEvent(messageKey, locale, values);
  const link = href ? `${env().APP_URL}${href}` : null;
  const text = link ? `${body}\n\n${link}` : body;
  const config = env();
  if (channel === "EMAIL" && config.SMTP_HOST) {
    try {
      await createSmtpTransport().sendMail({ from: config.SMTP_FROM, to, subject, text });
      await logEvent({
        channel,
        recipient: to,
        template: messageKey,
        subject,
        body: text,
        provider: "smtp",
        status: "SENT",
      });
    } catch (error) {
      await logEvent({
        channel,
        recipient: to,
        template: messageKey,
        subject,
        body: text,
        provider: "smtp",
        status: "FAILED",
      });
      console.error("[notifications] event email failed", {
        messageKey,
        error: (error as Error).message,
      });
    }
    return;
  }
  await logEvent({
    channel,
    recipient: to,
    template: messageKey,
    subject: channel === "EMAIL" ? subject : undefined,
    body: channel === "EMAIL" ? text : `${subject}: ${body}`,
    provider: channel === "EMAIL" ? "log" : config.SMS_PROVIDER,
    status: "LOGGED",
  });
}

async function logEvent(entry: {
  channel: "EMAIL" | "SMS";
  recipient: string;
  template: string;
  subject?: string;
  body: string;
  provider: string;
  status: string;
}) {
  // Event messages carry no secrets; bodies are still kept only in dev mode (no PII at rest).
  await db.notificationLog.create({
    data: { ...entry, body: isDevMode() ? entry.body : null, devCode: null },
  });
}

interface LogEntry {
  channel: "EMAIL" | "SMS";
  recipient: string;
  template: TemplateId;
  subject?: string;
  body: string;
  provider: string;
  status: string;
  /** The one-time code carried by this message, if any. */
  code?: string;
}

async function log({ code, body, ...entry }: LogEntry) {
  const dev = isDevMode();
  await db.notificationLog.create({
    // Bodies and codes are kept only in dev mode; production keeps delivery metadata alone.
    data: { ...entry, body: dev ? body : null, devCode: dev ? (code ?? null) : null },
  });
}

export async function sendEmail(
  to: string,
  template: TemplateId,
  values: Record<string, string> = {},
  recipient: Recipient = {},
) {
  const { subject, body } = await render(template, recipient.locale, values);
  const config = env();
  const base = {
    channel: "EMAIL" as const,
    recipient: to,
    template,
    subject,
    body,
    code: values.code,
  };
  if (config.SMTP_HOST) {
    try {
      await createSmtpTransport().sendMail({ from: config.SMTP_FROM, to, subject, text: body });
      await log({ ...base, provider: "smtp", status: "SENT" });
    } catch (error) {
      await log({ ...base, provider: "smtp", status: "FAILED" });
      console.error("[notifications] email delivery failed", {
        template,
        error: (error as Error).message,
      });
    }
    return;
  }
  await log({ ...base, provider: "log", status: "LOGGED" });
  if (config.NODE_ENV === "development") console.info(`[email:${template}] → ${to}\n${body}`);
}

export async function sendSms(
  to: string,
  template: TemplateId,
  values: Record<string, string> = {},
  recipient: Recipient = {},
) {
  const { body } = await render(template, recipient.locale, values);
  await log({
    channel: "SMS",
    recipient: to,
    template,
    body,
    code: values.code,
    provider: env().SMS_PROVIDER,
    status: "LOGGED",
  });
  if (env().NODE_ENV === "development") console.info(`[sms:${template}] → ${to}\n${body}`);
}

/**
 * Dev mode only: the latest one-time code sent to a recipient for a template, so the interface can
 * show it while no mail/SMS gateway is connected. Always null outside dev mode.
 */
export async function devCodeFor(
  recipient: string | null | undefined,
  template: TemplateId,
): Promise<string | null> {
  if (!isDevMode() || !recipient) return null;
  const message = await db.notificationLog.findFirst({
    where: { recipient, template, devCode: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { devCode: true },
  });
  return message?.devCode ?? null;
}
