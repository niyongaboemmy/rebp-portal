import { ViewTransition } from "react";

/**
 * Route enter/exit animation (Next 16 + React 19.3 <ViewTransition>). Used from each route
 * group's `template.tsx`, which remounts on navigation, so pages animate without each page
 * opting in. Unsupported browsers simply don't animate; reduced motion keeps only a fade.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page" exit="page" default="none">
      {children}
    </ViewTransition>
  );
}
