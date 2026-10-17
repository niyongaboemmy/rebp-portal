"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface PagerPage {
  title: string;
  /** Issue paths whose field sits on this page. */
  owns: (path: string) => boolean;
  /** Whether the page holds an element matching the selector (e.g. an upload slot). */
  has: (selector: string) => boolean;
}

/**
 * The element for an issue path (exact, else its nearest tagged parent). A list ("records")
 * marks itself with `data-anchor`, so a rule about the whole list has somewhere to go even while
 * it is empty, without counting as one more answer when the pager groups topics.
 */
export function fieldFor(path: string, root: ParentNode = document): HTMLElement | null {
  let p = path;
  while (p) {
    const key = CSS.escape(p);
    const el = root.querySelector<HTMLElement>(`[data-path="${key}"], [data-anchor="${key}"]`);
    if (el) return el;
    p = p.includes(".") ? p.slice(0, p.lastIndexOf(".")) : "";
  }
  return null;
}

const fieldCount = (group: HTMLElement[]) =>
  group.reduce(
    (n, el) =>
      n +
      [...(el.matches("[data-path]") ? [el] : []), ...el.querySelectorAll("[data-path]")].filter(
        // Nested anchors (a lookup's inner name field) count once, with their outer field.
        (f) => !f.parentElement?.closest("[data-path]"),
      ).length,
    0,
  );
const isUploads = (group: HTMLElement[]) =>
  group.some((el) => el.querySelector("[data-document-type]")) && fieldCount(group) === 0;

/** A page's name: its heading, else its first question. */
function titleOf(group: HTMLElement[]) {
  for (const el of group) {
    const heading = el.querySelector("h3") ?? el.querySelector("legend, [role=radiogroup] > span");
    const text = heading?.textContent?.replace(/\(.*?\)/g, "").trim();
    if (text) return text;
  }
  return "";
}

/** Event a link fires to reveal a field that may be on another page. */
export const REVEAL_EVENT = "wizard:reveal";

/**
 * Splits a long section into short pages without changing the section (FR-WIZ-001): the
 * section's top-level blocks are read from the DOM, and every block with a heading starts a new
 * page (untitled blocks stay with the one before). Only the current page is shown; the rest stay
 * mounted (hidden), so answers, autosave and validation are untouched. Conditional blocks that
 * appear or disappear are picked up live. `reset` (the step) returns to the first page.
 */
export function useSectionPager(
  container: React.RefObject<HTMLDivElement | null>,
  reset: string,
  enabled: boolean,
) {
  const [groups, setGroups] = useState<HTMLElement[][]>([]);
  // Pages are measured one frame after the section renders; until then it stays invisible, so
  // the whole section never flashes before collapsing to its first page (UX-009).
  const [measuredFor, setMeasuredFor] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // New step: first page.
  const [seen, setSeen] = useState(reset);
  if (seen !== reset) {
    setSeen(reset);
    setPage(0);
  }

  // Read the section's blocks now and whenever its content changes.
  useLayoutEffect(() => {
    const measure = () => {
      const root = container.current?.firstElementChild;
      if (!enabled || !root) return setGroups((prev) => (prev.length ? [] : prev));
      const blocks: HTMLElement[][] = [];
      for (const child of Array.from(root.children) as HTMLElement[]) {
        const titled = child.matches("section") && child.querySelector(":scope > div > h3");
        if (titled || blocks.length === 0) blocks.push([child]);
        else blocks[blocks.length - 1]!.push(child);
      }
      // Survey format (UX-006): one topic per page. A leading untitled block (a first question or
      // a notice) joins the topic after it; two one-answer topics share a page. Topics that grow
      // as conditional answers appear never merge, so pages don't reshuffle while typing.
      // Uploads keep a page of their own.
      // A group is a topic once any of its blocks has a heading.
      const isTopic = (group: HTMLElement[]) =>
        group.some((el) => el.matches("section") && el.querySelector(":scope > div > h3"));
      const next: HTMLElement[][] = [];
      for (const block of blocks) {
        const last = next[next.length - 1];
        const join =
          last &&
          !isUploads(last) &&
          !isUploads(block) &&
          (!isTopic(last) || (fieldCount(last) <= 1 && fieldCount(block) <= 1));
        if (join) last.push(...block);
        else next.push([...block]);
      }
      setMeasuredFor(reset);
      setGroups((prev) =>
        prev.length === next.length &&
        prev.every((g, i) => g.length === next[i]!.length && g.every((el, j) => el === next[i]![j]))
          ? prev
          : next,
      );
    };
    const frame = requestAnimationFrame(measure);
    const node = container.current;
    const observer = new MutationObserver(measure);
    if (node) observer.observe(node, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [enabled, reset, container]);

  const count = groups.length;
  const current = Math.min(page, Math.max(0, count - 1));

  // Show only the current page; a page that comes into view eases in from the side it's on
  // (UX-007), unless the applicant prefers reduced motion.
  const shown = useRef(current);
  useLayoutEffect(() => {
    groups.forEach((group, i) =>
      group.forEach((el) => {
        if (count > 1 && i !== current) el.setAttribute("hidden", "");
        else el.removeAttribute("hidden");
      }),
    );
    const from = shown.current;
    shown.current = current;
    if (from === current || count <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const dx = current > from ? 16 : -16;
    for (const el of groups[current] ?? [])
      el.animate(
        [
          { opacity: 0, transform: `translateX(${dx}px)` },
          { opacity: 1, transform: "none" },
        ],
        { duration: 260, easing: "cubic-bezier(0.05, 0.7, 0.1, 1)" },
      );
  }, [groups, current, count]);

  // A link to a field on another page opens that page.
  useEffect(() => {
    const onReveal = (event: Event) => {
      const target = (event as CustomEvent<HTMLElement>).detail;
      const index = groups.findIndex((g) => g.some((el) => el.contains(target)));
      if (index >= 0) setPage(index);
    };
    window.addEventListener(REVEAL_EVENT, onReveal);
    return () => window.removeEventListener(REVEAL_EVENT, onReveal);
  }, [groups]);

  const pages: PagerPage[] = groups.map((group) => ({
    title: titleOf(group),
    owns: (path) => {
      const el = fieldFor(path);
      return Boolean(el && group.some((g) => g.contains(el)));
    },
    has: (selector) => group.some((g) => g.matches(selector) || Boolean(g.querySelector(selector))),
  }));

  return {
    ready: !enabled || measuredFor === reset,
    pages,
    page: current,
    count,
    isLast: count <= 1 || current >= count - 1,
    isFirst: current === 0,
    goTo: (i: number) => setPage(Math.max(0, Math.min(count - 1, i))),
  };
}
