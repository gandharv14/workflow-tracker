import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import {
  ACCESS_TOKEN_COOKIE,
  AUTH_COOKIE,
  OAUTH_CODE_VERIFIER_COOKIE,
  OAUTH_NEXT_COOKIE,
  OAUTH_NONCE_COOKIE,
  OAUTH_STATE_COOKIE,
  REFRESH_TOKEN_COOKIE,
  authCookieOptions,
  createSessionCookieValue,
  isAuthorizedEmail,
  sanitizeRedirectPath,
  type AuthUser,
} from "@/lib/auth";

type TokenData = {
  access_token: string;
  token_type: string;
  id_token: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
};

type VercelUserInfo = {
  email?: unknown;
  name?: unknown;
  picture?: unknown;
};

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return redirectWithClearedOAuthCookies(request, "denied");
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const storedNonce = request.cookies.get(OAUTH_NONCE_COOKIE)?.value;
  const codeVerifier = request.cookies.get(OAUTH_CODE_VERIFIER_COOKIE)?.value;
  const nextPath = sanitizeRedirectPath(
    request.cookies.get(OAUTH_NEXT_COOKIE)?.value,
  );

  if (!code || !state || state !== storedState || !storedNonce || !codeVerifier) {
    return redirectWithClearedOAuthCookies(request, "invalid-callback");
  }

  try {
    const tokenData = await exchangeCodeForToken(
      code,
      codeVerifier,
      request.nextUrl.origin,
    );
    if (decodeNonce(tokenData.id_token) !== storedNonce) {
      return redirectWithClearedOAuthCookies(request, "invalid-callback");
    }

    const user = await fetchVercelUser(tokenData.access_token);
    if (!isAuthorizedEmail(user.email)) {
      return redirectWithClearedOAuthCookies(request, "access-denied");
    }

    const cookieStore = await cookies();
    cookieStore.set(
      AUTH_COOKIE,
      createSessionCookieValue(user),
      authCookieOptions(),
    );
    cookieStore.set(
      ACCESS_TOKEN_COOKIE,
      tokenData.access_token,
      authCookieOptions(tokenData.expires_in),
    );
    if (tokenData.refresh_token) {
      cookieStore.set(
        REFRESH_TOKEN_COOKIE,
        tokenData.refresh_token,
        authCookieOptions(),
      );
    }
    clearOAuthCookies(cookieStore);

    return NextResponse.redirect(new URL(nextPath, request.url));
  } catch (err) {
    console.error("Vercel auth callback failed:", err);
    return redirectWithClearedOAuthCookies(request, "callback-failed");
  }
}

async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  requestOrigin: string,
): Promise<TokenData> {
  const clientId = process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID;
  const clientSecret = process.env.VERCEL_APP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing Vercel app client configuration");
  }

  const response = await fetch("https://api.vercel.com/login/oauth/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: `${requestOrigin}/api/auth/callback`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed with ${response.status}`);
  }

  return (await response.json()) as TokenData;
}

async function fetchVercelUser(accessToken: string): Promise<AuthUser> {
  const response = await fetch("https://api.vercel.com/login/oauth/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Userinfo request failed with ${response.status}`);
  }

  const data = (await response.json()) as VercelUserInfo;
  if (typeof data.email !== "string") {
    throw new Error("Vercel userinfo response did not include an email");
  }

  return {
    email: data.email.trim().toLowerCase(),
    name: typeof data.name === "string" ? data.name : null,
    picture: typeof data.picture === "string" ? data.picture : null,
  };
}

function decodeNonce(idToken: string): string | null {
  const [, payload] = idToken.split(".");
  if (!payload) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { nonce?: unknown };
    return typeof decoded.nonce === "string" ? decoded.nonce : null;
  } catch {
    return null;
  }
}

async function redirectWithClearedOAuthCookies(
  request: NextRequest,
  reason: string,
) {
  const cookieStore = await cookies();
  clearOAuthCookies(cookieStore);
  return NextResponse.redirect(
    new URL(`/auth/error?reason=${encodeURIComponent(reason)}`, request.url),
  );
}

function clearOAuthCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const options = authCookieOptions(0);
  cookieStore.set(OAUTH_STATE_COOKIE, "", options);
  cookieStore.set(OAUTH_NONCE_COOKIE, "", options);
  cookieStore.set(OAUTH_CODE_VERIFIER_COOKIE, "", options);
  cookieStore.set(OAUTH_NEXT_COOKIE, "", options);
}
