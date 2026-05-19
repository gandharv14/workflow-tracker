import { NextResponse, type NextRequest } from "next/server";

const VERCEL_AUTH_COOKIES = [
  "_vercel_jwt",
  "_vercel_password",
  "__vercel_password",
  "_vercel_protection_bypass",
  "__vercel_protection_bypass",
];

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function expiredCookie(name: string, domain?: string): string {
  const parts = [
    `${name}=`,
    "Path=/",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join("; ");
}

export function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const homeUrl = new URL("/", requestUrl);
  const redirectUrl = isLocalHost(requestUrl.hostname)
    ? homeUrl
    : new URL(
        `/logout?next=${encodeURIComponent(homeUrl.toString())}`,
        "https://vercel.com",
      );
  const response = NextResponse.redirect(redirectUrl);

  const cookieNames = new Set([
    ...request.cookies.getAll().map((cookie) => cookie.name),
    ...VERCEL_AUTH_COOKIES,
  ]);

  for (const cookieName of cookieNames) {
    response.headers.append("Set-Cookie", expiredCookie(cookieName));
    if (!isLocalHost(requestUrl.hostname)) {
      response.headers.append(
        "Set-Cookie",
        expiredCookie(cookieName, requestUrl.hostname),
      );
    }
  }
  response.headers.set("Clear-Site-Data", '"cookies"');

  return response;
}
