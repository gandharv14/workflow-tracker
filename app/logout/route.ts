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

function loggedOutPage(homeUrl: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Logged out - Workflow Tracker</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        background: Canvas;
        color: CanvasText;
      }
      main {
        width: min(26rem, calc(100vw - 2rem));
        border: 1px solid color-mix(in oklab, CanvasText 18%, transparent);
        border-radius: 1rem;
        padding: 2rem;
        text-align: center;
        box-shadow: 0 20px 45px color-mix(in oklab, CanvasText 10%, transparent);
      }
      h1 {
        margin: 0;
        font-size: 1.25rem;
      }
      p {
        margin: 0.75rem 0 1.5rem;
        color: color-mix(in oklab, CanvasText 65%, transparent);
        line-height: 1.5;
      }
      a {
        display: inline-flex;
        min-height: 2.25rem;
        align-items: center;
        justify-content: center;
        border-radius: 0.625rem;
        background: CanvasText;
        color: Canvas;
        padding: 0 0.875rem;
        font-size: 0.875rem;
        font-weight: 600;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Logged out of Workflow Tracker</h1>
      <p>Your access cookie for this app was cleared. Use the button below to log back into this workflow app.</p>
      <a href="${homeUrl}">Log in to Workflow Tracker</a>
    </main>
  </body>
</html>`;
}

export function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const homeUrl = new URL("/", requestUrl);
  const response = new NextResponse(loggedOutPage(homeUrl.toString()), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

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
