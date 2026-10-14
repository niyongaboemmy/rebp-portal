import type { MfaMethod } from "@rebp/contracts";
import type { User } from "@/generated/prisma/client";
import type { RequestContext } from "../request-context";

export type { RequestContext };

export type LoginOutcome =
  | { kind: "session"; token: string; expiresAt: Date; user: User }
  | {
      kind: "mfa";
      challengeToken: string;
      expiresAt: Date;
      method: MfaMethod;
      methods: MfaMethod[];
    };

export type ContactChannel = "EMAIL" | "PHONE";
