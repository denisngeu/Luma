import { env } from "cloudflare:workers";
import { SESSION_COOKIE, cookieValue, hashSessionToken, nativeAuthEnabled, safeRelativeReturnPath } from "@/app/chatgpt-auth";

export async function POST(request: Request) {
  if (!nativeAuthEnabled()) return new Response(null, { status: 404 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const token = cookieValue(request.headers.get("cookie"), SESSION_COOKIE);
  if (token) {
    const database = (env as unknown as { DB: D1Database }).DB;
    await database.prepare("DELETE FROM auth_sessions WHERE token_hash=?").bind(await hashSessionToken(token)).run();
  }
  const url = new URL(request.url);
  const returnTo = safeRelativeReturnPath(url.searchParams.get("returnTo") || "/");
  const secure = url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  return new Response(null, {
    status: 303,
    headers: {
      Location: returnTo,
      "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`,
    },
  });
}
