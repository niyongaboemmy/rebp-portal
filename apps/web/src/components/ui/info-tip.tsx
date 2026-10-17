"use client";

import { Popover } from "radix-ui";
import { Info } from "@/components/icons";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A small ⓘ that reveals help on tap (phones) or hover/focus (desktop), so screens show the
 * question, not paragraphs. The text also stays in the accessibility tree where needed: pass
 * `id` to render it as an sr-only description that a field can reference via aria-describedby.
 */
export function InfoTip({
  children,
  id,
  className,
  label,
}: {
  children: React.ReactNode;
  /** Renders an sr-only copy with this id (for aria-describedby). */
  id?: string;
  className?: string;
  /** Accessible name of the button (defaults to "More information"). */
  label?: string;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hover = (next: boolean) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), next ? 120 : 160);
  };
  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          type="button"
          aria-label={label ?? t("moreInfo")}
          onPointerEnter={(e) => e.pointerType === "mouse" && hover(true)}
          onPointerLeave={(e) => e.pointerType === "mouse" && hover(false)}
          className={cn(
            "inline-flex size-5 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground transition-colors outline-none hover:bg-primary-soft hover:text-link focus-visible:ring-[3px] focus-visible:ring-ring/40 data-[state=open]:bg-primary data-[state=open]:text-primary-foreground",
            className,
          )}
        >
          <Info className="size-3.5" aria-hidden />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="top"
            align="start"
            sideOffset={6}
            collisionPadding={12}
            onPointerEnter={() => hover(true)}
            onPointerLeave={() => hover(false)}
            className="z-50 max-w-72 animate-popover-in rounded-2xl bg-foreground px-3.5 py-2.5 text-xs leading-relaxed font-medium text-background shadow-lg outline-none [animation-duration:var(--dur-2)] dark:bg-popover dark:text-foreground dark:shadow-(--overlay)"
          >
            {children}
            <Popover.Arrow className="fill-foreground dark:fill-popover" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {id && (
        <span id={id} className="sr-only">
          {children}
        </span>
      )}
    </>
  );
}
