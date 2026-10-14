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
  | "accessChanged";

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
