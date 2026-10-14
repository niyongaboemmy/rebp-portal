import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import rw from "../../messages/rw.json";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

export type Messages = typeof en;

type Tree = { [key: string]: string | Tree };

/** Fills gaps in a partial translation with English so no key ever renders raw. */
function deepMerge(base: Tree, override: Tree): Tree {
  const result: Tree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    result[key] =
      typeof value === "object" && typeof current === "object" ? deepMerge(current, value) : value;
  }
  return result;
}

const catalogue: Record<Locale, Messages> = {
  en,
  rw: deepMerge(en as Tree, rw as Tree) as Messages,
  fr: deepMerge(en as Tree, fr as Tree) as Messages,
};

export function resolveLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function loadMessages(locale: Locale): Messages {
  return catalogue[locale];
}
