import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/sign-up", "/forgot-password", "/reset-password"];
const AUTH_ONLY_GUEST = new Set(["/login", "/sign-up", "/forgot-password"]);

/**
 * Pengalihan optimistik berdasarkan keberadaan cookie session (cepat, tanpa database).
 * Validasi session sesungguhnya dilakukan server-side oleh requireSession() di layout (app).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasCookie = Boolean(getSessionCookie(request));
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasCookie && !isPublic) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (hasCookie && AUTH_ONLY_GUEST.has(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Kecualikan API (auth & health menangani akses sendiri), aset Next, dan file statis.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
