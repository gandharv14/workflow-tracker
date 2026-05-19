import "server-only";

import crypto from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export type AuthUser = {
  email: string;
  name?: string | null;
  picture?: string | null;
};

export const AUTHORIZED_EMAILS = [
  "gmahajan@labelbox.com",
  "hfell@labelbox.com",
  "mhernandez@labelbox.com",
  "aguennou@labelbox.com",
  "bliu@labelbox.com",
] as const;

export const AUTH_COOKIE = "workflow_tracker_session";
export const ACCESS_TOKEN_COOKIE = "workflow_tracker_access_token";
export const REFRESH_TOKEN_COOKIE = "workflow_tracker_refresh_token";
export const OAUTH_STATE_COOKIE = "workflow_tracker_oauth_state";
export const OAUTH_NONCE_COOKIE = "workflow_tracker_oauth_nonce";
export const OAUTH_CODE_VERIFIER_COOKIE = "workflow_tracker_oauth_code_verifier";
export const OAUTH_NEXT_COOKIE = "workflow_tracker_oauth_next";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

type SessionPayload = AuthUser & {
  expiresAt: number;
};

export function isAuthorizedEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return AUTHORIZED_EMAILS.includes(
    normalized as (typeof AUTHORIZED_EMAILS)[number],
  );
}

export function sanitizeRedirectPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  try {
    const url = new URL(value, "http://localhost");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function authCookieOptions(maxAge = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function createSessionCookieValue(user: AuthUser): string {
  const payload: SessionPayload = {
    email: user.email.trim().toLowerCase(),
    name: user.name ?? null,
    picture: user.picture ?? null,
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function readSessionCookie(value: string | undefined): AuthUser | null {
  if (!value) return null;

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature || !safeEqual(signature, sign(encodedPayload))) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;

    if (
      typeof payload.email !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt < Date.now() ||
      !isAuthorizedEmail(payload.email)
    ) {
      return null;
    }

    return {
      email: payload.email.trim().toLowerCase(),
      name: typeof payload.name === "string" ? payload.name : null,
      picture: typeof payload.picture === "string" ? payload.picture : null,
    };
  } catch {
    return null;
  }
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  return readSessionCookie(cookieStore.get(AUTH_COOKIE)?.value);
}

export async function requireAuthUser(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    redirect("/sign-in?next=/");
  }
  return user;
}

export async function requireApiAuth(): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  const user = await getAuthUser();
  if (user) {
    return null;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function getSessionSecret(): string {
  const secret =
    process.env.WORKFLOW_TRACKER_AUTH_SECRET ?? process.env.VERCEL_APP_CLIENT_SECRET;
  if (!secret) {
    throw new Error(
      "Missing WORKFLOW_TRACKER_AUTH_SECRET or VERCEL_APP_CLIENT_SECRET",
    );
  }
  return secret;
}

function sign(value: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}
