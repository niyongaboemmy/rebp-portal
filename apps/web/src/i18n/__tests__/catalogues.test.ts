import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import rw from "../../../messages/rw.json";

/**
 * UX-003 / gap I-02: every locale carries every key, with the same ICU arguments and rich-text
 * tags as English, so no screen ever renders half-translated or with a broken placeholder.
 */
type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === "string") acc[prefix + key] = value;
    else Object.assign(acc, flatten(value, `${prefix}${key}.`));
    return acc;
  }, {});
}

/**
 * ICU argument names used anywhere in a message (including inside plural/select branches) plus
 * <tag> names. A tiny recursive walker: at message level "{" opens an argument; for plural and
 * select arguments, each `keyword {…}` branch is itself a message.
 */
function signature(message: string): string[] {
  const args = new Set<string>();
  let i = 0;
  const parseMessage = (): void => {
    while (i < message.length && message[i] !== "}") {
      if (message[i] === "{") parseArgument();
      else i++;
    }
  };
  const parseArgument = (): void => {
    i++; // "{"
    const head = /^\s*([A-Za-z_]\w*)\s*(?:,\s*(\w+)\s*,?)?/.exec(message.slice(i));
    if (head?.[1]) args.add(head[1]);
    i += head?.[0].length ?? 0;
    if (head?.[2] === "plural" || head?.[2] === "select" || head?.[2] === "selectordinal") {
      while (i < message.length && message[i] !== "}") {
        if (message[i] === "{") {
          i++;
          parseMessage(); // branch text
          i++; // "}"
        } else i++;
      }
    } else {
      while (i < message.length && message[i] !== "}") i++;
    }
    i++; // "}"
  };
  parseMessage();
  const tags = [...message.matchAll(/<(\w+)>/g)].map((m) => `<${m[1]}>`);
  return [...args, ...new Set(tags)].sort();
}

const base = flatten(en as Tree);

describe.each([
  ["fr", fr],
  ["rw", rw],
] as const)("%s catalogue", (_locale, catalogue) => {
  const flat = flatten(catalogue as Tree);

  it("has exactly the English keys", () => {
    expect(Object.keys(flat).sort()).toEqual(Object.keys(base).sort());
  });

  it("keeps every placeholder and tag", () => {
    const mismatches = Object.keys(base).filter(
      (key) =>
        flat[key] !== undefined && signature(flat[key]!).join() !== signature(base[key]!).join(),
    );
    expect(mismatches).toEqual([]);
  });
});
