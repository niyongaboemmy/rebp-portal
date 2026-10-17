/**
 * Opts a page into the wide content measure (ADR-011): queues, tables and consoles. Renders a
 * hidden marker that shell.css detects with `#main:has([data-page-width=wide])`, so pages need
 * no wrapper.
 */
export function PageWidth({ wide }: { wide: true }) {
  return wide ? <span hidden data-page-width="wide" /> : null;
}
