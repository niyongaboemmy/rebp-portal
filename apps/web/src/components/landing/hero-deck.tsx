"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CardChip, Contactless } from "@/components/licence/card-chip";
import { parallaxStyle } from "@/components/motion/parallax";
import { EligibilityPerson } from "@/components/eligibility/eligibility-person";
import { cn } from "@/lib/utils";

/** One round: deal in, rest, deal out. Each card starts DEAL_MS after the one beneath it. */
const ROUND_MS = 9000;
/** Before each deal: a person wonders (ASK_MS), does the check on a laptop (WORK_MS), cheers. */
const ASK_MS = 2400;
const WORK_MS = 2600;
const CHEER_MS = 1500;
const DEAL_MS = 380;

/**
 * Back cards, back to front, in the brand's three colours (Sun, sky blue, Ember) under the
 * brand-blue licence. Each is a mini licence: logo mark, category, gold chip, contactless mark,
 * number and holder lines, over the Imigongo motif and a soft light from the top corner.
 * `depth` scales the fan offsets and shrinks the card.
 */
const STACK = [
  {
    depth: 3,
    code: "G1",
    number: "RL-2026-000087",
    surface:
      "bg-[linear-gradient(140deg,oklch(0.92_0.12_95),oklch(0.83_0.16_82)_55%,oklch(0.76_0.16_68))] dark:bg-[linear-gradient(140deg,oklch(0.84_0.12_92),oklch(0.74_0.14_78)_55%,oklch(0.64_0.13_64))]",
    ink: "text-[oklch(0.32_0.07_60)]",
  },
  {
    depth: 2,
    code: "G4",
    number: "RL-2026-000104",
    surface:
      "bg-[linear-gradient(140deg,oklch(0.8_0.11_230),oklch(0.66_0.15_245)_55%,oklch(0.55_0.18_258))] dark:bg-[linear-gradient(140deg,oklch(0.7_0.12_232),oklch(0.56_0.15_248)_55%,oklch(0.44_0.16_260))]",
    ink: "text-white",
  },
  {
    depth: 1,
    code: "G6",
    number: "RL-2026-000118",
    surface:
      "bg-[linear-gradient(140deg,oklch(0.8_0.14_62),oklch(0.69_0.18_48)_55%,oklch(0.58_0.18_38))] dark:bg-[linear-gradient(140deg,oklch(0.72_0.14_58),oklch(0.6_0.16_45)_55%,oklch(0.48_0.15_36))]",
    ink: "text-white",
  },
] as const;

/**
 * Ten directed entries (a card's start and exit pose). They join the random pool with a random
 * twist added, so even these never repeat exactly. Landing (overshoot, settle) is shared.
 */
const DEALS = [
  {
    from: "translate3d(8%,-60%,0) rotate(-14deg) rotateX(50deg) scale(1.06)",
    out: "translate3d(22%,-28%,0) rotate(9deg) rotateX(-18deg) scale(.96)",
  }, // flip down
  { from: "translate3d(-85%,-10%,0) rotate(-22deg)", out: "translate3d(85%,-6%,0) rotate(16deg)" }, // slide from left
  { from: "translate3d(85%,-10%,0) rotate(20deg)", out: "translate3d(-85%,-6%,0) rotate(-16deg)" }, // slide from right
  {
    from: "translate3d(0,70%,0) rotateX(-45deg) scale(.95)",
    out: "translate3d(0,-60%,0) rotateX(35deg) scale(.95)",
  }, // rise from below
  { from: "scale(.45) rotate(-8deg)", out: "scale(1.2)" }, // zoom from afar
  { from: "rotate(-200deg) scale(.55)", out: "rotate(160deg) scale(.6)" }, // spin in
  { from: "rotateY(-95deg) translate3d(-20%,0,0)", out: "rotateY(95deg) translate3d(20%,0,0)" }, // turn on its edge
  { from: "translate3d(0,-110%,0)", out: "translate3d(0,110%,0)" }, // straight drop
  { from: "translate3d(-60%,-70%,0) rotate(-38deg)", out: "translate3d(60%,70%,0) rotate(30deg)" }, // swing from top-left
  {
    from: "translate3d(70%,-75%,0) rotate(32deg) rotateX(30deg)",
    out: "translate3d(-60%,-70%,0) rotate(-26deg)",
  }, // toss from top-right
] as const;

/**
 * Real-card depth, per theme: a glossy top-edge highlight, a tight contact shadow at the edge,
 * a mid shadow for thickness and a wide soft one for lift (navy-tinted on light surfaces, deep
 * black on dark ones).
 */
const CARD_SHADOW =
  "shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_1px_1px_oklch(0.25_0.1_264/0.22),0_4px_8px_-2px_oklch(0.25_0.1_264/0.22),0_18px_36px_-12px_oklch(0.25_0.12_264/0.5)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_1px_1px_rgb(0_0_0/0.6),0_4px_10px_-2px_rgb(0_0_0/0.6),0_22px_44px_-12px_rgb(0_0_0/0.9)]";

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** Small seeded PRNG: the same round always scatters the same way (stable across renders). */
const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (rand: () => number, min: number, max: number) =>
  Math.round((min + rand() * (max - min)) * 10) / 10;

type Pose = { from: string; out: string };

/**
 * Five unorganised deal styles: every card gets its own random entry and exit, and the back
 * cards land in a loose pile instead of a fan.
 * - rain: falls from a random point above, twisting
 * - burst: flies in from a different edge each, alternating sides
 * - tumble: spins in hard, clockwise or not, from close by
 * - toss: thrown up from below-left or below-right
 * - swirl: arrives from a random angle on a circle around the deck
 */
const SCATTERS: ((rand: () => number, index: number) => Pose)[] = [
  (r) => ({
    from: `translate3d(${between(r, -40, 40)}%,-120%,0) rotate(${between(r, -45, 45)}deg)`,
    out: `translate3d(${between(r, -40, 40)}%,120%,0) rotate(${between(r, -45, 45)}deg)`,
  }),
  (r, i) => {
    const side = i % 2 ? 1 : -1;
    return {
      from: `translate3d(${side * 110}%,${between(r, -50, 50)}%,0) rotate(${side * between(r, 15, 40)}deg)`,
      out: `translate3d(${-side * 110}%,${between(r, -50, 50)}%,0) rotate(${-side * between(r, 15, 40)}deg)`,
    };
  },
  (r) => {
    const spin = r() > 0.5 ? 1 : -1;
    return {
      from: `translate3d(${between(r, -25, 25)}%,${between(r, -25, 25)}%,0) rotate(${spin * between(r, 240, 420)}deg) scale(.5)`,
      out: `rotate(${-spin * between(r, 180, 300)}deg) scale(.5)`,
    };
  },
  (r, i) => {
    const side = i % 2 ? 1 : -1;
    return {
      from: `translate3d(${side * between(r, 50, 90)}%,90%,0) rotate(${side * between(r, 30, 70)}deg) rotateX(-30deg)`,
      out: `translate3d(${-side * between(r, 50, 90)}%,-90%,0) rotate(${-side * between(r, 30, 70)}deg)`,
    };
  },
  (r) => {
    const angle = r() * Math.PI * 2;
    const x = Math.round(Math.cos(angle) * 110);
    const y = Math.round(Math.sin(angle) * 90);
    return {
      from: `translate3d(${x}%,${y}%,0) rotate(${between(r, -90, 90)}deg) scale(.8)`,
      out: `translate3d(${-x}%,${-y}%,0) rotate(${between(r, -90, 90)}deg) scale(.8)`,
    };
  },
];

/** Every card picks its own entry from the pool: five scatters, or a directed entry with a twist. */
const poseFor = (round: number, index: number): Pose => {
  const rand = random(round * 977 + index * 131 + 7);
  const pick = Math.floor(rand() * (SCATTERS.length + DEALS.length));
  if (pick < SCATTERS.length) return SCATTERS[pick]!(rand, index);
  const directed = DEALS[pick - SCATTERS.length]!;
  const twist = between(rand, -25, 25);
  return {
    from: `${directed.from} rotate(${twist}deg)`,
    out: `${directed.out} rotate(${-twist}deg)`,
  };
};

const deal = (round: number, index: number): React.CSSProperties => {
  const pose = poseFor(round, index);
  return {
    animationDuration: `${ROUND_MS}ms`,
    animationDelay: `${index * DEAL_MS}ms`,
    ["--deal-from" as string]: `perspective(900px) ${pose.from}`,
    ["--deal-out" as string]: `perspective(900px) ${pose.out}`,
  };
};

/**
 * Where a back card rests: a loose, artful pile, new every round. Deeper cards may stray
 * further; all stay mostly behind the licence. Round 0 (server render, reduced motion) is
 * seeded too, so the first paint is already "thrown".
 */
const restFor = (round: number, depth: number) => {
  const r = random(round * 523 + depth * 71);
  if (depth === 0) return `rotate(${between(r, -5, 5)}deg)`; // the licence: a slight tilt, still readable
  const reach = 8 + depth * 6;
  const side = r() > 0.5 ? 1 : -1; // piles lean left or right, a new way each round
  return `translate3d(${side * between(r, 4, reach)}%, ${between(r, -reach - 4, reach - 6)}%, 0) rotate(${side * between(r, 6, 10 + depth * 7)}deg) scale(${1 - depth * 0.05})`;
};

/**
 * Hero deck (landing): four blue cards, light at the back to the deep licence on top, dealt
 * every round in an unorganised way: each card takes its own random entry (five scatters, or one
 * of ten directed entries with a random twist) and the back cards land in a new loose pile; a soft glow blooms when the licence lands, the two notifications slide in, then the
 * cards deal out and the next round begins. Cards carry a small contact shadow so they read as
 * real objects. The pointer tilts the deck (HeroScene --px/--py). Reduced motion: one still fan.
 */
export function HeroDeck({
  licence,
  verified,
  issued,
  question,
  checking,
  yes,
}: {
  licence: React.ReactNode;
  verified: React.ReactNode;
  issued: React.ReactNode;
  /** "Am I eligible?" shown under the wondering person. */
  question: string;
  /** "Checking my eligibility…" while at the laptop. */
  checking: string;
  /** "Yes, you can apply!" when they cheer. */
  yes: string;
}) {
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<"ask" | "work" | "cheer" | "deal">("ask");
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );

  // ask (wondering) → work (the check on a laptop) → cheer (it's a yes) → deal → next round.
  useEffect(() => {
    if (reduced) return;
    const id = setTimeout(
      () => {
        if (phase === "ask") setPhase("work");
        else if (phase === "work") setPhase("cheer");
        else if (phase === "cheer") setPhase("deal");
        else {
          setPhase("ask");
          setRound((r) => r + 1);
        }
      },
      phase === "ask"
        ? ASK_MS
        : phase === "work"
          ? WORK_MS
          : phase === "cheer"
            ? CHEER_MS
            : ROUND_MS,
    );
    return () => clearTimeout(id);
  }, [phase, reduced]);
  const dealing = reduced || phase === "deal";
  // One person per round, in turn: a woman, a man, a woman with an afro and glasses.
  const gender = (["female", "male", "afro"] as const)[round % 3]!;

  const front = STACK.length * DEAL_MS;
  const note = (delay: number): React.CSSProperties => ({
    animationDuration: `${ROUND_MS}ms`,
    animationDelay: `${front + delay}ms`,
  });

  return (
    <>
      {/* The question before the cards: one of three people (in turn) wondering. */}
      {!dealing && (
        <div
          key={`ask-${round}`}
          aria-hidden
          data-loop
          className={cn(
            "absolute inset-0 z-10 flex flex-col items-center justify-center gap-2",
            phase === "cheer"
              ? "animate-[ask-out_1500ms_var(--ease-standard)_both]"
              : "animate-pop",
          )}
        >
          <EligibilityPerson
            key={`${phase}-${gender}`}
            mood={phase === "cheer" ? "happy" : phase === "work" ? "working" : "thinking"}
            gender={gender}
            className="w-[112%] max-w-[32rem] animate-pop sm:-mt-10 sm:w-[118%]"
          />
          <span className="rounded-full bg-white/60 px-3.5 py-1.5 text-sm font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_8px_24px_-12px_oklch(0.3_0.12_264/0.35)] backdrop-blur-xl dark:bg-[oklch(0.2_0.03_265/0.62)]">
            {phase === "cheer" ? yes : phase === "work" ? checking : question}
          </span>
        </div>
      )}
      <div
        data-loop
        className={cn(
          "relative z-0 transition-opacity duration-300 [transform-style:preserve-3d]",
          !dealing && "invisible opacity-0",
        )}
        style={{
          transform: "rotateY(calc(var(--px) * 9deg)) rotateX(calc(var(--py) * -7deg))",
          transition: "transform 500ms cubic-bezier(0.2, 0, 0, 1)",
        }}
      >
        <div className="relative animate-card-drift">
          {/* Landing glow: blooms under the deck as the licence settles. */}
          <span
            key={`glow-${round}-${dealing}`}
            aria-hidden
            className="absolute inset-[8%] -z-10 animate-deal-glow rounded-[2rem] bg-primary/40 blur-3xl motion-reduce:hidden"
            style={note(400)}
          />
          {STACK.map((card, index) => (
            <div
              key={`${round}-${card.depth}-${dealing}`}
              aria-hidden
              className="absolute inset-0 transition-transform duration-(--dur-3)"
              style={{ transform: restFor(round, card.depth) }}
            >
              <div
                className={cn(
                  "relative size-full animate-card-deal rounded-[1.75rem]",
                  CARD_SHADOW,
                  card.surface,
                )}
                style={deal(round, index)}
              >
                <div
                  className={cn(
                    "absolute inset-0 flex flex-col justify-between overflow-hidden rounded-[1.75rem] p-[6%]",
                    card.ink,
                  )}
                >
                  <div className="absolute inset-0 bg-imigongo opacity-[0.12]" />
                  <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_100%_0%,rgb(255_255_255/0.35),transparent_60%)] dark:opacity-50" />
                  <div className="relative flex items-start justify-between">
                    <span className="flex items-center gap-2">
                      <span className="inline-flex size-7 items-center justify-center rounded-lg bg-current/15">
                        <svg viewBox="0 0 32 32" className="size-4">
                          <path
                            d="M8 15.5 16 9l8 6.5V24a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z"
                            fill="currentColor"
                          />
                        </svg>
                      </span>
                      <span className="font-mono text-xs font-bold opacity-80">{card.code}</span>
                    </span>
                    <Contactless className="opacity-70" />
                  </div>
                  <CardChip className="relative" />
                  <div className="relative flex items-end justify-between gap-3">
                    <span className="flex flex-col gap-1.5">
                      <span className="h-2 w-24 rounded-full bg-current/30" />
                      <span className="font-mono text-[0.65rem] font-semibold tracking-wider opacity-75">
                        {card.number}
                      </span>
                    </span>
                    <span className="size-[16%] rounded-lg bg-current/15" />
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="relative" style={{ transform: restFor(round, 0) }}>
            <div
              key={`${round}-licence-${dealing}`}
              className={cn("relative animate-card-deal rounded-[1.75rem]", CARD_SHADOW)}
              style={deal(round, STACK.length)}
            >
              {licence}
            </div>
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className={cn("absolute top-0 left-0 z-20 sm:-left-6", !dealing && "invisible")}
        style={parallaxStyle(-14)}
      >
        <div
          key={`verified-${round}-${dealing}`}
          data-loop
          className="animate-notify-loop"
          style={note(800)}
        >
          {verified}
        </div>
      </div>
      <div
        aria-hidden
        className={cn(
          "absolute right-0 -bottom-4 z-20 sm:-right-6 sm:bottom-1",
          !dealing && "invisible",
        )}
        style={parallaxStyle(-20)}
      >
        <div
          key={`issued-${round}-${dealing}`}
          data-loop
          className="animate-notify-loop"
          style={note(1200)}
        >
          {issued}
        </div>
      </div>
    </>
  );
}
