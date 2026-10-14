"use client";

import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Crown,
  GraduationCap,
  Handshake,
  Home,
  Hourglass,
  Key,
  PenLine,
  Star,
  UserCheck,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "@/components/icons";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  CATEGORY_INFO,
  CATEGORY_REQUIREMENTS,
  type Category,
  type CategoryTier,
} from "@rebp/contracts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The full requirements dialog loads on first use (NFR-PERF-005).
const CategoryDetailDialog = dynamic(() => import("./category-detail"), { ssr: false });

/** Tour order, entry to firm (SRS §3.1). */
const ORDER: Category[] = [
  "RERA",
  "FSLA",
  "REA",
  "BROKER",
  "ASSOCIATE_BROKER",
  "MANAGING_BROKER",
  "PRINCIPAL_BROKER",
  "REBF",
];

const ICON: Record<Category, LucideIcon> = {
  RERA: Handshake,
  FSLA: Key,
  REA: Home,
  BROKER: Star,
  ASSOCIATE_BROKER: Users,
  MANAGING_BROKER: UserCog,
  PRINCIPAL_BROKER: Crown,
  REBF: Building2,
};

/** One colour per tier: sky to blue as you climb, Ember for the firm. */
const TIER_TONE: Record<
  CategoryTier,
  { node: string; solid: string; active: string; wash: string }
> = {
  entry: {
    node: "text-sky",
    solid: "bg-sky text-white",
    active: "bg-sky! text-white",
    wash: "bg-sky/10 text-sky",
  },
  agent: {
    node: "text-link",
    solid: "bg-primary text-primary-foreground",
    active: "bg-primary! text-primary-foreground",
    wash: "bg-primary/[0.07] text-link",
  },
  broker: {
    node: "text-link",
    solid: "bg-primary text-primary-foreground",
    active: "bg-primary! text-primary-foreground",
    wash: "bg-primary/[0.07] text-link",
  },
  firm: {
    node: "text-ember-text",
    solid: "bg-ember text-white",
    active: "bg-ember! text-white",
    wash: "bg-ember/10 text-ember-text",
  },
};

type Point = { x: number; y: number };
type Zone = { tier: CategoryTier; from: number; to: number };
type Layout = {
  w: number;
  h: number;
  vertical: boolean;
  at: Record<Category, Point>;
  zones: Zone[];
};

/** Desktop (lg+): a climb from bottom-left to top-right, with room for large stations. */
const WIDE: Layout = {
  w: 1000,
  h: 430,
  vertical: false,
  at: {
    RERA: { x: 80, y: 345 },
    FSLA: { x: 215, y: 270 },
    REA: { x: 390, y: 220 },
    BROKER: { x: 570, y: 180 },
    ASSOCIATE_BROKER: { x: 745, y: 330 },
    MANAGING_BROKER: { x: 760, y: 205 },
    PRINCIPAL_BROKER: { x: 775, y: 80 },
    REBF: { x: 925, y: 80 },
  },
  zones: [
    { tier: "entry", from: 0, to: 0.3 },
    { tier: "agent", from: 0.3, to: 0.48 },
    { tier: "broker", from: 0.48, to: 0.85 },
    { tier: "firm", from: 0.85, to: 1 },
  ],
};

/** Tablets and phones: the same route, read top to bottom. */
const TALL: Layout = {
  w: 360,
  h: 760,
  vertical: true,
  at: {
    RERA: { x: 90, y: 70 },
    FSLA: { x: 270, y: 115 },
    REA: { x: 180, y: 255 },
    BROKER: { x: 180, y: 400 },
    ASSOCIATE_BROKER: { x: 62, y: 550 },
    MANAGING_BROKER: { x: 180, y: 580 },
    PRINCIPAL_BROKER: { x: 298, y: 550 },
    REBF: { x: 298, y: 705 },
  },
  zones: [
    { tier: "entry", from: 0, to: 0.24 },
    { tier: "agent", from: 0.24, to: 0.43 },
    { tier: "broker", from: 0.43, to: 0.85 },
    { tier: "firm", from: 0.85, to: 1 },
  ],
};

/**
 * How categories connect (SRS §3.1): RERA is an optional entry beside FSLA; REA needs three
 * years as FSLA, Broker three years as REA; the three broker roles branch from Broker; the
 * Principal Broker leads the firm.
 */
const EDGES: { from: Category; to: Category; years?: number; optional?: boolean }[] = [
  { from: "RERA", to: "FSLA", optional: true },
  { from: "FSLA", to: "REA", years: 3 },
  { from: "REA", to: "BROKER", years: 3 },
  { from: "BROKER", to: "ASSOCIATE_BROKER" },
  { from: "BROKER", to: "MANAGING_BROKER" },
  { from: "BROKER", to: "PRINCIPAL_BROKER" },
  { from: "PRINCIPAL_BROKER", to: "REBF" },
];
/** The route the travelling light follows. */
const ROUTE: Category[] = ["FSLA", "REA", "BROKER", "PRINCIPAL_BROKER", "REBF"];

const PARENT: Partial<Record<Category, Category>> = Object.fromEntries(
  EDGES.filter((e) => !e.optional).map((e) => [e.to, e.from]),
);

const curve = (a: Point, b: Point, vertical: boolean) => {
  if (vertical) {
    const my = (a.y + b.y) / 2;
    return `C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
  }
  const mx = (a.x + b.x) / 2;
  return `C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
};
const edgePath = (layout: Layout, from: Category, to: Category) =>
  `M ${layout.at[from].x} ${layout.at[from].y} ${curve(layout.at[from], layout.at[to], layout.vertical)}`;
const routePath = (layout: Layout) =>
  ROUTE.slice(1).reduce(
    (d, to, i) => `${d} ${curve(layout.at[ROUTE[i]!], layout.at[to], layout.vertical)}`,
    `M ${layout.at[ROUTE[0]!].x} ${layout.at[ROUTE[0]!].y}`,
  );

/** The edges on the way to a category, so its whole path lights up. */
function pathTo(category: Category) {
  const lit = new Set<string>();
  let node: Category | undefined = category;
  while (node && PARENT[node]) {
    lit.add(`${PARENT[node]}-${node}`);
    node = PARENT[node];
  }
  return lit;
}

/** How long the guided tour rests on each station. */
const STEP_MS = 4200;

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/**
 * The eight categories as a career map (FR-PORTAL-007): large glossy stations, each with a
 * short label, on a climbing route through four zones, with the real branches and "3 yrs"
 * markers. Horizontal from lg (the branch reads as a climb and fits one screen); vertical below.
 *
 * A guided tour walks the stations on a loop; the selected one is unmistakable (it grows,
 * fills with its tier colour, a light ring orbits it, rings pulse out, its label becomes a "you
 * are here" pill, and its path glows and flows). Clicking a station opens its details (an
 * anchored glass popover on desktop, a docked sheet below lg); clicking it again, the close
 * button, anywhere outside or Escape closes them. The tour pauses while the pointer is over the
 * map or details are open. Reduced motion: no tour or travelling light.
 */
export function CategoryMap({ className }: { className?: string }) {
  const tc = useTranslations("categories");
  const [active, setActive] = useState<Category>("FSLA");
  const [open, setOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [seen, setSeen] = useState(false);
  const [dialog, setDialog] = useState<Category | null>(null);
  const [dialogLoaded, setDialogLoaded] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => true,
  );
  const touring = !reduced && !open && !hovering && onScreen;

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      setOnScreen(!!entry?.isIntersecting);
      if (entry?.isIntersecting) setSeen(true);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Open details close on Escape or a click anywhere outside them and the stations.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!target.closest("[data-map-details], [data-map-station], [role=dialog]")) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const next = () => setActive((c) => ORDER[(ORDER.indexOf(c) + 1) % ORDER.length]!);
  /** Click a station: open its details, or close them if they are already showing it. */
  const toggle = (category: Category) => {
    if (category === active && open) return setOpen(false);
    setActive(category);
    setOpen(true);
  };
  const openDialog = (category: Category) => {
    setDialogLoaded(true);
    setDialog(category);
  };
  const close = () => setOpen(false);

  const layer = {
    active,
    open,
    lit: pathTo(active),
    reduced,
    seen,
    onToggle: toggle,
    label: (c: Category) => tc(`items.${c}.name`),
    short: (c: Category) => tc(`short.${c}`),
    tierLabel: (tier: CategoryTier) => tc(`tiers.${tier}`),
  };

  return (
    <div
      ref={root}
      data-loop
      className={cn("mx-auto flex w-full max-w-[32rem] flex-col gap-4 lg:max-w-none", className)}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
    >
      <div className="relative rounded-[2rem] bg-surface-2 dark:bg-white/[0.025]">
        <div
          aria-hidden
          className="absolute inset-0 overflow-hidden rounded-[2rem] opacity-70 bg-ambient dark:opacity-50"
        />
        <MapLayer
          {...layer}
          layout={WIDE}
          className="hidden aspect-[1000/430] lg:block"
          popover={
            <Details category={active} onRequirements={openDialog} onClose={close} anchored />
          }
        />
        <MapLayer {...layer} layout={TALL} className="aspect-[360/760] w-full lg:hidden" />
      </div>

      {/* Tour progress: one story bar per station; each is also a shortcut to it. */}
      <div className="flex gap-1.5" aria-hidden>
        {ORDER.map((category, index) => {
          const position = ORDER.indexOf(active);
          return (
            <button
              key={category}
              type="button"
              tabIndex={-1}
              onClick={() => setActive(category)}
              className="group relative h-6 flex-1"
            >
              <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-foreground/10 transition-[height] group-hover:h-1.5">
                {index < position && <span className="absolute inset-0 bg-primary/60" />}
                {index === position && (
                  <span
                    key={`${active}-${touring}`}
                    className={cn(
                      "absolute inset-0 origin-left bg-primary",
                      touring && "animate-guide-fill",
                    )}
                    style={
                      touring
                        ? { animationDuration: `${STEP_MS}ms`, animationTimingFunction: "linear" }
                        : undefined
                    }
                    onAnimationEnd={next}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Below lg the details dock to the bottom of the screen (a bottom sheet). */}
      {open && (
        <div className="sticky bottom-3 z-30 lg:hidden">
          <Details category={active} onRequirements={openDialog} onClose={close} />
        </div>
      )}

      {dialogLoaded && <CategoryDetailDialog category={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

/**
 * A station's details: a tinted header (icon, section and tier, title, close button), one line,
 * what it needs as icon pills and the two shortcuts. `anchored` is the desktop popover;
 * otherwise the docked sheet used below lg. Both are frosted glass.
 */
function Details({
  category,
  onRequirements,
  onClose,
  anchored = false,
}: {
  category: Category;
  onRequirements: (category: Category) => void;
  onClose: () => void;
  anchored?: boolean;
}) {
  const tc = useTranslations("categories");
  const tm = useTranslations("landing.map");
  const info = CATEGORY_INFO[category];
  const Icon = ICON[category];
  return (
    <div
      key={category}
      data-map-details
      role="dialog"
      aria-modal="false"
      aria-labelledby={`map-details-${category}${anchored ? "-wide" : ""}`}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-3xl",
        anchored ? "animate-popover-in" : "animate-rise",
        "bg-white/85 shadow-[inset_0_1px_0_rgb(255_255_255/0.8),inset_0_0_0_1px_rgb(255_255_255/0.5),0_24px_48px_-18px_oklch(0.3_0.12_264/0.5)] backdrop-blur-2xl backdrop-saturate-150",
        "dark:bg-[oklch(0.2_0.025_265/0.9)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.07),0_24px_52px_-18px_rgb(0_0_0/0.9)]",
      )}
    >
      {/* Header: a soft wash in the tier colour with the Imigongo motif. */}
      <div className={cn("relative flex items-start gap-3 p-4 pb-3", TIER_TONE[info.tier].wash)}>
        <div aria-hidden className="absolute inset-0 bg-imigongo text-current opacity-[0.06]" />
        <span
          className={cn(
            "relative inline-flex size-12 shrink-0 animate-pop items-center justify-center rounded-2xl shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]",
            TIER_TONE[info.tier].solid,
          )}
        >
          <Icon filled className="size-6" aria-hidden />
        </span>
        <div className="relative flex min-w-0 flex-1 flex-col gap-0.5 pr-7">
          <span className="text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase">
            {info.section} · {tc(`tiers.${info.tier}`)}
          </span>
          <h3
            id={`map-details-${category}${anchored ? "-wide" : ""}`}
            className="text-base leading-tight font-semibold"
          >
            {tc(`items.${category}.name`)}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={tm("close")}
          className="absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-[background-color,color,transform] duration-(--dur-2) hover:rotate-90 hover:bg-foreground/[0.08] hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex flex-col gap-3 p-4 pt-3">
        <p className="text-sm leading-snug text-muted-foreground">
          {tc(`items.${category}.summary`)}
        </p>
        <Needs category={category} />
        <div className="flex gap-2 pt-1">
          <Button asChild size="sm" className="flex-1 rounded-full">
            <Link href="/eligibility">
              {tm("eligible")} <ArrowRight />
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full text-link"
            onClick={() => onRequirements(category)}
          >
            {tm("requirements")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** What a category needs, as icon pills that pop in one by one. */
function Needs({ category }: { category: Category }) {
  const t = useTranslations("ladder.req");
  const r = CATEGORY_REQUIREMENTS[category];
  const items = [
    r.education && { icon: GraduationCap, label: t("education") },
    r.experience && {
      icon: Hourglass,
      label: `${t("experienceShort", { years: r.experience.years })} · ${CATEGORY_INFO[r.experience.as].section}`,
    },
    r.exam && { icon: PenLine, label: t("exam") },
    r.prerequisite && {
      icon: BadgeCheck,
      label: `${t("licenceShort")} · ${CATEGORY_INFO[r.prerequisite].section}`,
    },
    r.supervised && { icon: UserCheck, label: t("supervised") },
  ].filter(Boolean) as { icon: LucideIcon; label: string }[];
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map(({ icon: Icon, label }, index) => (
        <li
          key={label}
          className="inline-flex animate-pop items-center gap-1.5 rounded-full bg-primary-soft/70 py-0.5 pr-2.5 pl-0.5 text-xs font-semibold dark:bg-white/[0.06]"
          style={{ animationDelay: `${120 + index * 60}ms` }}
        >
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-card text-link dark:bg-white/[0.08]">
            <Icon className="size-3" aria-hidden />
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}

/** One rendering of the map (wide or tall): zones, edges, the travelling light and stations. */
function MapLayer({
  layout,
  className,
  active,
  open,
  lit,
  reduced,
  seen,
  popover,
  onToggle,
  label,
  short,
  tierLabel,
}: {
  layout: Layout;
  className?: string;
  active: Category;
  open: boolean;
  lit: Set<string>;
  reduced: boolean;
  seen: boolean;
  popover?: React.ReactNode;
  onToggle: (category: Category) => void;
  label: (category: Category) => string;
  short: (category: Category) => string;
  tierLabel: (tier: CategoryTier) => string;
}) {
  const tl = useTranslations("ladder.req");
  const { w, h, vertical, at, zones } = layout;
  const pct = (p: Point) => ({ left: `${(p.x / w) * 100}%`, top: `${(p.y / h) * 100}%` });
  const activeTier = CATEGORY_INFO[active].tier;
  const here = at[active];
  const below = here.y < h * 0.5;

  return (
    <div className={cn("relative", className)}>
      {/* Zones: faint bands with their names; the selected station's zone brightens. */}
      <div aria-hidden className="absolute inset-0 overflow-hidden rounded-[2rem]">
        {zones.map(({ tier, from, to }, index) => (
          <div
            key={tier}
            className={cn(
              "absolute flex p-4 transition-colors duration-700",
              vertical ? "inset-x-0 items-start justify-end" : "inset-y-0 items-end justify-start",
              index % 2 ? "bg-foreground/[0.02] dark:bg-white/[0.015]" : "bg-transparent",
              tier === activeTier && "bg-primary/[0.06] dark:bg-primary/[0.09]",
            )}
            style={
              vertical
                ? { top: `${from * 100}%`, height: `${(to - from) * 100}%` }
                : { left: `${from * 100}%`, width: `${(to - from) * 100}%` }
            }
          >
            <span
              className={cn(
                "text-xs font-bold tracking-widest uppercase transition-colors",
                tier === activeTier ? "text-link" : "text-muted-foreground/70",
              )}
            >
              {tierLabel(tier)}
            </span>
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} aria-hidden className="absolute inset-0 size-full">
        {EDGES.map(({ from, to, optional }, index) => {
          const on = lit.has(`${from}-${to}`) || (to === active && optional);
          const d = edgePath(layout, from, to);
          return (
            <g key={`${from}-${to}`}>
              {/* Each road draws itself in the first time the map is seen. */}
              <path
                d={d}
                fill="none"
                strokeWidth="2.5"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={optional ? "1.5 4" : "100"}
                className={cn(
                  "stroke-foreground/15 dark:stroke-white/15",
                  !optional && (seen ? "animate-draw" : "opacity-0"),
                )}
                style={{ animationDelay: `${index * 140}ms`, animationDuration: "900ms" }}
              />
              {on && (
                <>
                  <path
                    d={d}
                    fill="none"
                    strokeWidth="10"
                    strokeLinecap="round"
                    className="stroke-primary/15"
                  />
                  <path
                    d={d}
                    fill="none"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray="10 12"
                    className="animate-edge-flow stroke-link"
                  />
                </>
              )}
            </g>
          );
        })}
        {/* The travelling light: a Sun comet with a short trail, looping the main route. */}
        {!reduced &&
          [0, 0.1, 0.2, 0.3].map((lag, i) => (
            <circle
              key={lag}
              r={7 - i * 1.6}
              className="fill-sun"
              opacity={1 - i * 0.25}
              style={{ filter: "drop-shadow(0 0 8px var(--sun))" }}
            >
              <animateMotion
                dur="10s"
                begin={`-${lag * 10}s`}
                repeatCount="indefinite"
                path={routePath(layout)}
              />
            </circle>
          ))}
      </svg>

      {/* "3 yrs" markers where experience is needed. */}
      {EDGES.filter((e) => e.years).map(({ from, to, years }) => {
        const mid = { x: (at[from].x + at[to].x) / 2, y: (at[from].y + at[to].y) / 2 };
        return (
          <span
            key={`${from}-${to}-years`}
            aria-hidden
            className="absolute inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[0.7rem] font-bold text-muted-foreground shadow-[0_2px_6px_-2px_oklch(0.3_0.1_264/0.25)] dark:bg-[oklch(0.22_0.02_265)] dark:shadow-none"
            style={pct(mid)}
          >
            <Hourglass className="size-3" />
            {tl("experienceShort", { years: years! })}
          </span>
        );
      })}

      {ORDER.map((category) => {
        const info = CATEGORY_INFO[category];
        const Icon = ICON[category];
        const on = category === active;
        return (
          // The wrapper's centre is the route point: the icon sits on the line exactly.
          <div
            key={category}
            className={cn("absolute -translate-x-1/2 -translate-y-1/2", on ? "z-20" : "z-10")}
            style={pct(at[category])}
          >
            <button
              type="button"
              data-map-station
              aria-label={label(category)}
              aria-expanded={on && open}
              onClick={() => onToggle(category)}
              className={cn(
                "group relative grid size-12 place-items-center rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:size-14 lg:size-16",
                on && !reduced && "animate-station-select",
              )}
            >
              {/* Selected: a light orbits the station and rings pulse out from it. */}
              {on && (
                <>
                  <span
                    aria-hidden
                    className="absolute -inset-1.5 animate-[spin_3s_linear_infinite] rounded-[1.35rem] bg-[conic-gradient(from_0deg,transparent_0_55%,var(--sky)_75%,var(--sun)_92%,transparent)] p-[2.5px] [mask:linear-gradient(#000_0_0)_content-box_exclude,linear-gradient(#000_0_0)]"
                  />
                  <span
                    aria-hidden
                    className="absolute -inset-3 animate-pulse-ring rounded-[1.6rem] text-primary"
                  />
                </>
              )}
              {/* The card: glossy tile, hairline light edge, soft lift. */}
              <span
                className={cn(
                  "relative grid size-full place-items-center overflow-hidden rounded-2xl transition-[transform,background-color,color,box-shadow] duration-(--dur-4) ease-spring group-hover:-translate-y-0.5 group-hover:scale-105",
                  on
                    ? cn(
                        TIER_TONE[info.tier].active,
                        "scale-[1.15] shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_10px_24px_-8px_oklch(0.45_0.2_264/0.6)]",
                      )
                    : cn(
                        "bg-card shadow-[inset_0_1px_0_rgb(255_255_255/0.9),inset_0_0_0_1px_oklch(0.5_0.05_264/0.08),0_8px_20px_-8px_oklch(0.3_0.12_264/0.4)] dark:bg-[linear-gradient(160deg,oklch(0.27_0.025_265),oklch(0.2_0.02_265))] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_10px_24px_-8px_rgb(0_0_0/0.85)]",
                        TIER_TONE[info.tier].node,
                      ),
                )}
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/25 to-transparent"
                />
                <Icon filled={on} className="relative size-5 sm:size-6 lg:size-7" aria-hidden />
              </span>
            </button>
            {/* Short label below the icon: plain for the others, a "you are here" pill when selected. */}
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-full left-1/2 mt-2.5 inline-flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap transition-[background-color,color] duration-(--dur-3) sm:text-xs",
                on ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <span className="font-mono">{info.section}</span>
              {short(category)}
            </span>
          </div>
        );
      })}

      {/* Desktop popover: opens on click, anchored to the station, flipping above or below. */}
      {popover && open && (
        <>
          <span
            aria-hidden
            className={cn(
              "absolute z-30 size-3.5 -translate-x-1/2 rotate-45 rounded-[3px] bg-white/85 backdrop-blur-2xl dark:bg-[oklch(0.2_0.025_265/0.9)]",
            )}
            style={{
              left: `${(here.x / w) * 100}%`,
              ...(below
                ? { top: `calc(${(here.y / h) * 100}% + 4.25rem - 0.4rem)` }
                : { bottom: `calc(${100 - (here.y / h) * 100}% + 3rem - 0.4rem)` }),
            }}
          />
          <div
            className="absolute z-30 w-76 -translate-x-1/2"
            style={{
              left: `clamp(10rem, ${(here.x / w) * 100}%, calc(100% - 10rem))`,
              transformOrigin: below ? "top center" : "bottom center",
              ...(below
                ? { top: `calc(${(here.y / h) * 100}% + 4.25rem)` }
                : { bottom: `calc(${100 - (here.y / h) * 100}% + 3rem)` }),
            }}
          >
            {popover}
          </div>
        </>
      )}
    </div>
  );
}
