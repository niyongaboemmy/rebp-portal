"use client";

import type { Capability } from "@rebp/contracts";
import { HeaderAccountMenu } from "./account-menu";

/** Public-header account menu: the same items as the app shell's (ADR-011), plus "My portal". */
export function UserMenu({
  name,
  email,
  photoUrl,
  capabilities,
}: {
  name: string;
  email: string;
  photoUrl?: string | null;
  capabilities: Capability[];
}) {
  return (
    <HeaderAccountMenu
      user={{ fullName: name, email, photoUrl }}
      area={null}
      capabilities={capabilities}
    />
  );
}
