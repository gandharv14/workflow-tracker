import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("/logout", () => {
  it("clears request and Vercel auth cookies before showing the app logout page", async () => {
    const request = new NextRequest("http://localhost/logout", {
      headers: {
        cookie: "workflow_session=abc; another_cookie=xyz",
      },
    });

    const response = GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("Clear-Site-Data")).toBe('"cookies"');
    await expect(response.text()).resolves.toContain(
      'href="http://localhost/"',
    );
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("workflow_session=;"),
        expect.stringContaining("another_cookie=;"),
        expect.stringContaining("_vercel_jwt=;"),
        expect.stringContaining("_vercel_password=;"),
      ]),
    );
  });

  it("stays on the app origin for deployed hosts instead of logging out of Vercel", async () => {
    const request = new NextRequest("https://workflow.example.com/logout", {
      headers: {
        cookie: "_vercel_jwt=abc",
      },
    });

    const response = GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    await expect(response.text()).resolves.toContain(
      'href="https://workflow.example.com/"',
    );
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("_vercel_jwt=;"),
        expect.stringContaining("Domain=workflow.example.com"),
      ]),
    );
  });
});
