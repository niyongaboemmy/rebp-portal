/**
 * Surfaces for cards and choices (UX-007): depth from a soft fill and a diffuse shadow, never a
 * solid outline. One set of classes, so every card in the application flow reads the same in
 * light and dark, and the selected state is a primary tint, not a heavier border.
 */

/** A raised card on the page background (choice cards, summaries). */
export const SURFACE =
  "bg-card shadow-[0_1px_2px_oklch(0.3_0.06_264/0.05),0_10px_28px_-18px_oklch(0.35_0.12_264/0.35)] dark:bg-surface-2/70 dark:shadow-none";

/** A quiet panel inside a card (repeated items, results, uploads): white with a hairline, not grey (UX-017). */
export const SURFACE_MUTED =
  "bg-card ring-1 ring-foreground/[0.06] dark:bg-surface-2/70 dark:ring-white/[0.06]";

/** The chosen option: a primary tint with a faint primary edge from an inset shadow. */
export const SELECTED =
  "bg-primary/[0.07] shadow-[inset_0_0_0_1.5px_color-mix(in_oklch,var(--primary)_40%,transparent)] dark:bg-primary/[0.16] dark:shadow-[inset_0_0_0_1.5px_color-mix(in_oklch,var(--primary)_55%,transparent)]";

/** Smooth, physical response to hover and press (respects reduced motion via the global rule). */
export const INTERACTIVE =
  "transition-[background-color,box-shadow,transform] duration-(--dur-3) ease-(--ease-standard) hover:-translate-y-px active:translate-y-0 active:scale-[0.995]";

/** Hover for an unselected option. */
export const HOVER = "hover:bg-primary/[0.035] dark:hover:bg-surface-3";

/**
 * A page panel (UX-027/031): glass over the pane's ambient wash in light (translucent white,
 * a primary-tinted hairline), the card surface in dark; no shadows, no solid border. Shared by the
 * application flow, dashboard and wallet.
 */
export const PANEL =
  "glass rounded-[1.75rem] p-5 ring-1 ring-primary/[0.08] sm:p-6 dark:ring-white/[0.06]";

/** A row inside a panel (files, payments, confirmations): white with a hairline, not a grey block. */
export const PANEL_ROW =
  "rounded-xl bg-card ring-1 ring-foreground/[0.06] dark:bg-surface-2/70 dark:ring-white/[0.06]";
