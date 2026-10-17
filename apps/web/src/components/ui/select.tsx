"use client";

import { useTranslations } from "next-intl";
import { RichSelect, type RichOption } from "./rich-select";

export type SelectOption = RichOption;

/**
 * The app's one select (UX-036): the rich menu in the design system's look, with a search field
 * once the list is long (8+ options), ticks on the chosen row and keyboard support. Use it instead
 * of a native <select> everywhere, so every dropdown looks and behaves the same in both themes.
 */
export function Select(props: React.ComponentProps<typeof RichSelect>) {
  const t = useTranslations("common");
  return (
    <RichSelect
      searchPlaceholder={t("search")}
      emptyLabel={t("noMatch")}
      loadingLabel={t("loading")}
      {...props}
    />
  );
}
