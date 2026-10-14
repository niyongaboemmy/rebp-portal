import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** Rwanda's sun: 24 rays as a star polygon around (520, 120) in the 640×480 frame. */
const SUN_RAYS = Array.from({ length: 48 }, (_, i) => {
  const angle = (i * Math.PI) / 24;
  const r = i % 2 === 0 ? 70 : 40;
  return `${(520 + r * Math.sin(angle)).toFixed(1)},${(120 - r * Math.cos(angle)).toFixed(1)}`;
}).join(" ");

/**
 * Flat 4:3 flags for the language menu (UX-003). Inline SVG rather than emoji, which Windows
 * renders as letters. Decorative: the language name or code always sits next to the flag. Size is `!important`
 * because menus and buttons size every nested svg to a square.
 */
const FLAGS: Record<Locale, React.ReactNode> = {
  rw: (
    <>
      <path fill="#20603d" d="M0 0h640v480H0z" />
      <path fill="#fad201" d="M0 0h640v360H0z" />
      <path fill="#00a1de" d="M0 0h640v240H0z" />
      <polygon fill="#e5be01" points={SUN_RAYS} />
      <circle cx="520" cy="120" r="34" fill="#00a1de" />
      <circle cx="520" cy="120" r="28" fill="#e5be01" />
    </>
  ),
  en: (
    <>
      <path fill="#012169" d="M0 0h640v480H0z" />
      <path
        fill="#fff"
        d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0z"
      />
      <path
        fill="#c8102e"
        d="m424 281 216 159v40L369 281zm-184 20 6 35L54 480H0zM640 0v3L391 191l2-44L590 0zM0 0l239 176h-60L0 42z"
      />
      <path fill="#fff" d="M241 0v480h160V0zM0 160v160h640V160z" />
      <path fill="#c8102e" d="M0 193v96h640v-96zM273 0v480h96V0z" />
    </>
  ),
  fr: (
    <>
      <path fill="#fff" d="M0 0h640v480H0z" />
      <path fill="#002654" d="M0 0h213.3v480H0z" />
      <path fill="#ce1126" d="M426.7 0H640v480H426.7z" />
    </>
  ),
};

export function Flag({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <svg
      viewBox="0 0 640 480"
      aria-hidden
      className={cn("h-3.5! w-[1.1875rem]! shrink-0 rounded-[3px] ring-1 ring-black/10", className)}
    >
      {FLAGS[locale]}
    </svg>
  );
}
