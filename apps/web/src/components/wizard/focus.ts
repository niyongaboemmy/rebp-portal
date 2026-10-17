import { fieldFor, REVEAL_EVENT } from "./section-pager";

/**
 * Takes the applicant to an answer or an upload (FR-WIZ-006, UX-004 §3.4): opens the page of a
 * paged section that holds it, scrolls it to the middle, focuses its control and pulses it once.
 * After a step change the target is not mounted yet, so it is looked for over a few frames.
 */
function reveal(el: HTMLElement) {
  window.dispatchEvent(new CustomEvent(REVEAL_EVENT, { detail: el }));
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const target =
        el.querySelector<HTMLElement>(
          "input:not([type=hidden]):not(.sr-only), textarea, select, button, [tabindex]",
        ) ?? el.querySelector<HTMLElement>("input");
      target?.focus({ preventScroll: true });
      el.animate(
        [
          { boxShadow: "0 0 0 0 transparent" },
          { boxShadow: "0 0 0 6px color-mix(in oklch, var(--ring) 35%, transparent)" },
          { boxShadow: "0 0 0 0 transparent" },
        ],
        { duration: 900, easing: "ease-out" },
      );
    }),
  );
}

function when(find: () => HTMLElement | null, tries = 30) {
  const el = find();
  if (el) return reveal(el);
  if (tries > 0) requestAnimationFrame(() => when(find, tries - 1));
}

/** Asks a list row (`data-item`) to open the item that holds an answer (ItemList, UX-017). */
export const OPEN_ITEM_EVENT = "wizard:open-item";

/**
 * A section-relative path ("supervisorLicenceNo"). An answer inside a list item lives in that
 * item's dialog: its row opens it first, then the answer is focused there.
 */
export function focusField(path: string) {
  let asked = false;
  when(() => {
    const el = fieldFor(path);
    if (el?.hasAttribute("data-item") && el.dataset.anchor !== path) {
      if (!asked) {
        asked = true;
        // Its page first (paged sections), then the item's dialog.
        window.dispatchEvent(new CustomEvent(REVEAL_EVENT, { detail: el }));
        el.dispatchEvent(new CustomEvent(OPEN_ITEM_EVENT, { detail: path, bubbles: true }));
      }
      return null;
    }
    return el;
  });
}

export function focusDocument(type: string) {
  when(() => document.querySelector<HTMLElement>(`[data-document-type="${CSS.escape(type)}"]`));
}
