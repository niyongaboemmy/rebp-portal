import { SurveySkeleton } from "@/components/wizard/wizard-skeleton";

/** The page's own shape while it loads (UX-009), not the applications list's. */
export default function NewApplicationLoading() {
  return <SurveySkeleton />;
}
