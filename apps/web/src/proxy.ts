import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic route protection: redirect early when no session cookie exists.
 * Authoritative checks (validity, verification, MFA, roles) happen in server guards.
 */
const PROTECTED_PREFIXES = ["/dashboard", "/applications", "/settings", "/backoffice", "/verify"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname + search);

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const hasSession =
    request.cookies.has("rebp_session") || request.cookies.has("__Host-rebp_session");
  if (isProtected && !hasSession) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff2?)$).*)",
  ],
};
