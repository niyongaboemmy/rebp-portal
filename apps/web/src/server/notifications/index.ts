import "server-only";
import { createTranslator } from "next-intl";
import { db } from "../db";
import { env, storeNotificationBodies } from "../env";
import { loadMessages, resolveLocale } from "@/i18n/messages";
import { createSmtpTransport } from "./smtp";

/**
 * Notification adapters (ADR-005, FR-NOT-001…003). Email goes through SMTP when configured;
 * otherwise, and for the SMS mock, the message is logged (bodies only when storeNotificationBodies()).
 */
export type TemplateId =
  | "emailVerify"
  | "phoneVerify"
  | "mfaLoginCode"
  | "mfaEnrolCode"
  | "passwordReset"
  | "passwordChanged"
  | "mfaChanged"
  | "contactChanged";

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

async function log(entry: {
  channel: "EMAIL" | "SMS";
  recipient: string;
  template: TemplateId;
  subject?: string;
  body: string;
  provider: string;
  status: string;
}) {
  await db.notificationLog.create({
    data: { ...entry, body: storeNotificationBodies() ? entry.body : null },
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
  if (config.SMTP_HOST) {
    try {
      await createSmtpTransport().sendMail({ from: config.SMTP_FROM, to, subject, text: body });
      await log({
        channel: "EMAIL",
        recipient: to,
        template,
        subject,
        body,
        provider: "smtp",
        status: "SENT",
      });
    } catch (error) {
      await log({
        channel: "EMAIL",
        recipient: to,
        template,
        subject,
        body,
        provider: "smtp",
        status: "FAILED",
      });
      console.error("[notifications] email delivery failed", {
        template,
        error: (error as Error).message,
      });
    }
    return;
  }
  await log({
    channel: "EMAIL",
    recipient: to,
    template,
    subject,
    body,
    provider: "log",
    status: "LOGGED",
  });
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
    provider: env().SMS_PROVIDER,
    status: "LOGGED",
  });
  if (env().NODE_ENV === "development") console.info(`[sms:${template}] → ${to}\n${body}`);
}
