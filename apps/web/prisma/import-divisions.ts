/**
 * Imports the full administrative divisions dataset (FR-B-009, Plan P5) from a CSV with the
 * header `code,level,name,parentCode`. Idempotent (upsert by code). Usage:
 *   pnpm tsx prisma/import-divisions.ts path/to/divisions.csv
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: tsx prisma/import-divisions.ts <csv>");
  const [header, ...lines] = readFileSync(file, "utf8").trim().split(/\r?\n/);
  if (header?.replace(/\s/g, "") !== "code,level,name,parentCode")
    throw new Error("Unexpected header");
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  let count = 0;
  for (const line of lines) {
    const [code, level, name, parentCode] = line.split(",").map((v) => v.trim());
    if (!code || !level || !name) continue;
    const data = { level: Number(level), name, parentCode: parentCode || null };
    await db.adminDivision.upsert({ where: { code }, update: data, create: { code, ...data } });
    count++;
  }
  console.info(`Imported ${count} divisions.`);
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
