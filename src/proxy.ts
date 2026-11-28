import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { hasLocale, LOCALE_COOKIE } from "@/i18n/config";
import { negotiateLocale } from "@/i18n/negotiate";

/** Sections that need a signed-in user. Fine-grained checks happen on the server. */
const PROTECTED = [
  "start",
  "onboarding",
  "pending",
  "suspended",
  "home",
  "responder",
  "admin",
  "c",
  "settings",
  "circles",
  "me",
  "ask",
  "questions",
  "dev",
];

function preferredLocale(request: NextRequest): string {
  return negotiateLocale({
    cookie: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
  });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, first, second] = pathname.split("/");

  if (!first || !hasLocale(first)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  // Optimistic check only (cookie presence). Real validation is in the DAL.
  if (second && PROTECTED.includes(second) && !getSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${first}/sign-in`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
