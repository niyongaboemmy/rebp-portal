import { SketchUnderline } from "@/components/motion/sketch-underline";
import { cn } from "@/lib/utils";

/**
 * The landing page's hero language for every public page: ambient light and the Imigongo fade
 * behind, an eyebrow chip with the live Ember dot, a bold title with the Sun double underline,
 * one line of copy and an optional slot (search, actions). Entrances rise in sequence.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  icon,
  align = "left",
  compact = false,
  children,
  className,
}: {
  /** Tighter spacing and a smaller title, for tool pages (search, lists). */
  compact?: boolean;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional icon shown in a gradient tile above the title (centred heroes). */
  icon?: React.ReactNode;
  align?: "left" | "center";
  children?: React.ReactNode;
  className?: string;
}) {
  const center = align === "center";
  return (
    <section className={cn("relative isolate", className)}>
      <div aria-hidden className="absolute inset-0 -z-10 bg-ambient" />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-72 bg-imigongo-fade text-link opacity-[0.05]"
      />
      <div
        className={cn(
          "container-page flex flex-col",
          compact ? "gap-3 pt-7 pb-6 sm:pt-9 sm:pb-7" : "gap-4 pt-10 pb-10 sm:pt-14 sm:pb-12",
          center && "items-center text-center",
        )}
      >
        {icon && (
          <span className="mb-1 inline-flex size-16 animate-pop items-center justify-center rounded-[1.4rem] bg-[linear-gradient(140deg,var(--primary),color-mix(in_oklch,var(--primary)_65%,var(--sky)))] text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_14px_28px_-14px_oklch(0.45_0.2_264/0.65)] [&_svg]:size-8">
            {icon}
          </span>
        )}
        {eyebrow && (
          <span className="inline-flex w-fit animate-rise items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-soft-foreground">
            <span className="relative flex size-1.5" aria-hidden>
              <span className="absolute inset-0 animate-ping rounded-full bg-ember/70" />
              <span className="relative size-1.5 rounded-full bg-ember" />
            </span>
            {eyebrow}
          </span>
        )}
        <div className={cn("flex flex-col gap-2", center && "items-center")}>
          <h1
            className={cn(
              "animate-rise leading-[1.08] font-bold tracking-[-0.02em] text-balance",
              compact
                ? "text-[clamp(1.6rem,1.2rem+1.4vw,2.3rem)]"
                : "text-[clamp(1.9rem,1.3rem+2vw,3rem)]",
            )}
            style={{ animationDelay: "60ms" }}
          >
            {title}
          </h1>
          <SketchUnderline
            className={compact ? "h-2 w-24 sm:h-2.5 sm:w-28" : "h-2.5 w-32 sm:h-3 sm:w-40"}
          />
        </div>
        {description && (
          <p
            className={cn(
              "max-w-2xl animate-rise text-muted-foreground",
              compact ? "text-sm sm:text-base" : "text-base sm:text-lg",
            )}
            style={{ animationDelay: "120ms" }}
          >
            {description}
          </p>
        )}
        {children && (
          <div
            className={cn("mt-2 flex w-full animate-rise flex-col gap-4", center && "items-center")}
            style={{ animationDelay: "180ms" }}
          >
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
