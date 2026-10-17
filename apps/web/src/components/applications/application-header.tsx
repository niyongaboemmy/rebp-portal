import type { Route } from "next";
import Link from "next/link";
import { ArrowLeft } from "@/components/icons";

/**
 * The application's one-line header (UX-006/027/028), the same on every stage — fill in, sign,
 * pay, submitted: a way back, the category, the kind of application and its reference, and room
 * for actions (live status, Withdraw). The page starts high; the journey follows.
 */
export function ApplicationHeader({
  title,
  typeLine,
  reference,
  actions,
  back,
}: {
  title: string;
  typeLine: string;
  reference: string;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="-mb-2 flex flex-col gap-2">
      {back && (
        <Link
          href={back.href as Route}
          className="group inline-flex w-fit items-center gap-1.5 rounded-full py-1 pr-3 pl-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground dark:hover:bg-white/[0.05]"
        >
          <ArrowLeft
            className="size-4 transition-transform group-hover:-translate-x-0.5"
            aria-hidden
          />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-bold tracking-[-0.02em] @2xl/main:text-2xl">{title}</h1>
          <span className="text-sm text-muted-foreground">
            {typeLine} · <span className="font-mono text-xs whitespace-nowrap">{reference}</span>
          </span>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
