import type { RuleResult } from "@rebp/contracts";
import {
  Award,
  Briefcase,
  Building2,
  Cake,
  Calendar,
  Certificate,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Handshake,
  ListChecks,
  Scale,
  ShieldCheck,
  UserCheck,
  Users,
  type LucideIcon,
} from "@/components/icons";

/**
 * The visual vocabulary of a problem (UX-020): what it's about as an icon and one word, the
 * verdict in two or three words ("Missing", "7 months short"), the action as a verb ("Add
 * experience"), and a meter when it's a number to reach. The full sentence stays one tap away.
 */

const TOPICS: Array<[readonly string[], LucideIcon, string]> = [
  [["BR-001"], Cake, "age"],
  [["BR-010", "BR-011"], GraduationCap, "education"],
  [["BR-012", "BR-013", "BR-014"], Certificate, "qualification"],
  [["BR-015"], Award, "training"],
  [["BR-016"], ClipboardCheck, "exam"],
  [["BR-020", "BR-021", "BR-022", "BR-023"], Briefcase, "experience"],
  [["BR-030"], UserCheck, "supervisor"],
  [["BR-031", "BR-032"], Users, "broker"],
  [["BR-033", "BR-035"], Building2, "firm"],
  [["BR-036"], Handshake, "authorisation"],
  [["BR-040", "BR-041", "BR-042"], Calendar, "licence"],
  [["BR-060"], ShieldCheck, "integrity"],
  [["BR-061"], FileText, "certificate"],
  [["BR-062"], Scale, "conduct"],
  [["BR-070"], ShieldCheck, "indemnity"],
];

export function topicOf(rule: Pick<RuleResult, "id">): { icon: LucideIcon; key: string } {
  const hit = TOPICS.find(([ids]) => ids.includes(rule.id));
  return hit ? { icon: hit[1], key: hit[2] } : { icon: ListChecks, key: "requirement" };
}

/** A rule about reaching a number (experience, age) as a meter toward it. */
export function meterOf(rule: RuleResult) {
  const values = rule.values ?? {};
  const evidence = (rule.evidence ?? {}) as Record<string, unknown>;
  if (typeof evidence.months === "number" && typeof values.required === "number")
    return { value: evidence.months, max: values.required * 12, kind: "experience" as const };
  if (typeof values.age === "number" && typeof values.min === "number")
    return { value: values.age, max: values.min, kind: "age" as const };
  return null;
}

/** The verdict's key: the message's own ending ("BR-016.expired" → "expired"). */
export function verdictKey(rule: Pick<RuleResult, "message">) {
  return rule.message.split(".").pop() ?? "fail";
}

/** Rules whose way out is a known action, as a verb (wizard.issue.do.*). */
const ACTIONS: Record<string, string> = {
  "BR-001": "dateOfBirth",
  "BR-010": "education",
  "BR-011": "education",
  "BR-012": "qualification",
  "BR-013": "qualification",
  "BR-014": "qualification",
  "BR-015": "training",
  "BR-016": "exam",
  "BR-020": "experience",
  "BR-021": "experience",
  "BR-022": "experience",
  "BR-030": "supervisor",
  "BR-031": "broker",
  "BR-032": "broker",
  "BR-033": "firm",
  "BR-035": "firm",
  "BR-036": "authorisation",
  "BR-061": "certificate",
  "BR-062": "conduct",
  "BR-070": "indemnity",
};

export function actionKey(rule: Pick<RuleResult, "id">) {
  return ACTIONS[rule.id] ?? "fix";
}
