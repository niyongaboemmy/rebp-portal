import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../env";

let transport: Transporter | undefined;

export function createSmtpTransport(): Transporter {
  if (transport) return transport;
  const config = env();
  transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
  });
  return transport;
}
