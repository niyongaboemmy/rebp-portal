import { cn } from "@/lib/utils";

/**
 * What the account companion acts out (UX-012/013). Profile: waving hello, writing the details
 * down, holding up an ID card for the documents still to come, celebrating a complete profile,
 * or worried when a change didn't save. Security: a shield when the account is well protected,
 * a padlock snapping shut when something is left to turn on. My access: showing a staff badge.
 */
export type BuddyMood =
  | "wave"
  | "write"
  | "documents"
  | "celebrate"
  | "worried"
  | "shield"
  | "lock"
  | "badge"
  // Applications (UX-028): paying the fees, and waiting while the regulator works.
  | "pay"
  | "waiting";

const SKIN = "oklch(0.52 0.08 50)";
const SKIN_SHADE = "oklch(0.45 0.08 45)";
const HAIR = "oklch(0.22 0.03 40)";
const PAPER = "fill-white dark:fill-[oklch(0.93_0.01_265)]";
const INK = "fill-[oklch(0.72_0.03_265)]";

/**
 * The account pages' companion (decorative, UX-012/013): a half-length figure drawn in the
 * eligibility companion's flat style that acts out where the current settings page stands. `saving` adds a
 * small sync badge; `hop` changes replay a little jump (an answer completed, or a tap).
 * Everything loops gently; reduced motion holds still.
 */
export function ProfileBuddy({
  mood,
  saving = false,
  hop = 0,
  className,
}: {
  mood: BuddyMood;
  saving?: boolean;
  hop?: number;
  className?: string;
}) {
  const happy = mood === "celebrate";
  const worried = mood === "worried";
  const looking = mood === "documents";
  /** Holding something up in the left hand, eyes on it. */
  const holding =
    looking || mood === "shield" || mood === "lock" || mood === "pay" || mood === "waiting";
  return (
    <svg
      viewBox="0 0 200 170"
      aria-hidden
      data-loop
      data-mood={mood}
      className={cn("pb overflow-visible", className)}
    >
      {/* Backdrop: a soft brand disc and a dashed orbit. */}
      <circle cx="100" cy="104" r="62" className="fill-primary/[0.09] dark:fill-primary/[0.18]" />
      <circle
        cx="100"
        cy="104"
        r="72"
        fill="none"
        className="stroke-primary/20"
        strokeDasharray="2 6"
        strokeWidth="1.2"
      />

      {/* Confetti (celebrate). */}
      {happy &&
        [
          { x: 30, c: "fill-sun", d: 0 },
          { x: 56, c: "fill-primary", d: 0.7 },
          { x: 146, c: "fill-ember", d: 0.3 },
          { x: 170, c: "fill-sky", d: 1.2 },
          { x: 122, c: "fill-sun", d: 1.7 },
          { x: 78, c: "fill-ember", d: 2.1 },
        ].map((p) => (
          <rect
            key={p.d}
            x={p.x}
            y="0"
            width="5"
            height="9"
            rx="1.5"
            className={cn("pb-confetti", p.c)}
            style={{ animationDelay: `${p.d}s` }}
          />
        ))}

      {/* Sparkles around the waving hand (wave). */}
      {(mood === "wave" || mood === "shield" || mood === "badge") &&
        (mood === "wave"
          ? [
              { x: 168, y: 64, d: 0 },
              { x: 176, y: 92, d: 0.8 },
              { x: 150, y: 52, d: 1.5 },
            ]
          : mood === "shield"
            ? [
                { x: 18, y: 76, d: 0 },
                { x: 30, y: 58, d: 0.8 },
                { x: 80, y: 66, d: 1.5 },
              ]
            : [
                { x: 72, y: 128, d: 0 },
                { x: 130, y: 120, d: 0.8 },
                { x: 140, y: 64, d: 1.5 },
              ]
        ).map((s) => (
          <path
            key={s.d}
            d={`M${s.x} ${s.y - 6} L${s.x + 1.6} ${s.y - 1.6} L${s.x + 6} ${s.y} L${s.x + 1.6} ${s.y + 1.6} L${s.x} ${s.y + 6} L${s.x - 1.6} ${s.y + 1.6} L${s.x - 6} ${s.y} L${s.x - 1.6} ${s.y - 1.6} Z`}
            className="pb-sparkle fill-sun"
            style={{ animationDelay: `${s.d}s` }}
          />
        ))}

      {/* Thought bubble with typing dots (write). */}
      {(mood === "write" || mood === "waiting") && (
        <g>
          <circle cx="140" cy="62" r="3" className="fill-primary-soft" />
          <circle cx="147" cy="52" r="4.5" className="fill-primary-soft" />
          <rect x="148" y="22" width="40" height="24" rx="12" className="fill-primary-soft" />
          {[160, 168, 176].map((x, i) => (
            <circle
              key={x}
              cx={x}
              cy="34"
              r="2.6"
              className="pb-dot fill-primary"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </g>
      )}

      {/* An exclamation bubble and a bead of sweat (worried). */}
      {worried && (
        <>
          <g className="pb-pulse">
            <circle cx="158" cy="40" r="13" className="fill-destructive" />
            <rect x="156.4" y="31" width="3.2" height="11" rx="1.6" className="fill-white" />
            <circle cx="158" cy="46.5" r="1.9" className="fill-white" />
          </g>
          <path
            d="M127 64 C127 64 122 71 122 74 A5 5 0 0 0 132 74 C132 71 127 64 127 64 Z"
            className="pb-drop fill-sky"
          />
        </>
      )}

      {/* Upload badge bouncing over the ID card (documents). */}
      {looking && (
        <g className="pb-bounce">
          <circle cx="44" cy="60" r="12" className="fill-primary" />
          <path
            d="M44 66 L44 54 M39 59 L44 54 L49 59"
            fill="none"
            stroke="white"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}

      {/* Sync badge while a change saves. */}
      {saving && (
        <g>
          <circle cx="164" cy="132" r="13" className="fill-card" />
          <circle
            cx="164"
            cy="132"
            r="8"
            fill="none"
            className="pb-spin stroke-primary"
            strokeWidth="2.4"
            strokeDasharray="34 50"
            strokeLinecap="round"
          />
        </g>
      )}

      {/* The person: remounts on every hop so the jump replays. */}
      <g key={hop} className={cn(hop > 0 && "pb-hop")}>
        <g className="pb-body">
          {/* Torso (blazer), shirt and a Sun tie. */}
          <path
            d="M52 172 C52 134 72 118 100 118 C128 118 148 134 148 172 Z"
            className="fill-primary"
          />
          <path
            d="M100 120 L89 142 L100 170 L111 142 Z"
            className="fill-white/90 dark:fill-white/80"
          />
          <path d="M100 132 L96.5 139 L100 156 L103.5 139 Z" className="fill-sun" />
          <rect x="92" y="100" width="16" height="22" rx="7" fill={SKIN_SHADE} />
          {/* A staff badge on a lanyard (badge). */}
          {mood === "badge" && (
            <g className="pb-swing">
              <path
                d="M92 116 L95 132 M108 116 L105 132"
                className="stroke-sun"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <rect x="85" y="130" width="30" height="38" rx="4.5" className={PAPER} />
              <rect
                x="85"
                y="130"
                width="30"
                height="38"
                rx="4.5"
                fill="none"
                className="stroke-primary/50"
                strokeWidth="1.5"
              />
              <rect x="94" y="133" width="12" height="3" rx="1.5" className="fill-primary" />
              <circle cx="100" cy="146" r="5.5" className="fill-sky/70" />
              <rect x="91" y="155" width="18" height="3" rx="1.5" className={INK} />
              <rect x="94" y="161" width="12" height="3" rx="1.5" className={INK} />
            </g>
          )}

          {/* Left arm: holds the clipboard or the ID card, or rests. */}
          {happy ? (
            <g className="pb-cheer">
              <path
                d="M66 136 Q50 112 52 88"
                fill="none"
                className="stroke-primary"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <circle cx="52" cy="84" r="7" fill={SKIN} />
            </g>
          ) : holding ? (
            <g className="pb-bob">
              <path
                d="M66 138 Q46 136 50 112"
                fill="none"
                className="stroke-primary"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {mood === "shield" ? (
                // A shield with a tick: the account is well protected.
                <>
                  <path
                    d="M49 78 L71 86 L71 98 C71 109 62 115 49 120 C36 115 27 109 27 98 L27 86 Z"
                    className={PAPER}
                  />
                  <path
                    d="M49 78 L71 86 L71 98 C71 109 62 115 49 120 C36 115 27 109 27 98 L27 86 Z"
                    fill="none"
                    className="stroke-primary/50"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M39 98 L46 105 L59 91"
                    fill="none"
                    className="stroke-primary"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : mood === "pay" ? (
                // A payment card held up: paying the fees.
                <>
                  <rect x="24" y="86" width="50" height="31" rx="5" className="fill-sun" />
                  <rect
                    x="24"
                    y="93"
                    width="50"
                    height="6"
                    className="fill-[oklch(0.3_0.06_70)]/70"
                  />
                  <rect x="29" y="104" width="10" height="7" rx="1.5" className="fill-white/85" />
                  <rect
                    x="44"
                    y="107"
                    width="24"
                    height="3"
                    rx="1.5"
                    className="fill-[oklch(0.3_0.06_70)]/45"
                  />
                </>
              ) : mood === "waiting" ? (
                // An hourglass that turns over: the regulator's part is under way.
                <g className="pb-flip">
                  <rect x="33" y="78" width="32" height="4" rx="2" className="fill-primary" />
                  <rect x="33" y="114" width="32" height="4" rx="2" className="fill-primary" />
                  <path
                    d="M37 82 L61 82 C61 92 51 96 49 98 C51 100 61 104 61 114 L37 114 C37 104 47 100 49 98 C47 96 37 92 37 82 Z"
                    className={PAPER}
                  />
                  <path
                    d="M37 82 L61 82 C61 92 51 96 49 98 C51 100 61 104 61 114 L37 114 C37 104 47 100 49 98 C47 96 37 92 37 82 Z"
                    fill="none"
                    className="stroke-primary/50"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M41 86 L57 86 C56 91 51 94 49 96 C47 94 42 91 41 86 Z"
                    className="fill-sun"
                  />
                  <path
                    d="M42 112 L56 112 C55 107 51 105 49 104 C47 105 43 107 42 112 Z"
                    className="fill-sun"
                  />
                </g>
              ) : mood === "lock" ? (
                // A padlock whose shackle keeps snapping shut: something is left to turn on.
                <>
                  <path
                    d="M39 96 L39 86 A11 11 0 0 1 61 86 L61 96"
                    fill="none"
                    className="pb-shackle stroke-[oklch(0.62_0.02_265)]"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <rect x="31" y="94" width="38" height="28" rx="6" className="fill-sun" />
                  <circle cx="50" cy="105" r="3.6" fill={HAIR} />
                  <rect x="48.5" y="106" width="3" height="8" rx="1.5" fill={HAIR} />
                </>
              ) : (
                // The ID card: photo and two lines.
                <>
                  <rect x="24" y="82" width="50" height="32" rx="5" className={PAPER} />
                  <rect
                    x="24"
                    y="82"
                    width="50"
                    height="32"
                    rx="5"
                    fill="none"
                    className="stroke-primary/50"
                    strokeWidth="1.5"
                  />
                  <rect x="29" y="88" width="14" height="18" rx="3" className="fill-sky/70" />
                  <rect x="47" y="91" width="22" height="3.5" rx="1.75" className={INK} />
                  <rect x="47" y="98" width="15" height="3.5" rx="1.75" className={INK} />
                </>
              )}
              <circle cx="50" cy={mood === "lock" ? 120 : 113} r="6.5" fill={SKIN} />
            </g>
          ) : mood === "write" ? (
            <g>
              <path
                d="M64 140 Q62 160 78 162"
                fill="none"
                className="stroke-primary"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {/* Clipboard, with lines being written. */}
              <rect x="74" y="128" width="44" height="42" rx="5" className={PAPER} />
              <rect x="88" y="124" width="16" height="7" rx="2.5" className="fill-sun" />
              {[140, 148, 156].map((y, i) => (
                <path
                  key={y}
                  d={`M82 ${y} L${i === 2 ? 100 : 110} ${y}`}
                  className="pb-draw stroke-[oklch(0.72_0.03_265)]"
                  strokeWidth="3"
                  strokeLinecap="round"
                  pathLength={1}
                  style={{ animationDelay: `${i * 0.9}s` }}
                />
              ))}
              <circle cx="78" cy="161" r="6.5" fill={SKIN} />
            </g>
          ) : (
            <path
              d="M64 140 Q58 156 62 172"
              fill="none"
              className="stroke-primary"
              strokeWidth="12"
              strokeLinecap="round"
            />
          )}

          {/* Right arm: waves, cheers, writes, or rests. */}
          {happy ? (
            <g className="pb-cheer">
              <path
                d="M134 136 Q150 112 148 88"
                fill="none"
                className="stroke-primary"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <circle cx="148" cy="84" r="7" fill={SKIN} />
            </g>
          ) : mood === "wave" ? (
            <g className="pb-wave">
              <path
                d="M134 138 Q154 124 152 96"
                fill="none"
                className="stroke-primary"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <circle cx="152" cy="90" r="7.5" fill={SKIN} />
              <path
                d="M147 85 L146 78 M152 83 L152 75 M157 85 L158 78"
                stroke={SKIN}
                strokeWidth="3.4"
                strokeLinecap="round"
              />
            </g>
          ) : mood === "badge" ? (
            // Presenting the badge.
            <g>
              <path
                d="M136 140 Q142 160 120 156"
                fill="none"
                className="stroke-primary"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <circle cx="117" cy="155" r="6.5" fill={SKIN} />
            </g>
          ) : mood === "write" ? (
            <g className="pb-write">
              <path
                d="M136 140 Q140 158 116 152"
                fill="none"
                className="stroke-primary"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <path
                d="M110 150 L102 140"
                className="stroke-sun"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <circle cx="112" cy="151" r="6.5" fill={SKIN} />
            </g>
          ) : worried ? (
            // A hand on the cheek.
            <g>
              <path
                d="M136 140 Q144 124 128 104"
                fill="none"
                className="stroke-primary"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <circle cx="125" cy="98" r="6.5" fill={SKIN} />
            </g>
          ) : (
            <path
              d="M136 140 Q142 156 138 172"
              fill="none"
              className="stroke-primary"
              strokeWidth="12"
              strokeLinecap="round"
            />
          )}

          {/* Head: tilts while working, nods when happy, shakes a little when worried. */}
          <g className="pb-head">
            <path d="M75 92 C72 64 86 54 100 54 C116 54 129 64 125 92 Z" fill={HAIR} />
            <circle cx="100" cy="82" r="24" fill={SKIN} />
            <path
              d="M76 80 C76 64 88 57 100 57 C114 57 125 64 124 80 C118 72 110 68 102 68 L98 64 L94 69 C86 70 80 74 76 80 Z"
              fill={HAIR}
            />
            <circle cx="76" cy="85" r="4" fill={SKIN_SHADE} />
            <circle cx="124" cy="85" r="4" fill={SKIN_SHADE} />

            {/* Eyes: happy arcs, or blinking eyes that glance at the ID card. */}
            <g className="pb-eyes">
              {happy ? (
                <>
                  <path
                    d="M87 84 Q91 79 95 84"
                    fill="none"
                    stroke={HAIR}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M105 84 Q109 79 113 84"
                    fill="none"
                    stroke={HAIR}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                </>
              ) : (
                <g transform={holding ? "translate(-2.5 0)" : undefined}>
                  {/* Follows the pointer under LookAtPointer (UX-031). */}
                  <g className="pb-look">
                    <ellipse cx="91" cy="84" rx="2.6" ry="3.2" fill={HAIR} />
                    <ellipse cx="109" cy="84" rx="2.6" ry="3.2" fill={HAIR} />
                    <circle cx="92" cy="82.8" r="0.9" className="fill-white" />
                    <circle cx="110" cy="82.8" r="0.9" className="fill-white" />
                  </g>
                </g>
              )}
            </g>
            {/* Brows: raised and slanted when worried. */}
            {!happy && (
              <>
                <path
                  d={worried ? "M86 76 Q91 72 96 73" : "M86 76 Q91 73 96 75"}
                  fill="none"
                  stroke={HAIR}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d={worried ? "M104 73 Q109 72 114 76" : "M104 74 Q109 71 114 75"}
                  fill="none"
                  stroke={HAIR}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </>
            )}
            <circle cx="85" cy="91" r="3.5" className="fill-ember/35" />
            <circle cx="115" cy="91" r="3.5" className="fill-ember/35" />
            {happy ? (
              <path
                d="M90 92 Q100 104 110 92 Z"
                className="fill-white"
                stroke={HAIR}
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            ) : worried ? (
              <path
                d="M93 97 Q96.5 94 100 97 Q103.5 100 107 97"
                fill="none"
                stroke={HAIR}
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : mood === "write" ? (
              <path
                d="M95 96 Q100 99 105 96"
                fill="none"
                stroke={HAIR}
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M92 94 Q100 102 108 94"
                fill="none"
                stroke={HAIR}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            )}
          </g>
        </g>
      </g>
    </svg>
  );
}
