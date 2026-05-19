import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("/logout", () => {
  it("clears request cookies and redirects home", () => {
    const request = new NextRequest("http://localhost/logout", {
      headers: {
        cookie: "workflow_session=abc; another_cookie=xyz",
      },
    });

    const response = GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("workflow_session=;"),
        expect.stringContaining("another_cookie=;"),
      ]),
    );
  });
});
