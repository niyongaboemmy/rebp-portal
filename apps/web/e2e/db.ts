import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma/client";

const testEnv = config({ path: ".env.test", processEnv: {} }).parsed ?? {};

export const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: testEnv.DATABASE_URL! }),
});

/** Latest one-time code delivered to a recipient by the mock email/SMS adapters. */
export async function latestCode(recipient: string, template: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const message = await db.notificationLog.findFirst({
      where: { recipient, template },
      orderBy: { createdAt: "desc" },
    });
    const code = message?.body?.match(/\b(\d{6})\b/)?.[1];
    if (code) return code;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No ${template} code for ${recipient}`);
}

export const uniqueEmail = (prefix: string) =>
  `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@e2e.rebp.rw`;
export const uniquePhone = () =>
  `+25078${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
