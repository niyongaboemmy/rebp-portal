"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "loading" | "done";

/** Lets code that navigates programmatically (router.push after a form) start the bar too. */
export function startRouteProgress() {
  window.dispatchEvent(new Event("route-progress:start"));
}

/**
 * Top loading line between pages. App Router has no route events, so it starts on a click on an
 * internal link (or back/forward, or `startRouteProgress()`), trickles towards 85% and finishes
 * once the URL has changed and any loading skeleton has been replaced by the page. The bar is a moving blue → sky → Sun gradient with a glowing tip; it
 * only shows if navigation takes longer than a beat (no flash on instant pages).
 */
export function RouteProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [phase, setPhase] = useState<Phase>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const route = `${pathname}?${search.toString()}`;
  const last = useRef(route);

  useEffect(() => {
    const start = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setPhase("loading");
        // Safety: a navigation that never changes the URL must not leave the bar stuck.
        timer.current = setTimeout(() => {
          setPhase("done");
          timer.current = setTimeout(() => setPhase("idle"), 450);
        }, 12_000);
      }, 80);
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search)
        return; // same page (hash jumps included)
      start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    window.addEventListener("route-progress:start", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
      window.removeEventListener("route-progress:start", start);
      clearTimeout(timer.current);
    };
  }, []);

  // The URL changed. The new page may still be streaming behind its skeleton (loading.tsx marks
  // itself `data-route-loading`): keep loading until that is gone, then finish and hide.
  useEffect(() => {
    if (route === last.current) return;
    last.current = route;
    clearTimeout(timer.current);
    const finish = () => {
      clearTimeout(timer.current);
      setPhase((p) => (p === "idle" ? "idle" : "done"));
      timer.current = setTimeout(() => setPhase("idle"), 450);
    };
    if (!document.querySelector("[data-route-loading]")) {
      const frame = requestAnimationFrame(finish);
      return () => cancelAnimationFrame(frame);
    }
    const frame = requestAnimationFrame(() => setPhase("loading"));
    const observer = new MutationObserver(() => {
      if (document.querySelector("[data-route-loading]")) return;
      observer.disconnect();
      finish();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [route]);

  return (
    <div
      aria-hidden
      data-phase={phase}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] opacity-0 transition-opacity duration-300 data-[phase=done]:opacity-0 data-[phase=done]:delay-200 data-[phase=loading]:opacity-100"
    >
      <div
        className="relative h-full origin-left rounded-r-full bg-[linear-gradient(90deg,var(--primary),var(--sky),var(--sun),var(--primary))] bg-[length:200%_100%] transition-[width] ease-out"
        style={{
          // Flow the colours only while visible (no idle infinite animation).
          animation: phase === "loading" ? "progress-pan 1.4s linear infinite" : "none",
          width: phase === "idle" ? "0%" : phase === "loading" ? "85%" : "100%",
          transitionDuration: phase === "loading" ? "8s" : phase === "done" ? "200ms" : "0ms",
          transitionTimingFunction:
            phase === "loading" ? "cubic-bezier(0.1, 0.6, 0.2, 1)" : "ease-out",
        }}
      >
        <span className="absolute top-1/2 right-0 h-3 w-16 -translate-y-1/2 rounded-full bg-sky/60 blur-md" />
      </div>
    </div>
  );
}
