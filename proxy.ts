import { NextResponse, type NextRequest } from "next/server";

/**
 * Opens this computer's server to the static site (Firebase Hosting) through a tunnel, and only to
 * whoever holds the token `npm run remote` prints. Without SPARKFLOW_TOKEN (plain `npm run dev`)
 * nothing changes. Requests that come straight from this machine never need the token.
 */
const TOKEN = process.env.SPARKFLOW_TOKEN;
const ORIGINS = (process.env.SPARKFLOW_ORIGINS ?? "https://sparkflow-ai.web.app,https://sparkflow-ai.firebaseapp.com,http://localhost:3000,http://localhost:3001")
  .split(",")
  .map((o) => o.trim());
const COOKIE = "sparkflow_token";

function cors(req: NextRequest, res: NextResponse) {
  const origin = req.headers.get("origin");
  if (origin && ORIGINS.includes(origin)) {
    res.headers.set("access-control-allow-origin", origin);
    res.headers.set("access-control-allow-methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
    res.headers.set("access-control-allow-headers", "content-type,x-sparkflow-token");
    res.headers.set("access-control-max-age", "600");
    // Chrome's Private/Local Network Access: the hosted site may call this computer's localhost.
    res.headers.set("access-control-allow-private-network", "true");
    res.headers.append("vary", "origin");
  }
  return res;
}

/**
 * Straight from this machine: localhost host, and no Cloudflare header (the tunnel adds
 * cf-connecting-ip to everything it forwards; x-forwarded-for can't tell, Next sets it itself).
 */
function local(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) && !req.headers.has("cf-connecting-ip");
}

export function proxy(req: NextRequest) {
  if (req.method === "OPTIONS") return cors(req, new NextResponse(null, { status: 204 }));
  if (!TOKEN || local(req)) return cors(req, NextResponse.next());

  const query = req.nextUrl.searchParams.get("token");
  const given = req.headers.get("x-sparkflow-token") ?? query ?? req.cookies.get(COOKIE)?.value;
  if (given !== TOKEN) return cors(req, NextResponse.json({ error: "Sparkflow: missing or wrong token" }, { status: 401 }));

  // A page opened from the static site with ?token=: keep it in a cookie for the IDE's own requests
  // (event stream, screenshots), and drop it from the address bar.
  if (query && req.method === "GET" && !req.nextUrl.pathname.startsWith("/api/")) {
    const clean = req.nextUrl.clone();
    clean.searchParams.delete("token");
    const res = NextResponse.redirect(clean);
    res.cookies.set(COOKIE, TOKEN, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    return res;
  }
  return cors(req, NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
