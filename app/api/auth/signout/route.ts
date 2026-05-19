import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ACCESS_TOKEN_COOKIE,
  AUTH_COOKIE,
  REFRESH_TOKEN_COOKIE,
  authCookieOptions,
} from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (accessToken) {
    await revokeAccessToken(accessToken);
  }

  const options = authCookieOptions(0);
  cookieStore.set(AUTH_COOKIE, "", options);
  cookieStore.set(ACCESS_TOKEN_COOKIE, "", options);
  cookieStore.set(REFRESH_TOKEN_COOKIE, "", options);

  return NextResponse.json({ ok: true });
}

async function revokeAccessToken(accessToken: string): Promise<void> {
  const clientId = process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID;
  const clientSecret = process.env.VERCEL_APP_CLIENT_SECRET;
  if (!clientId || !clientSecret) return;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  try {
    const response = await fetch(
      "https://api.vercel.com/login/oauth/token/revoke",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({ token: accessToken }),
      },
    );

    if (!response.ok) {
      console.error(`Vercel token revoke failed with ${response.status}`);
    }
  } catch (err) {
    console.error("Vercel token revoke failed:", err);
  }
}
