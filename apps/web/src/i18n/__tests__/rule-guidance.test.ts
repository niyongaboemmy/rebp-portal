import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";

/**
 * UX-004 §3.2: every FAIL or WARN the eligibility engine can produce has "how to fix it" copy
 * beside "what happened", so the wizard never shows a problem without a way out. The engine's
 * source is the list of outcomes; the other locales follow through catalogues.test.ts.
 */
const source = readFileSync(
  fileURLToPath(new URL("../../../../../packages/contracts/src/rules.ts", import.meta.url)),
  "utf8",
);

const guided = new Set<string>();
for (const match of source.matchAll(/r\(\s*"(BR-\d+)",\s*"(FAIL|WARN)",\s*"(\w+)"/g))
  guided.add(`${match[1]}.${match[3]}`);
// Experience rules pick their id and suffix at run time.
for (const id of ["BR-020", "BR-021"]) for (const s of ["fail", "notYet"]) guided.add(`${id}.${s}`);

const rules = en.rules as unknown as Record<string, Record<string, string>>;

describe("rule guidance copy", () => {
  it("finds the engine's outcomes", () => {
    expect(guided.size).toBeGreaterThan(25);
  });

  it.each([...guided])("%s has a message and a fix", (key) => {
    const [id, suffix] = key.split(".") as [string, string];
    expect(rules[id]?.[suffix], `rules.${key}`).toBeTypeOf("string");
    expect(rules[id]?.[`${suffix}Fix`], `rules.${key}Fix`).toBeTypeOf("string");
  });
});
