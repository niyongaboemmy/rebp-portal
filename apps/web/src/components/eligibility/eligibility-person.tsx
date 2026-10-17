import { cn } from "@/lib/utils";

export type PersonMood = "thinking" | "working" | "happy" | "hopeful";

const SKIN = "oklch(0.52 0.08 50)";
const SKIN_SHADE = "oklch(0.45 0.08 45)";
const HAIR = "oklch(0.22 0.03 40)";

/**
 * The eligibility check's companion (decorative): a young professional wondering "am I
 * eligible?". Thinking: hand on chin, head tilting, eyes blinking, thought bubbles rising with
 * a cycling "?", graduation cap and licence badge, small question marks drifting up. Happy (a
 * category was found): arms up, big smile, confetti and sparkles. Hopeful (not yet): a soft
 * smile, the bubble shows the next step. Everything loops; reduced motion holds still. Scales to
 * its container (viewBox), so it fits phones and desktop alike.
 */
export function EligibilityPerson({
  mood = "thinking",
  gender = "female",
  className,
  style,
}: {
  mood?: PersonMood;
  /**
   * Female: bun, fringe, earrings. Male: short crop, stubble, a tie. Afro: natural hair, round
   * glasses and an Ember blazer.
   */
  gender?: "female" | "male" | "afro";
  className?: string;
  style?: React.CSSProperties;
}) {
  const happy = mood === "happy";
  const working = mood === "working";
  const male = gender === "male";
  const afro = gender === "afro";
  /** Blazer colour: brand blue, or Ember for the third person. */
  const suit = afro ? "fill-ember" : "fill-primary";
  const sleeve = afro ? "stroke-ember" : "stroke-primary";
  return (
    <svg
      viewBox="0 0 220 200"
      aria-hidden
      data-loop
      data-mood={mood}
      style={style}
      className={cn("ep overflow-visible", className)}
    >
      {/* Backdrop: soft brand disc with an orbiting Sun dot. */}
      <circle cx="100" cy="112" r="78" className="fill-primary/[0.08] dark:fill-primary/[0.14]" />
      <circle
        cx="100"
        cy="112"
        r="88"
        fill="none"
        className="stroke-primary/20"
        strokeDasharray="2 6"
        strokeWidth="1.2"
      />
      <g className="ep-orbit">
        <circle cx="100" cy="24" r="4" className="fill-sun" />
      </g>
      <ellipse cx="100" cy="190" rx="48" ry="5" className="fill-foreground/10" />

      {/* Drifting question marks (thinking / hopeful). */}
      {!happy &&
        !working &&
        [
          { x: 52, y: 70, d: 0 },
          { x: 40, y: 104, d: 1.3 },
          { x: 58, y: 46, d: 2.6 },
        ].map((q) => (
          <text
            key={q.d}
            x={q.x}
            y={q.y}
            className="ep-q fill-primary text-[14px] font-bold"
            style={{ animationDelay: `${q.d}s` }}
          >
            ?
          </text>
        ))}

      {/* Confetti + sparkles (happy). */}
      {happy &&
        [
          { x: 34, c: "fill-sun", d: 0 },
          { x: 58, c: "fill-primary", d: 0.6 },
          { x: 150, c: "fill-ember", d: 0.3 },
          { x: 172, c: "fill-sky", d: 1.1 },
          { x: 128, c: "fill-sun", d: 1.6 },
          { x: 80, c: "fill-ember", d: 2 },
        ].map((p) => (
          <rect
            key={p.d}
            x={p.x}
            y="10"
            width="5"
            height="9"
            rx="1.5"
            className={cn("ep-confetti", p.c)}
            style={{ animationDelay: `${p.d}s` }}
          />
        ))}

      {/* The person: sways gently from the feet. */}
      <g className="ep-body">
        {/* Torso (blazer) with lapels. */}
        <path d="M60 192 C60 152 76 134 100 134 C124 134 140 152 140 192 Z" className={suit} />
        <path
          d="M100 136 L90 160 L100 190 L110 160 Z"
          className="fill-white/90 dark:fill-white/80"
        />
        {male ? (
          <path
            d="M97 140 L103 140 L101.5 146 L105 170 L100 178 L95 170 L98.5 146 Z"
            className="fill-sun"
          />
        ) : (
          <path d="M100 150 L96 158 L100 176 L104 158 Z" className="fill-sun" />
        )}
        {/* Neck. */}
        <rect x="92" y="118" width="16" height="20" rx="7" fill={SKIN_SHADE} />

        {/* Arms. */}
        {happy ? (
          <g className="ep-cheer">
            <path
              d="M72 148 Q58 124 60 100"
              fill="none"
              className={sleeve}
              strokeWidth="13"
              strokeLinecap="round"
            />
            <circle cx="60" cy="96" r="7" fill={SKIN} />
            <path
              d="M128 148 Q142 124 140 100"
              fill="none"
              className={sleeve}
              strokeWidth="13"
              strokeLinecap="round"
            />
            <circle cx="140" cy="96" r="7" fill={SKIN} />
          </g>
        ) : working ? (
          // Both forearms forward to the keyboard; the hands type.
          <g>
            <path
              d="M70 150 Q62 170 78 178"
              fill="none"
              className={sleeve}
              strokeWidth="13"
              strokeLinecap="round"
            />
            <path
              d="M130 150 Q138 170 122 178"
              fill="none"
              className={sleeve}
              strokeWidth="13"
              strokeLinecap="round"
            />
          </g>
        ) : (
          <>
            <path
              d="M72 148 Q64 166 70 184"
              fill="none"
              className={sleeve}
              strokeWidth="13"
              strokeLinecap="round"
            />
            <g className="ep-chin">
              <path
                d="M128 148 Q138 162 128 168"
                fill="none"
                className={sleeve}
                strokeWidth="13"
                strokeLinecap="round"
              />
              <path
                d="M128 168 Q122 142 112 126"
                fill="none"
                stroke={SKIN}
                strokeWidth="9"
                strokeLinecap="round"
              />
              <circle cx="111" cy="124" r="6.5" fill={SKIN} />
            </g>
          </>
        )}

        {/* Head: tilts while thinking, nods when happy. */}
        <g className="ep-head">
          {/* Hair back (+ bun, or a full afro). */}
          {afro ? (
            <circle cx="100" cy="88" r="36" fill={HAIR} />
          ) : male ? (
            <path d="M76 96 C74 78 86 70 100 70 C116 70 127 79 124 96 Z" fill={HAIR} />
          ) : (
            <>
              <circle cx="100" cy="64" r="11" fill={HAIR} />
              <path d="M72 104 C68 78 84 70 100 70 C118 70 132 80 128 104 Z" fill={HAIR} />
            </>
          )}
          {/* Face. */}
          <circle cx="100" cy="100" r="25" fill={SKIN} />
          {/* Fringe (female), a short crop with a side part (male), or the afro's hairline. */}
          {afro ? (
            <path
              d="M76 96 C78 82 88 76 100 76 C112 76 122 82 124 96 C116 88 108 86 100 86 C92 86 84 88 76 96 Z"
              fill={HAIR}
            />
          ) : male ? (
            <path
              d="M76 94 C76 80 88 74 100 74 C114 74 125 81 124 94 C120 88 112 84 104 84 L100 80 L96 85 C88 86 81 89 76 94 Z"
              fill={HAIR}
            />
          ) : (
            <path
              d="M75 98 C76 80 90 74 102 76 C116 78 126 86 125 98 C116 88 104 84 92 88 C84 90 79 94 75 98 Z"
              fill={HAIR}
            />
          )}
          {/* Stubble (male). */}
          {male && (
            <path
              d="M80 108 C82 120 92 126 100 126 C108 126 118 120 120 108 C114 116 107 119 100 119 C93 119 86 116 80 108 Z"
              fill={HAIR}
              opacity="0.22"
            />
          )}
          {/* Ears + earrings. */}
          <circle cx="75" cy="102" r="4" fill={SKIN_SHADE} />
          <circle cx="125" cy="102" r="4" fill={SKIN_SHADE} />
          {!male && (
            <>
              <circle cx="75" cy="109" r="1.8" className="fill-sun" />
              <circle cx="125" cy="109" r="1.8" className="fill-sun" />
            </>
          )}
          {/* Round glasses (afro). */}
          {afro && (
            <g fill="none" className="stroke-foreground/70" strokeWidth="1.6">
              <circle cx="91" cy="101" r="7" />
              <circle cx="109" cy="101" r="7" />
              <path d="M98 101 L102 101" />
            </g>
          )}
          {/* Eyes (blink), brows, cheeks, mouth by mood. */}
          <g className="ep-eyes">
            {happy ? (
              <>
                <path
                  d="M87 101 Q91 96 95 101"
                  fill="none"
                  stroke={HAIR}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <path
                  d="M105 101 Q109 96 113 101"
                  fill="none"
                  stroke={HAIR}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </>
            ) : (
              <>
                <ellipse cx="91" cy="101" rx="2.6" ry="3.2" fill={HAIR} />
                <ellipse cx="109" cy="101" rx="2.6" ry="3.2" fill={HAIR} />
                <circle cx="92" cy="99.8" r="0.9" className="fill-white" />
                <circle cx="110" cy="99.8" r="0.9" className="fill-white" />
              </>
            )}
          </g>
          {!happy && (
            <>
              <path
                d="M86 93 Q91 90 96 92"
                fill="none"
                stroke={HAIR}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M104 91 Q109 88 114 92"
                fill="none"
                stroke={HAIR}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </>
          )}
          <circle cx="85" cy="108" r="3.5" className="fill-ember/35" />
          <circle cx="115" cy="108" r="3.5" className="fill-ember/35" />
          {happy ? (
            <path
              d="M90 109 Q100 121 110 109 Z"
              className="fill-white"
              stroke={HAIR}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          ) : mood === "hopeful" || working ? (
            <path
              d="M93 112 Q100 117 107 112"
              fill="none"
              stroke={HAIR}
              strokeWidth="2"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M95 113 Q101 111 106 114"
              fill="none"
              stroke={HAIR}
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </g>
        {/* Laptop (working): the lid faces us with the portal mark; the hands tap the keys. */}
        {working && (
          <g>
            <path d="M62 186 L138 186 L146 194 L54 194 Z" className="fill-foreground/25" />
            <rect
              x="66"
              y="146"
              width="68"
              height="42"
              rx="5"
              className="fill-card stroke-foreground/15 dark:fill-[oklch(0.3_0.02_265)]"
              strokeWidth="1.2"
            />
            <rect x="91" y="158" width="18" height="18" rx="5" className="fill-primary" />
            <path d="M95.5 168 L100 164 L104.5 168 L104.5 172 L95.5 172 Z" className="fill-white" />
            <circle cx="106.5" cy="160.5" r="2" className="fill-sun" />
            <circle cx="78" cy="186" r="6" fill={SKIN} className="ep-type" />
            <circle
              cx="122"
              cy="186"
              r="6"
              fill={SKIN}
              className="ep-type"
              style={{ animationDelay: "0.18s" }}
            />
          </g>
        )}
      </g>

      {/* Thought bubble: dots rise to a cloud whose symbol keeps changing. */}
      <g className="ep-bubble">
        <circle
          cx="134"
          cy="84"
          r="3"
          className="ep-dot fill-card stroke-primary/30"
          strokeWidth="1"
        />
        <circle
          cx="145"
          cy="70"
          r="4.5"
          className="ep-dot fill-card stroke-primary/30"
          strokeWidth="1"
          style={{ animationDelay: "0.25s" }}
        />
        <rect
          x="146"
          y="18"
          width="56"
          height="42"
          rx="21"
          className="fill-card stroke-primary/30 dark:fill-[oklch(0.24_0.03_265)]"
          strokeWidth="1.2"
        />
        {happy ? (
          // Licence badge with a tick.
          <g className="ep-pop">
            <circle cx="174" cy="39" r="13" className="fill-primary" />
            <path
              d="M167 39 L172 44 L181 34"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ) : working ? (
          // The check filling in: three lines, each ticked in turn.
          <g>
            {[0, 1, 2].map((i) => (
              <g key={i} className="ep-tick" style={{ animationDelay: `${i * 0.55}s` }}>
                <circle cx={160} cy={28 + i * 11} r="3.6" className="fill-primary" />
                <path
                  d={`M158.3 ${28 + i * 11} L159.6 ${29.3 + i * 11} L161.8 ${26.6 + i * 11}`}
                  fill="none"
                  stroke="white"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <rect
                  x="167"
                  y={26.5 + i * 11}
                  width={i === 1 ? 20 : 26}
                  height="3"
                  rx="1.5"
                  className="fill-primary/50"
                />
              </g>
            ))}
          </g>
        ) : (
          <g className="ep-cycle">
            {/* 1: question mark. */}
            <text
              x="174"
              y="47"
              textAnchor="middle"
              className="fill-primary text-[24px] font-extrabold"
            >
              ?
            </text>
            {/* 2: graduation cap. */}
            <g>
              <path d="M160 37 L174 30 L188 37 L174 44 Z" className="fill-primary" />
              <path
                d="M166 40 L166 47 Q174 51 182 47 L182 40 L174 44 Z"
                className="fill-primary/70"
              />
              <path
                d="M186 38 L186 46"
                className="stroke-sun"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
            {/* 3: licence card. */}
            <g>
              <rect x="160" y="29" width="28" height="20" rx="4" className="fill-primary" />
              <circle cx="168" cy="38" r="3.5" className="fill-white/90" />
              <rect x="174" y="34" width="10" height="2.5" rx="1" className="fill-white/90" />
              <rect x="174" y="39" width="7" height="2.5" rx="1" className="fill-sun" />
            </g>
          </g>
        )}
      </g>

      {/* Sparkles (happy). */}
      {happy &&
        [
          { x: 30, y: 80, d: 0 },
          { x: 176, y: 100, d: 0.8 },
          { x: 46, y: 150, d: 1.4 },
        ].map((s) => (
          <path
            key={s.d}
            d={`M${s.x} ${s.y - 7} L${s.x + 2} ${s.y - 2} L${s.x + 7} ${s.y} L${s.x + 2} ${s.y + 2} L${s.x} ${s.y + 7} L${s.x - 2} ${s.y + 2} L${s.x - 7} ${s.y} L${s.x - 2} ${s.y - 2} Z`}
            className="ep-sparkle fill-sun"
            style={{ animationDelay: `${s.d}s` }}
          />
        ))}
    </svg>
  );
}
