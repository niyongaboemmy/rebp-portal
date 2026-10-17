"use client";

import { AlertTriangle } from "@/components/icons";
import { Slot } from "radix-ui";
import { createContext, useContext, useId } from "react";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import { InfoTip } from "./info-tip";
import { Label } from "./label";

interface FieldContextValue {
  id: string;
  descriptionId: string;
  errorId: string;
  invalid: boolean;
  hasDescription: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

interface FieldProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: React.ReactNode;
  /** i18n key (from Zod or the server) — translated here. */
  error?: string;
  description?: React.ReactNode;
  labelAction?: React.ReactNode;
  /** Long help goes into an ⓘ beside the label; short hints (≤ 40 characters) stay inline. */
  compactHelp?: boolean;
  children: React.ReactNode;
}

/**
 * Label + control + help + error with correct ARIA wiring (UX-002, FR-WIZ-006).
 * Wrap the control in <FieldControl> so it receives id, aria-invalid and aria-describedby.
 */
export function Field({
  label,
  error,
  description,
  labelAction,
  compactHelp = false,
  className,
  children,
  ...props
}: FieldProps) {
  const id = useId();
  const translate = useErrorMessage();
  const message = translate(error);
  const tip =
    compactHelp &&
    Boolean(description) &&
    !(typeof description === "string" && description.length <= 40);
  const value: FieldContextValue = {
    id,
    descriptionId: `${id}-description`,
    errorId: `${id}-error`,
    invalid: Boolean(error),
    hasDescription: Boolean(description),
  };

  return (
    <FieldContext.Provider value={value}>
      <div className={cn("flex flex-col gap-2", className)} {...props}>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            {tip && <InfoTip id={value.descriptionId}>{description}</InfoTip>}
          </span>
          {labelAction}
        </div>
        {children}
        {description && !tip && !message && (
          <p id={value.descriptionId} className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
        {message && (
          <p
            id={value.errorId}
            role="alert"
            className="flex animate-rise items-start gap-1.5 text-xs leading-relaxed font-medium text-destructive [animation-duration:var(--dur-3)]"
          >
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
            {message}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

export function FieldControl(props: React.ComponentProps<typeof Slot.Root>) {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error("FieldControl must be used inside <Field>");
  const describedBy = ctx.invalid
    ? ctx.errorId
    : ctx.hasDescription
      ? ctx.descriptionId
      : undefined;
  return (
    <Slot.Root
      id={ctx.id}
      aria-invalid={ctx.invalid || undefined}
      aria-describedby={describedBy}
      {...props}
    />
  );
}
