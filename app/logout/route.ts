import { NextResponse, type NextRequest } from "next/server";

export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url));

  for (const cookie of request.cookies.getAll()) {
    response.cookies.delete(cookie.name);
  }

  return response;
}
