"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import type { SectionKey } from "@rebp/contracts";
import { Check } from "@/components/icons";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldControl } from "@/components/ui/field";
import { InfoTip } from "@/components/ui/info-tip";
import { Input, inputClass } from "@/components/ui/input";
import { useErrorMessage } from "@/hooks/use-error-message";
import { RichSelect } from "@/components/ui/rich-select";
import { cn } from "@/lib/utils";
import { HOVER, INTERACTIVE, SELECTED, SURFACE_MUTED } from "@/components/ui/surface";
import { useSection } from "./context";
import { FieldRules } from "./rules-ui";

/**
 * Wizard fields bound to section data by path. Every field is labelled, wires its help and error
 * text through ARIA (UX-002, FR-WIZ-006) and becomes read-only when the section is locked.
 */
interface BaseProps {
  section: SectionKey;
  path: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  optional?: boolean;
}

function OptionalLabel({ label, optional }: { label: React.ReactNode; optional?: boolean }) {
  const t = useTranslations("common");
  return (
    <>
      {label}
      {optional && (
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">({t("optional")})</span>
      )}
    </>
  );
}

export function TextField({
  section,
  path,
  label,
  description,
  className,
  optional,
  multiline,
  maxLength,
  transform,
  ...input
}: BaseProps &
  Omit<React.ComponentProps<"input">, "value" | "onChange" | "defaultValue"> & {
    multiline?: boolean;
    transform?: (value: string) => string;
  }) {
  const s = useSection(section);
  const value = (s.get(path) as string | undefined) ?? "";
  const set = (next: string) =>
    s.set(path, next === "" ? undefined : transform ? transform(next) : next);
  return (
    <Field
      compactHelp
      label={<OptionalLabel label={label} optional={optional} />}
      description={description}
      error={s.error(path)}
      data-path={path}
      className={className}
    >
      <FieldControl>
        {multiline ? (
          <textarea
            value={value}
            maxLength={maxLength}
            disabled={s.disabled}
            onChange={(e) => set(e.target.value)}
            rows={4}
            className={cn(inputClass, "h-auto min-h-28 py-3 leading-relaxed")}
          />
        ) : (
          <Input
            value={value}
            maxLength={maxLength}
            disabled={s.disabled}
            onChange={(e) => set(e.target.value)}
            {...input}
          />
        )}
      </FieldControl>
      {multiline && maxLength && (
        <span className="-mt-1 self-end text-xs num text-muted-foreground">
          {value.length}/{maxLength}
        </span>
      )}
      <FieldRules section={section} path={path} />
    </Field>
  );
}

export function NumberField({
  section,
  path,
  label,
  description,
  className,
  optional,
  min,
  max,
  step,
}: BaseProps & { min?: number; max?: number; step?: number }) {
  const s = useSection(section);
  const value = s.get(path) as number | undefined;
  return (
    <Field
      compactHelp
      label={<OptionalLabel label={label} optional={optional} />}
      description={description}
      error={s.error(path)}
      data-path={path}
      className={className}
    >
      <FieldControl>
        <Input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={value ?? ""}
          disabled={s.disabled}
          onChange={(e) => s.set(path, e.target.value === "" ? undefined : Number(e.target.value))}
        />
      </FieldControl>
      <FieldRules section={section} path={path} />
    </Field>
  );
}

export function DateField({
  section,
  path,
  label,
  description,
  className,
  optional,
  min,
  max,
}: BaseProps & { min?: string; max?: string }) {
  const s = useSection(section);
  return (
    <Field
      compactHelp
      label={<OptionalLabel label={label} optional={optional} />}
      description={description}
      error={s.error(path)}
      data-path={path}
      className={className}
    >
      <FieldControl>
        <Input
          type="date"
          min={min}
          max={max}
          value={(s.get(path) as string | undefined) ?? ""}
          disabled={s.disabled}
          onChange={(e) => s.set(path, e.target.value || undefined)}
        />
      </FieldControl>
      <FieldRules section={section} path={path} />
    </Field>
  );
}

export interface Option {
  value: string;
  label: string;
}

/**
 * The form's select: the design system's rich menu (frosted panel, ticked choice, search for
 * long lists), styled as a field. Kept under this name so every wizard section uses it.
 */
export function NativeSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  loading,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange" | "value"> & {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  options: Option[];
  placeholder?: string;
  /** Options are being fetched (e.g. the next level of an address). */
  loading?: boolean;
}) {
  const t = useTranslations("wizard");
  return (
    <RichSelect
      loadingLabel={t("loading")}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder ?? "—"}
      disabled={disabled}
      loading={loading}
      searchPlaceholder={t("search")}
      emptyLabel={t("noMatch")}
      className={className}
      {...props}
    />
  );
}

export function SelectField({
  section,
  path,
  label,
  description,
  className,
  optional,
  options,
  placeholder,
}: BaseProps & { options: Option[]; placeholder?: string }) {
  const s = useSection(section);
  const tw = useTranslations("wizard");
  return (
    <Field
      compactHelp
      label={<OptionalLabel label={label} optional={optional} />}
      description={description}
      error={s.error(path)}
      data-path={path}
      className={className}
    >
      <FieldControl>
        <NativeSelect
          value={s.get(path) as string | undefined}
          onChange={(v) => s.set(path, v)}
          options={options}
          placeholder={placeholder ?? tw("choose")}
          disabled={s.disabled}
        />
      </FieldControl>
      <FieldRules section={section} path={path} />
    </Field>
  );
}

/**
 * Yes / No as a radio group in the segmented-control style. Unlike <Segmented>, it shows no
 * selection until the applicant answers, so an unanswered question never looks answered.
 */
export function YesNoField({ section, path, label, description, className }: BaseProps) {
  const s = useSection(section);
  const t = useTranslations("wizard");
  const translate = useErrorMessage();
  const value = s.get(path) as boolean | undefined;
  const error = s.error(path);
  const labelId = useId();
  const name = useId();
  return (
    <div
      // The field is its own container (an element can't query itself, so the grid is inside):
      // question and answer share a row when it's wide, and stack in a narrow grid cell (UX-005).
      className={cn("@container", className)}
      data-path={path}
      role="radiogroup"
      aria-labelledby={labelId}
      aria-invalid={Boolean(error) || undefined}
    >
      <div className="grid gap-2 @lg:grid-cols-[minmax(0,1fr)_13rem] @lg:items-center @lg:gap-x-6">
        <span className="inline-flex items-start gap-1.5">
          <span id={labelId} className="text-sm leading-snug font-medium">
            {label}
          </span>
          {description && <InfoTip className="mt-px">{description}</InfoTip>}
        </span>
        <div
          className={cn(
            "grid w-full max-w-xs grid-cols-2 gap-1 rounded-2xl bg-muted p-1 @lg:max-w-none dark:bg-surface-2",
            error && "ring-2 ring-destructive/40",
            s.disabled && "opacity-60",
          )}
        >
          {([true, false] as const).map((option) => {
            const checked = value === option;
            return (
              <label
                key={String(option)}
                className={cn(
                  "inline-flex tap-target cursor-pointer items-center justify-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition-[background-color,color,box-shadow] duration-(--dur-2) has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
                  checked
                    ? "bg-primary text-primary-foreground shadow-[0_6px_16px_-8px_oklch(0.45_0.2_264/0.7)]"
                    : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground dark:hover:bg-surface-2",
                  s.disabled && "cursor-not-allowed",
                )}
              >
                <input
                  type="radio"
                  name={name}
                  className="sr-only"
                  checked={checked}
                  disabled={s.disabled}
                  onChange={() => s.set(path, option)}
                />
                {/* A radio mark on each option: empty ring, or a filled tick when chosen. */}
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors",
                    checked
                      ? "bg-white text-primary"
                      : "ring-2 ring-foreground/25 ring-inset dark:ring-white/30",
                  )}
                >
                  {checked && <Check className="size-3.5 animate-pop" strokeWidth={3} />}
                </span>
                {option ? t("yes") : t("no")}
              </label>
            );
          })}
        </div>
        {error && (
          <p role="alert" className="text-xs font-medium text-destructive @lg:col-span-2">
            {translate(error)}
          </p>
        )}
        <div className="empty:hidden @lg:col-span-2">
          <FieldRules section={section} path={path} />
        </div>
      </div>
    </div>
  );
}

/** Choice cards for small enums with a description each (e.g. practice arrangement). */
export function ChoiceCards({
  section,
  path,
  label,
  options,
  className,
  columns = 2,
}: BaseProps & {
  options: Array<Option & { description?: string; icon?: React.ReactNode }>;
  columns?: 1 | 2 | 3;
}) {
  const s = useSection(section);
  const translate = useErrorMessage();
  const value = s.get(path) as string | undefined;
  const error = s.error(path);
  const name = useId();
  return (
    <fieldset
      className={cn("flex flex-col gap-2.5", className)}
      disabled={s.disabled}
      data-path={path}
    >
      {/* The question is the loudest thing on the page after the title (UX-004 §2). */}
      <legend className="mb-2.5 text-base font-semibold">{label}</legend>
      <div
        className={cn(
          "grid gap-2.5",
          columns === 2 && "sm:grid-cols-2",
          columns === 3 && "sm:grid-cols-3",
        )}
      >
        {options.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "group relative flex cursor-pointer items-start gap-3 rounded-2xl p-4 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
                INTERACTIVE,
                // No outlines (UX-007): a quiet fill, and a primary tint once chosen.
                checked ? SELECTED : cn(SURFACE_MUTED, HOVER),
                s.disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => s.set(path, option.value)}
                className="sr-only"
              />
              {option.icon && (
                <span
                  className={cn(
                    "inline-flex size-9 shrink-0 items-center justify-center rounded-xl",
                    checked
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary-soft text-primary-soft-foreground",
                  )}
                >
                  {option.icon}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold">{option.label}</span>
                {option.description && (
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {option.description}
                  </span>
                )}
              </span>
              <span
                aria-hidden
                className={cn(
                  "inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-[background-color,box-shadow] duration-(--dur-2)",
                  checked
                    ? "bg-primary text-primary-foreground"
                    : "shadow-[inset_0_0_0_1.5px_color-mix(in_oklch,var(--foreground)_22%,transparent)]",
                )}
              >
                {checked && <Check className="size-3" strokeWidth={3} />}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {translate(error)}
        </p>
      )}
      <FieldRules section={section} path={path} />
    </fieldset>
  );
}

/** A required acknowledgment (FR-G1-005, FR-G2-006, FR-H-004): a bordered checkbox row with the text. */
export function AckField({ section, path, label, description, className }: BaseProps) {
  const s = useSection(section);
  const translate = useErrorMessage();
  const id = useId();
  const error = s.error(path);
  return (
    <div className={cn("flex flex-col gap-1.5", className)} data-path={path}>
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-2xl p-4",
          INTERACTIVE,
          s.get(path) === true ? SELECTED : cn(SURFACE_MUTED, HOVER),
          error && "bg-danger-soft/50",
          s.disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <Checkbox
          id={id}
          checked={s.get(path) === true}
          disabled={s.disabled}
          onCheckedChange={(checked) => s.set(path, checked === true ? true : undefined)}
          aria-invalid={Boolean(error) || undefined}
          className="mt-0.5"
        />
        <span className="flex flex-col gap-1">
          <span className="text-sm leading-snug font-medium">{label}</span>
          {description && (
            <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>
          )}
        </span>
      </label>
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {translate(error)}
        </p>
      )}
      <FieldRules section={section} path={path} />
    </div>
  );
}

/** A group of related fields with a heading (sub-sections inside a step). */
export function FieldGroup({
  title,
  description,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      {(title || description) && (
        <div className="flex items-center gap-1.5">
          {title && <h3 className="text-base font-semibold">{title}</h3>}
          {description &&
            (title ? (
              <InfoTip>{description}</InfoTip>
            ) : (
              <p className="text-sm text-muted-foreground">{description}</p>
            ))}
        </div>
      )}
      {children}
    </section>
  );
}

/** Two columns on wider screens. */
export function Grid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 @xl/form:grid-cols-2", className)}>{children}</div>
  );
}
