import { NextResponse, type NextRequest } from "next/server";
import { decodeSession, HOME, SESSION_COOKIE, type Role } from "@/lib/session";

const GUARDED: Record<string, Role> = { "/helper": "helper", "/family": "family", "/gp": "gp" };

export function proxy(req: NextRequest) {
  const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = req.nextUrl;

  if (pathname === "/" || pathname === "/login") {
    return session ? NextResponse.redirect(new URL(HOME[session.role], req.url)) : pathname === "/" ? NextResponse.redirect(new URL("/login", req.url)) : NextResponse.next();
  }

  const required = Object.entries(GUARDED).find(([p]) => pathname.startsWith(p))?.[1];
  if (required && session?.role !== required) {
    return NextResponse.redirect(new URL(session ? HOME[session.role] : "/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/login", "/helper/:path*", "/family/:path*", "/gp/:path*"] };
