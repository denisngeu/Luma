import {getDatabase} from "@/lib/runtime";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export const SESSION_COOKIE = "luma_session";
const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";



export function nativeAuthEnabled() {
  return true;
}

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  if (nativeAuthEnabled()) {
    const database = getDatabase();
    const token = cookieValue(requestHeaders.get("cookie"), SESSION_COOKIE);
    if (!database || !token) return null;
    const tokenHash = await hashSessionToken(token);
    const account = await database.prepare(`
      SELECT u.id AS userId,u.name AS displayName,a.email AS email
      FROM auth_sessions s
      JOIN users u ON u.id=s.user
      JOIN auth_accounts a ON a.user=u.id
      WHERE s.token_hash=? AND s.expires>? AND u.closed=0
    `).bind(tokenHash, Date.now()).first<{userId:string;displayName:string;email:string}>();
    return account ? { ...account, fullName: account.displayName } : null;
  }

  const userId = requestHeaders.get(USER_ID_HEADER);
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!userId || !email) return null;
  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName = encodedFullName && requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
    ? safeDecodeURIComponent(encodedFullName)
    : null;
  return { userId, displayName: fullName ?? email, email, fullName };
}

export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  if (nativeAuthEnabled()) return `/connexion?returnTo=${encodeURIComponent(safeReturnTo)}`;
  return `/signin-with-chatgpt?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  if (nativeAuthEnabled()) return `/api/auth/logout?returnTo=${encodeURIComponent(safeReturnTo)}`;
  return `/signout-with-chatgpt?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/fil";
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local" || isReservedAuthPath(url.pathname)) return "/fil";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/fil";
  }
}

export function cookieValue(cookieHeader: string | null, name: string) {
  for (const part of (cookieHeader || "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

export async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return hex(new Uint8Array(digest));
}

function isReservedAuthPath(pathname: string): boolean {
  return ["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback", "/connexion"].includes(pathname);
}

function safeDecodeURIComponent(value: string): string | null {
  try { return decodeURIComponent(value); } catch { return null; }
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
