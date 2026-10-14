import { ArrowRight, Search } from "@/components/icons";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Sample queries the ticker rolls through (the sample licence on the landing card). */
const EXAMPLES = ["RL-2026-000123", "Aline Uwase"];

/**
 * Landing entry to the public register (FR-REG-002). A button, not a search form: the landing
 * page has nothing for bots to submit, and the real search (with QR scan) lives on /register.
 * A short light beam circles the hairline frame, sample queries roll past and the arrow nudges
 * on hover. CSS-only; the beam and ticker stop under reduced motion.
 */
export function VerifyLaunch({ label, className }: { label: string; className?: string }) {
  return (
    <Link
      href="/register"
      className={cn(
        "group/verify inline-flex h-12 animate-search-beam rounded-full p-px outline-none [background:conic-gradient(from_var(--beam-angle),transparent_0_70%,var(--primary)_86%,var(--ember)_94%,transparent_100%),var(--input)] focus-visible:ring-[3px] focus-visible:ring-ring/40",
        className,
      )}
    >
      <span className="flex h-full w-full items-center gap-2.5 rounded-full bg-card pr-4 pl-1.5 transition-colors duration-(--dur-2) group-hover/verify:bg-primary-soft group-active/verify:scale-[0.98]">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-link transition-colors duration-(--dur-2) group-hover/verify:bg-primary group-hover/verify:text-primary-foreground">
          <Search className="size-[1.1rem]" aria-hidden />
        </span>
        <span className="flex-1 text-sm font-semibold whitespace-nowrap xs:flex-none">{label}</span>
        <span aria-hidden className="hidden h-5 items-center gap-2.5 sm:flex">
          <span className="h-4 w-px bg-foreground/10" />
          <span className="h-5 overflow-hidden">
            <span className="flex animate-ticker flex-col font-mono text-xs leading-5 text-muted-foreground">
              {[...EXAMPLES, EXAMPLES[0]].map((example, index) => (
                <span key={index}>{example}</span>
              ))}
            </span>
          </span>
        </span>
        <ArrowRight
          className="size-4 text-muted-foreground transition-[transform,color] duration-(--dur-2) group-hover/verify:translate-x-0.5 group-hover/verify:text-link"
          aria-hidden
        />
      </span>
    </Link>
  );
}
