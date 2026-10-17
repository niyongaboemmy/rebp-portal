"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { Address, SectionKey } from "@rebp/contracts";
import { Globe2 } from "@/components/icons";
import { Field, FieldControl } from "@/components/ui/field";
import { Input, inputClass } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useSection, useWizard, type Division } from "./context";
import { NativeSelect } from "./fields";

const LEVELS = ["province", "district", "sector", "cell", "village"] as const;
type Level = (typeof LEVELS)[number];

const cache = new Map<string, Promise<Division[]>>();

export function loadDivisions(parent: string): Promise<Division[]> {
  if (!cache.has(parent)) {
    cache.set(
      parent,
      fetch(`/api/lookup/divisions?parent=${encodeURIComponent(parent)}`)
        .then((r) => (r.ok ? (r.json() as Promise<Division[]>) : []))
        .catch(() => {
          cache.delete(parent);
          return [];
        }),
    );
  }
  return cache.get(parent)!;
}

/**
 * Structured address (FR-B-009): cascading Province → District → Sector → Cell → Village from the
 * administrative dataset, plus street details; an "outside Rwanda" mode (FR-B-011). Each level
 * resets the levels below it. Levels without data in the pilot dataset are simply not shown.
 */
export function AddressField({
  section,
  path,
  legend,
  allowAbroad = true,
}: {
  section: SectionKey;
  path: string;
  legend: React.ReactNode;
  allowAbroad?: boolean;
}) {
  const t = useTranslations("wizard.address");
  const { provinces } = useWizard();
  const s = useSection(section);
  const address = (s.get(path) as Address | undefined) ?? {};
  const [loaded, setLoaded] = useState<{
    key: string;
    lists: Partial<Record<Level, Division[]>>;
  }>({ key: "", lists: { province: provinces } });
  // Which parent choices the lists were loaded for; a mismatch means a list is on its way.
  const key = LEVELS.slice(0, -1)
    .map((l) => address[l] ?? "")
    .join("|");
  const options = loaded.lists;
  const loading = loaded.key !== key;

  // Load the option lists for the levels already chosen (resume from a saved draft).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Partial<Record<Level, Division[]>> = { province: provinces };
      for (let i = 0; i < LEVELS.length - 1; i++) {
        const value = address[LEVELS[i]!];
        if (!value) break;
        next[LEVELS[i + 1]!] = await loadDivisions(value);
      }
      if (!cancelled) setLoaded({ key, lists: next });
    })();
    return () => {
      cancelled = true;
    };
    // Only re-run when the chosen codes change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address.province, address.district, address.sector, address.cell, provinces]);

  const choose = (level: Level, value: string | undefined) => {
    const index = LEVELS.indexOf(level);
    const next: Address = { ...address, [level]: value };
    for (const lower of LEVELS.slice(index + 1)) delete next[lower];
    s.set(path, next);
  };

  return (
    <fieldset className="flex flex-col gap-4" disabled={s.disabled} data-path={path}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <legend className="text-sm font-semibold">{legend}</legend>
        {allowAbroad && (
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Globe2 className="size-4" aria-hidden />
            {t("abroad")}
            <Switch
              checked={Boolean(address.abroad)}
              disabled={s.disabled}
              onCheckedChange={(checked) =>
                s.set(
                  path,
                  checked
                    ? { abroad: true, abroadText: address.abroadText }
                    : { details: address.details },
                )
              }
            />
          </label>
        )}
      </div>
      {address.abroad ? (
        <Field
          label={t("abroadText")}
          description={t("abroadHint")}
          error={s.error(`${path}.abroadText`)}
        >
          <FieldControl>
            <textarea
              rows={3}
              value={address.abroadText ?? ""}
              maxLength={300}
              disabled={s.disabled}
              onChange={(e) => s.set(`${path}.abroadText`, e.target.value || undefined)}
              className={cn(inputClass, "h-auto py-3")}
            />
          </FieldControl>
        </Field>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LEVELS.map((level, index) => {
              const list = options[level];
              const parentChosen = index === 0 || Boolean(address[LEVELS[index - 1]!]);
              // The level just below the deepest choice is the one being fetched.
              const fetching =
                loading &&
                index > 0 &&
                parentChosen &&
                (!list || !address[level] || !list.some((d) => d.code === address[level]));
              if (index >= 3 && !fetching && (!list || list.length === 0)) return null;
              return (
                <Field
                  key={level}
                  label={t(level)}
                  error={s.error(`${path}.${level}`)}
                  data-path={`${path}.${level}`}
                >
                  <FieldControl>
                    <NativeSelect
                      value={address[level]}
                      onChange={(v) => choose(level, v)}
                      options={(list ?? []).map((d) => ({ value: d.code, label: d.name }))}
                      placeholder={parentChosen ? t("choose") : t("chooseAbove")}
                      disabled={s.disabled || !parentChosen}
                      loading={fetching}
                    />
                  </FieldControl>
                </Field>
              );
            })}
          </div>
          <Field label={t("details")} description={t("detailsHint")}>
            <FieldControl>
              <Input
                value={address.details ?? ""}
                maxLength={200}
                disabled={s.disabled}
                onChange={(e) => s.set(`${path}.details`, e.target.value || undefined)}
                autoComplete="street-address"
              />
            </FieldControl>
          </Field>
        </>
      )}
    </fieldset>
  );
}
