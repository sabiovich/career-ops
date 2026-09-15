import { checkPersonalAccess } from "@/lib/access-guard.mjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkRequest,
  parseAllowedHosts,
  parseAllowedOrigins,
} from "@/lib/origin-guard.mjs";

// Single choke point over the API surface. Every /api request is gated on the
// same-origin + loopback guard before it can reach a route handler (which may
// spawn a child process or write the user's files). See origin-guard.mjs for
// the two-layer rationale (F1 drive-by CSRF, F2 LAN reachability).
//
// Opt in to extra hosts (e.g. a trusted LAN box) with a comma/space separated
// CAREER_OPS_WEB_ALLOWED_HOSTS; unset means loopback only.
//
// Opt in to extra *origins* the same way with CAREER_OPS_ALLOWED_ORIGINS;
// unset means none, which is the default and leaves the guard as strict as it
// was. It is what a local companion client needs: a browser extension calls
// from a chrome-extension:// origin, which Fetch Metadata always reports as
// "cross-site", so every one of its requests is refused otherwise.
export function proxy(req: NextRequest) {
  const access = checkPersonalAccess({authorization:req.headers.get("authorization"),host:req.headers.get("host"),password:process.env.CAREER_OPS_WEB_PASSWORD,enabled:process.env.CAREER_OPS_PERSONAL_WEB === "true"});
  if (!access.ok) return new NextResponse(access.reason, {status:access.status,headers:access.status===401?{"WWW-Authenticate":'Basic realm="Career-Ops personnel", charset="UTF-8"',"Cache-Control":"no-store"}:{"Cache-Control":"no-store"}});
  if (!req.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();
  const decision = checkRequest({
    secFetchSite: req.headers.get("sec-fetch-site"),
    origin: req.headers.get("origin"),
    host: req.headers.get("host"),
    allowedHosts: parseAllowedHosts(process.env.CAREER_OPS_WEB_ALLOWED_HOSTS),
    allowedOrigins: parseAllowedOrigins(process.env.CAREER_OPS_ALLOWED_ORIGINS),
  });
  if (!decision.ok) {
    return NextResponse.json({ error: decision.reason }, { status: decision.status });
  }
  return NextResponse.next();
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
