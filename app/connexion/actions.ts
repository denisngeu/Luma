"use server";

import { getDatabase } from "@/lib/runtime";
import { SESSION_COOKIE, hashSessionToken, safeRelativeReturnPath } from "@/app/chatgpt-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_DURATION = 60 * 60 * 24 * 30;

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function randomToken(size: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return toBase64Url(bytes);
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

function constantTimeEqual(left: string, right: string) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return difference === 0;
}

export type AuthActionResult = {
  error?: string;
  success?: boolean;
};

export async function loginOrRegisterAction(prevState: AuthActionResult | undefined, formData: FormData): Promise<AuthActionResult> {
  const action = (formData.get("action") as string) || "login";
  const rawEmail = (formData.get("email") as string) || "";
  const rawPassword = (formData.get("password") as string) || "";
  const rawName = (formData.get("name") as string) || "";
  const returnTo = safeRelativeReturnPath((formData.get("returnTo") as string) || "/fil");

  const email = rawEmail.trim().toLowerCase();
  const password = rawPassword;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Saisissez une adresse e-mail valide." };
  }
  if (!password || password.length < 10) {
    return { error: "Le mot de passe doit contenir au moins 10 caractères." };
  }

  const database = getDatabase();
  let userId: string;

  if (action === "register") {
    const settings = await database.prepare("SELECT registrations_open FROM service_settings WHERE id=1").first<{ registrations_open: number }>();
    if (!settings?.registrations_open) {
      return { error: "Les inscriptions sont temporairement fermées." };
    }
    const name = rawName.trim().replace(/\s+/g, " ");
    if (name.length < 2) {
      return { error: "Le nom doit contenir au moins 2 caractères." };
    }
    const existing = await database.prepare("SELECT user FROM auth_accounts WHERE email=?").bind(email).first();
    if (existing) {
      return { error: "Un compte utilise déjà cette adresse." };
    }
    userId = `usr_${crypto.randomUUID()}`;
    const salt = randomToken(18);
    const passwordHash = await passwordDigest(password, salt);
    const now = Date.now();
    try {
      await database.batch([
        database.prepare("INSERT INTO users (id,name) VALUES (?,?)").bind(userId, name),
        database.prepare("INSERT INTO auth_accounts (user,email,password_salt,password_hash,created) VALUES (?,?,?,?,?)").bind(userId, email, salt, passwordHash, now),
      ]);
    } catch {
      return { error: "Impossible de créer ce compte. Vérifiez l’adresse saisie." };
    }
  } else {
    const account = await database.prepare(`
      SELECT a.user,a.password_salt AS salt,a.password_hash AS "passwordHash",u.name,u.closed,u.suspended
      FROM auth_accounts a JOIN users u ON u.id=a.user WHERE a.email=?
    `).bind(email).first<{ user: string; salt: string; passwordHash: string; name: string; closed: number | string; suspended: number | string }>();

    const candidate = await passwordDigest(password, account?.salt || "AAAAAAAAAAAAAAAAAAAAAAAA");
    if (!account || !constantTimeEqual(candidate, account.passwordHash) || Number(account.closed) !== 0 || Number(account.suspended) !== 0) {
      return { error: "Adresse ou mot de passe incorrect." };
    }
    userId = account.user;
  }

  const token = randomToken(32);
  const tokenHash = await hashSessionToken(token);
  const now = Date.now();
  await database.prepare("DELETE FROM auth_sessions WHERE expires<=?").bind(now).run();
  await database.prepare("INSERT INTO auth_sessions (token_hash,user,created,expires) VALUES (?,?,?,?)")
    .bind(tokenHash, userId, now, now + SESSION_DURATION * 1000).run();

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    secure: false,
  });

  const dest = action === "register" ? `/bienvenue?returnTo=${encodeURIComponent(returnTo)}` : returnTo;
  redirect(dest);
}
