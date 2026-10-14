import {
  BookUser,
  Building2,
  ClipboardCheck,
  Crown,
  Gavel,
  ScanSearch,
  Settings2,
  UserCheck,
  UserRound,
  Wallet,
  type LucideIcon,
} from "@/components/icons";
import type { Role } from "@rebp/contracts";

/** Visual identity per role: an icon and a hue used by `.role-tint` (light/dark aware). */
export const ROLE_META: Record<Role, { icon: LucideIcon; hue: number }> = {
  APPLICANT: { icon: UserRound, hue: 172 },
  SUPERVISOR: { icon: UserCheck, hue: 200 },
  PRINCIPAL_BROKER: { icon: Crown, hue: 80 },
  FIRM_ADMIN: { icon: Building2, hue: 250 },
  REVIEWING_OFFICER: { icon: ClipboardCheck, hue: 145 },
  APPROVING_AUTHORITY: { icon: Gavel, hue: 25 },
  REGISTRAR: { icon: BookUser, hue: 310 },
  FINANCE_OFFICER: { icon: Wallet, hue: 55 },
  SYSTEM_ADMIN: { icon: Settings2, hue: 280 },
  AUDITOR: { icon: ScanSearch, hue: 225 },
};

/** next-intl treats dots as nesting, so capability ids map to underscore keys. */
export const capabilityKey = (capability: string) => capability.replace(/\./g, "_");
