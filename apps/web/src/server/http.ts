import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { requiresMfa, type Capability } from "@rebp/contracts";
import { userCan } from "./access/permissions";
import { isFullyVerified } from "./auth/account";
import { getCurrentSession } from "./auth/current";
import type { SessionWithUser } from "./auth/session";
import { env } from "./env";
import { isAppError } from "./errors";

/**
 * Helpers for route handlers (file transfer, webhooks, exports). Route handlers are public
 * endpoints like server actions: each one authenticates and authorises itself.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiUser(capability?: Capability): Promise<SessionWithUser> {
  const current = await getCurrentSession();
  if (!current) throw new HttpError(401, "unauthenticated");
  const { user, session } = current;
  if (!isFullyVerified(user)) throw new HttpError(403, "forbidden");
  if (requiresMfa(user.roles) && (user.mfaMethods.length === 0 || !session.mfaVerified))
    throw new HttpError(403, "mfaRequired");
  if (capability && !(await userCan(user, capability))) throw new HttpError(403, "forbidden");
  return current;
}

/** CSRF defence for cookie-authenticated POSTs: the Origin must be this site (SEC-002). */
export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowed = new URL(env().APP_URL).origin;
  const self = request.nextUrl.origin;
  if (!origin || (origin !== allowed && origin !== self)) throw new HttpError(403, "badOrigin");
}

export function contextOf(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ipAddress: forwarded || request.headers.get("x-real-ip") || null,
    userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
  };
}

/** Maps thrown errors to JSON. Domain errors keep their i18n key; anything else is generic. */
export function errorResponse(error: unknown) {
  if (error instanceof HttpError)
    return NextResponse.json({ error: `errors.${error.message}` }, { status: error.status });
  if (isAppError(error)) {
    const status = error.code === "notFound" ? 404 : error.code === "forbidden" ? 403 : 400;
    return NextResponse.json({ error: error.message, meta: error.meta }, { status });
  }
  console.error("[api] unexpected error", (error as Error)?.name, (error as Error)?.message);
  return NextResponse.json({ error: "errors.unexpected" }, { status: 500 });
}

/** Private, non-cacheable file response. */
export function fileResponse(
  bytes: Uint8Array | Buffer,
  { contentType, fileName, inline }: { contentType: string; fileName: string; inline: boolean },
) {
  const safe = fileName.replace(/[^\w.-]/g, "_");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safe}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Previews may be framed by the portal's own document viewer only.
      "Content-Security-Policy":
        "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; frame-ancestors 'self'",
    },
  });
}
