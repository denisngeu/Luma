import {getDatabase} from "@/lib/runtime";
import {
  SESSION_COOKIE,
  hashSessionToken,
  nativeAuthEnabled,
  safeRelativeReturnPath,
} from "@/app/chatgpt-auth";
import { sameRequestOrigin } from "@/lib/request-origin";


const SESSION_DURATION = 60 * 60 * 24 * 30;
class RequestError extends Error { constructor(message: string, public status = 400) { super(message); } }

export async function POST(request: Request) {
  if (!nativeAuthEnabled()) return Response.json({ error: "Connexion native indisponible." }, { status: 404 });
  try {
    sameOrigin(request);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return problem("Format invalide.", 415);
    const source = await request.text();
    if (source.length > 4096) return problem("Requête trop volumineuse.", 413);
    const body = JSON.parse(source) as Record<string, unknown>;
    const action = body.action;
    const email = normalizeEmail(body.email);
    const password = validatePassword(body.password);
    const returnTo = safeRelativeReturnPath(typeof body.returnTo === "string" ? body.returnTo : "/fil");
    const database = getDatabase();
    const limiterKey = await hashSessionToken(`auth:${clientAddress(request)}:${email}`);
    if (!await allowAttempt(database, limiterKey)) return problem("Trop de tentatives. Réessayez dans quelques minutes.", 429);

    let userId: string;
    let displayName: string;
    if (action === "register") {
      const settings=await database.prepare('SELECT registrations_open FROM service_settings WHERE id=1').first<{registrations_open:number}>();
      if(!settings?.registrations_open)return problem('Les inscriptions sont temporairement fermées.',403);
      displayName = validateName(body.name);
      const existing = await database.prepare("SELECT user FROM auth_accounts WHERE email=?").bind(email).first();
      if (existing) return problem("Un compte utilise déjà cette adresse.", 409);
      userId = `usr_${crypto.randomUUID()}`;
      const salt = randomToken(18);
      const passwordHash = await passwordDigest(password, salt);
      const now = Date.now();
      try {
        await database.batch([
          database.prepare("INSERT INTO users (id,name) VALUES (?,?)").bind(userId, displayName),
          database.prepare("INSERT INTO auth_accounts (user,email,password_salt,password_hash,created) VALUES (?,?,?,?,?)").bind(userId, email, salt, passwordHash, now),
        ]);
      } catch {
        return problem("Impossible de créer ce compte. Vérifiez l’adresse saisie.", 409);
      }
    } else if (action === "login") {
      const account = await database.prepare(`
        SELECT a.user,a.password_salt AS salt,a.password_hash AS passwordHash,u.name,u.closed,u.suspended
        FROM auth_accounts a JOIN users u ON u.id=a.user WHERE a.email=?
      `).bind(email).first<{user:string;salt:string;passwordHash:string;name:string;closed:number;suspended:number}>();
      const candidate = await passwordDigest(password, account?.salt || "AAAAAAAAAAAAAAAAAAAAAAAA");
      if (!account || !constantTimeEqual(candidate, account.passwordHash) || account.closed || account.suspended) {
        return problem("Adresse ou mot de passe incorrect.", 401);
      }
      userId = account.user;
      displayName = account.name;
    } else {
      return problem("Action inconnue.", 400);
    }

    const token = randomToken(32);
    const tokenHash = await hashSessionToken(token);
    const now = Date.now();
    await database.prepare("DELETE FROM auth_sessions WHERE expires<=?").bind(now).run();
    await database.prepare("INSERT INTO auth_sessions (token_hash,user,created,expires) VALUES (?,?,?,?)")
      .bind(tokenHash, userId, now, now + SESSION_DURATION * 1000).run();
    await database.prepare("DELETE FROM auth_rate_limits WHERE key=?").bind(limiterKey).run();

    return Response.json(
      { ok: true, user: { displayName, email }, returnTo },
      { headers: { "Set-Cookie": sessionCookie(request, token, SESSION_DURATION) } },
    );
  } catch (error) {
    if (error instanceof RequestError) return problem(error.message, error.status);
    console.error("Luma authentication failure", error);
    return problem("La connexion est momentanément indisponible.", 503);
  }
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") throw new RequestError("Saisissez une adresse e-mail valide.");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RequestError("Saisissez une adresse e-mail valide.");
  return email;
}

function validatePassword(value: unknown) {
  if (typeof value !== "string" || value.length < 10 || value.length > 128) throw new RequestError("Le mot de passe doit contenir entre 10 et 128 caractères.");
  return value;
}

function validateName(value: unknown) {
  if (typeof value !== "string") throw new RequestError("Saisissez votre nom.");
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) throw new RequestError("Le nom doit contenir entre 2 et 60 caractères.");
  return name;
}

async function passwordDigest(password: string, salt: string) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64Url(salt), iterations: 310_000 },
    material,
    256,
  );
  return toBase64Url(new Uint8Array(bits));
}

async function allowAttempt(database: ReturnType<typeof getDatabase>, key: string) {
  const now = Date.now();
  const current = await database.prepare("SELECT attempts,reset FROM auth_rate_limits WHERE key=?").bind(key).first<{attempts:number;reset:number}>();
  if (current && current.reset > now && current.attempts >= 15) return false;
  const attempts = current && current.reset > now ? current.attempts + 1 : 1;
  const reset = current && current.reset > now ? current.reset : now + 15 * 60 * 1000;
  await database.prepare("INSERT INTO auth_rate_limits (key,attempts,reset) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET attempts=excluded.attempts,reset=excluded.reset").bind(key, attempts, reset).run();
  return true;
}

function sessionCookie(request: Request, token: string, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

function sameOrigin(request: Request) {
  if (!sameRequestOrigin(request)) throw new RequestError("Origine refusée.", 403);
}

function clientAddress(request: Request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "unknown";
}

function randomToken(size: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return toBase64Url(bytes);
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: string, right: string) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return difference === 0;
}

function problem(error: string, status: number) {
  return Response.json({ error }, { status });
}
