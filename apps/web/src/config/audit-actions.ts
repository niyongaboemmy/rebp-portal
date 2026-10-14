import {
  BadgeCheck,
  CircleUserRound,
  KeyRound,
  Link2,
  Link2Off,
  Lock,
  LogIn,
  LogOut,
  MailCheck,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  Smartphone,
  UserCheck,
  UserCog,
  UserPlus,
  UserX,
  type LucideIcon,
} from "@/components/icons";
import type { StatusTone } from "@rebp/contracts";

/**
 * Human presentation of audit actions (FR-AUD-001/004): category for filtering, icon and tone
 * for scanning. Labels live in messages under `auditActions.<action with "." → "_">`.
 */
export const AUDIT_CATEGORIES = ["signin", "account", "twoStep", "access"] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

interface ActionMeta {
  category: AuditCategory;
  icon: LucideIcon;
  tone: StatusTone;
}

export const AUDIT_ACTIONS: Record<string, ActionMeta> = {
  "auth.signin": { category: "signin", icon: LogIn, tone: "info" },
  "auth.signout": { category: "signin", icon: LogOut, tone: "neutral" },
  "auth.signin_failed": { category: "signin", icon: ShieldAlert, tone: "warning" },
  "auth.mfa_challenged": { category: "signin", icon: ShieldCheck, tone: "neutral" },
  "auth.mfa_failed": { category: "signin", icon: ShieldAlert, tone: "warning" },
  "auth.locked": { category: "signin", icon: Lock, tone: "critical" },
  "auth.reauth_failed": { category: "signin", icon: ShieldAlert, tone: "warning" },
  "auth.session_revoked": { category: "signin", icon: LogOut, tone: "neutral" },
  "auth.sessions_revoked": { category: "signin", icon: LogOut, tone: "warning" },
  "account.created": { category: "account", icon: UserPlus, tone: "good" },
  "account.email_verified": { category: "account", icon: MailCheck, tone: "good" },
  "account.phone_verified": { category: "account", icon: Smartphone, tone: "good" },
  "account.phone_changed": { category: "account", icon: Smartphone, tone: "info" },
  "auth.password_changed": { category: "account", icon: KeyRound, tone: "info" },
  "auth.password_set": { category: "account", icon: KeyRound, tone: "info" },
  "auth.password_reset": { category: "account", icon: KeyRound, tone: "info" },
  "auth.password_reset_requested": { category: "account", icon: KeyRound, tone: "neutral" },
  "auth.google_linked": { category: "account", icon: Link2, tone: "info" },
  "auth.google_unlinked": { category: "account", icon: Link2Off, tone: "info" },
  "mfa.enabled": { category: "twoStep", icon: ShieldCheck, tone: "good" },
  "mfa.disabled": { category: "twoStep", icon: ShieldOff, tone: "warning" },
  "mfa.preferred_changed": { category: "twoStep", icon: ShieldCheck, tone: "neutral" },
  "mfa.recovery_codes_regenerated": { category: "twoStep", icon: KeyRound, tone: "neutral" },
  "access.roles_changed": { category: "access", icon: UserCog, tone: "warning" },
  "access.permissions_changed": { category: "access", icon: SlidersHorizontal, tone: "warning" },
  "access.permissions_reset": { category: "access", icon: SlidersHorizontal, tone: "info" },
  "access.account_disabled": { category: "access", icon: UserX, tone: "critical" },
  "access.account_enabled": { category: "access", icon: UserCheck, tone: "good" },
};

export const UNKNOWN_ACTION: ActionMeta = {
  category: "account",
  icon: CircleUserRound,
  tone: "neutral",
};

export function actionsIn(category: AuditCategory): string[] {
  return Object.entries(AUDIT_ACTIONS)
    .filter(([, meta]) => meta.category === category)
    .map(([action]) => action);
}

export function isAuditCategory(value: unknown): value is AuditCategory {
  return typeof value === "string" && (AUDIT_CATEGORIES as readonly string[]).includes(value);
}

/** Message key for an action's human label. */
export function actionLabelKey(action: string): string {
  return `auditActions.${action.replace(/\./g, "_")}`;
}

export const CATEGORY_ICONS: Record<AuditCategory, LucideIcon> = {
  signin: LogIn,
  account: BadgeCheck,
  twoStep: ShieldCheck,
  access: UserCog,
};
