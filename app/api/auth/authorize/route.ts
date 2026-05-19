import crypto from "node:crypto";

import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import {
  OAUTH_CODE_VERIFIER_COOKIE,
  OAUTH_NEXT_COOKIE,
  OAUTH_NONCE_COOKIE,
  OAUTH_STATE_COOKIE,
  authCookieOptions,
  isAuthorizedEmail,
  sanitizeRedirectPath,
} from "@/lib/auth";

const OAUTH_COOKIE_MAX_AGE = 10 * 60;

export async function GET(request: NextRequest) {
  const nextPath = sanitizeRedirectPath(request.nextUrl.searchParams.get("next"));
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();

  if (!email) {
    const params = new URLSearchParams({
      error: "email-required",
      next: nextPath,
    });
    return NextResponse.redirect(new URL(`/sign-in?${params}`, request.url));
  }

  if (!isAuthorizedEmail(email)) {
    return NextResponse.redirect(
      new URL("/auth/error?reason=access-denied", request.url),
    );
  }

  const clientId = process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/auth/error?reason=configuration", request.url),
    );
  }

  const state = randomString();
  const nonce = randomString();
  const codeVerifier = randomString(64);
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const cookieStore = await cookies();
  const cookieOptions = authCookieOptions(OAUTH_COOKIE_MAX_AGE);
  cookieStore.set(OAUTH_STATE_COOKIE, state, cookieOptions);
  cookieStore.set(OAUTH_NONCE_COOKIE, nonce, cookieOptions);
  cookieStore.set(OAUTH_CODE_VERIFIER_COOKIE, codeVerifier, cookieOptions);
  cookieStore.set(
    OAUTH_NEXT_COOKIE,
    nextPath,
    cookieOptions,
  );

  const queryParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${request.nextUrl.origin}/api/auth/callback`,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    response_type: "code",
    scope: "openid email profile offline_access",
  });

  return NextResponse.redirect(
    `https://vercel.com/oauth/authorize?${queryParams.toString()}`,
  );
}

function randomString(length = 43): string {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}
