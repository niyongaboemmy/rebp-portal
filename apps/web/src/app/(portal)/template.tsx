import { PageTransition } from "@/components/motion/page-transition";

/** Remounts per page, so each navigation plays the enter/exit view transition (ADR-009). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
