import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("/logout", () => {
  it("clears request and Vercel auth cookies locally before redirecting home", () => {
    const request = new NextRequest("http://localhost/logout", {
      headers: {
        cookie: "workflow_session=abc; another_cookie=xyz",
      },
    });

    const response = GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
    expect(response.headers.get("Clear-Site-Data")).toBe('"cookies"');
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("workflow_session=;"),
        expect.stringContaining("another_cookie=;"),
        expect.stringContaining("_vercel_jwt=;"),
        expect.stringContaining("_vercel_password=;"),
      ]),
    );
  });

  it("uses Vercel account logout on deployed hosts to avoid automatic re-auth", () => {
    const request = new NextRequest("https://workflow.example.com/logout", {
      headers: {
        cookie: "_vercel_jwt=abc",
      },
    });

    const response = GET(request);
    const location = response.headers.get("location");

    expect(location).not.toBeNull();
    expect(location).toMatch(/^https:\/\/vercel\.com\/logout\?next=/);
    expect(decodeURIComponent(new URL(location ?? "").searchParams.get("next") ?? "")).toBe(
      "https://workflow.example.com/",
    );
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("_vercel_jwt=;"),
        expect.stringContaining("Domain=workflow.example.com"),
      ]),
    );
  });
});
