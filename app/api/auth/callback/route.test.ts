import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACCESS_TOKEN_COOKIE,
  AUTH_COOKIE,
  AUTHORIZED_EMAILS,
  OAUTH_CODE_VERIFIER_COOKIE,
  OAUTH_NEXT_COOKIE,
  OAUTH_NONCE_COOKIE,
  OAUTH_STATE_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth";

const mocks = vi.hoisted(() => ({
  cookieSet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: mocks.cookieSet,
  })),
}));

const state = "test-state";
const nonce = "test-nonce";
const codeVerifier = "test-code-verifier";

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: {
      cookie: [
        `${OAUTH_STATE_COOKIE}=${state}`,
        `${OAUTH_NONCE_COOKIE}=${nonce}`,
        `${OAUTH_CODE_VERIFIER_COOKIE}=${codeVerifier}`,
        `${OAUTH_NEXT_COOKIE}=/people`,
      ].join("; "),
    },
  });
}

function idTokenWithNonce(): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify({ nonce })).toString("base64url");
  return `${header}.${payload}.`;
}

function mockVercelResponses(email: string) {
  const fetchMock = vi.mocked(globalThis.fetch);
  fetchMock
    .mockResolvedValueOnce(
      Response.json({
        access_token: "test-access-token",
        token_type: "bearer",
        id_token: idTokenWithNonce(),
        expires_in: 3600,
        scope: "openid email profile offline_access",
        refresh_token: "test-refresh-token",
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        email,
        name: "Authorized User",
        picture: null,
      }),
    );
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID = "test-client-id";
  process.env.VERCEL_APP_CLIENT_SECRET = "test-client-secret";
  vi.spyOn(globalThis, "fetch");
  mocks.cookieSet.mockReset();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID;
  delete process.env.VERCEL_APP_CLIENT_SECRET;
  vi.restoreAllMocks();
});

describe("/api/auth/callback", () => {
  it.each(AUTHORIZED_EMAILS)("creates a session for %s", async (email) => {
    const { GET } = await import("./route");
    mockVercelResponses(email);

    const response = await GET(
      request(`/api/auth/callback?code=test-code&state=${state}`),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/people");
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      AUTH_COOKIE,
      expect.any(String),
      expect.objectContaining({ maxAge: 60 * 60 * 24 * 30 }),
    );
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      "test-access-token",
      expect.objectContaining({ maxAge: 3600 }),
    );
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      "test-refresh-token",
      expect.objectContaining({ maxAge: 60 * 60 * 24 * 30 }),
    );
  });

  it("denies a Vercel account email outside the allowlist", async () => {
    const { GET } = await import("./route");
    mockVercelResponses("someone@example.com");

    const response = await GET(
      request(`/api/auth/callback?code=test-code&state=${state}`),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/auth/error?reason=access-denied",
    );
    expect(mocks.cookieSet).not.toHaveBeenCalledWith(
      AUTH_COOKIE,
      expect.any(String),
      expect.anything(),
    );
  });
});
