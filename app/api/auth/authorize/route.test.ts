import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTHORIZED_EMAILS,
  OAUTH_CODE_VERIFIER_COOKIE,
  OAUTH_NEXT_COOKIE,
  OAUTH_NONCE_COOKIE,
  OAUTH_STATE_COOKIE,
} from "@/lib/auth";

const mocks = vi.hoisted(() => ({
  cookieSet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: mocks.cookieSet,
  })),
}));

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID = "test-client-id";
  mocks.cookieSet.mockReset();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID;
});

describe("/api/auth/authorize", () => {
  it.each(AUTHORIZED_EMAILS)(
    "allows %s to continue to Vercel OAuth",
    async (email) => {
      const { GET } = await import("./route");

      const response = await GET(
        request(
          `/api/auth/authorize?email=${encodeURIComponent(email)}&next=/people`,
        ),
      );

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toBeTruthy();

      const redirectUrl = new URL(location as string);
      expect(redirectUrl.origin).toBe("https://vercel.com");
      expect(redirectUrl.pathname).toBe("/oauth/authorize");
      expect(redirectUrl.searchParams.get("client_id")).toBe("test-client-id");
      expect(redirectUrl.searchParams.get("redirect_uri")).toBe(
        "http://localhost/api/auth/callback",
      );
      expect(redirectUrl.searchParams.get("scope")).toBe(
        "openid email profile offline_access",
      );

      expect(mocks.cookieSet).toHaveBeenCalledWith(
        OAUTH_NEXT_COOKIE,
        "/people",
        expect.objectContaining({ maxAge: 600 }),
      );
      expect(mocks.cookieSet).toHaveBeenCalledWith(
        OAUTH_STATE_COOKIE,
        expect.any(String),
        expect.objectContaining({ maxAge: 600 }),
      );
      expect(mocks.cookieSet).toHaveBeenCalledWith(
        OAUTH_NONCE_COOKIE,
        expect.any(String),
        expect.objectContaining({ maxAge: 600 }),
      );
      expect(mocks.cookieSet).toHaveBeenCalledWith(
        OAUTH_CODE_VERIFIER_COOKIE,
        expect.any(String),
        expect.objectContaining({ maxAge: 600 }),
      );
    },
  );

  it("allows authorized emails case-insensitively", async () => {
    const { GET } = await import("./route");

    const response = await GET(
      request("/api/auth/authorize?email=GMAHAJAN%40LABELBOX.COM"),
    );

    expect(response.headers.get("location")).toContain(
      "https://vercel.com/oauth/authorize",
    );
  });

  it("rejects emails outside the allowlist before Vercel OAuth", async () => {
    const { GET } = await import("./route");

    const response = await GET(
      request("/api/auth/authorize?email=someone@example.com"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/auth/error?reason=access-denied",
    );
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("returns to sign-in when email is missing", async () => {
    const { GET } = await import("./route");

    const response = await GET(request("/api/auth/authorize?next=/people"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/sign-in?error=email-required&next=%2Fpeople",
    );
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
});
