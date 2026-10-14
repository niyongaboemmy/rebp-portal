/**
 * Large decorative code for error pages (404, 403): brand-gradient numerals over the Imigongo
 * motif. Decorative only — the page's <h1> carries the meaning.
 */
export function ErrorArt({ code }: { code: string }) {
  return (
    <div
      aria-hidden
      className="relative isolate flex animate-pop items-center justify-center px-6 py-2"
    >
      <div className="absolute inset-0 -z-10 rounded-full bg-primary/10 blur-2xl" />
      <span className="bg-gradient-to-br from-primary via-sky to-primary bg-clip-text text-[clamp(4.5rem,3rem+8vw,8rem)] leading-none font-black num tracking-tighter text-transparent">
        {code}
      </span>
    </div>
  );
}
