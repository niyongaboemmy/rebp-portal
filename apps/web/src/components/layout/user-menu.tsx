"use client";

import type { Capability } from "@rebp/contracts";
import { HeaderAccountMenu } from "./account-menu";

/** Public-header account menu: the shell's items (ADR-011) plus "My portal" (applicants) or "Dashboard". */
export function UserMenu({
  name,
  email,
  photoUrl,
  person,
  applicant,
  capabilities,
}: {
  name: string;
  email: string;
  photoUrl?: string | null;
  person: boolean;
  applicant: boolean;
  capabilities: Capability[];
}) {
  return (
    <HeaderAccountMenu
      user={{ fullName: name, email, photoUrl, person, applicant }}
      area={null}
      capabilities={capabilities}
    />
  );
}
