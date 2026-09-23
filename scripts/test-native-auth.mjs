import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = process.env.LUMA_TEST_URL || "http://127.0.0.1:8790";
const email = `auth-${randomUUID()}@example.test`;
const password = "Luma-test-2026!";
const publicOrigin = "https://luma.example";

const landing = await fetch(base + "/");
assert.equal(landing.status, 200);
assert.match(await landing.text(), /Parlez\. Créez\./);

const connection = await fetch(base + "/connexion");
assert.equal(connection.status, 200);
assert.match(await connection.text(), /Créer un compte/);

const register = await auth({ action: "register", name: "Compte test", email, password, returnTo: "/fil" });
assert.equal(register.status, 200, await register.text());
const cookie = sessionCookie(register);
assert.match(cookie, /^luma_session=/);

const feed = await fetch(base + "/fil", { headers: { Cookie: cookie } });
assert.equal(feed.status, 200);

const logout = await fetch(base + "/api/auth/logout?returnTo=%2F", {
  method: "POST",
  redirect: "manual",
  headers: { Origin: publicOrigin, "X-Forwarded-Host": "luma.example", "X-Forwarded-Proto": "https", Cookie: cookie },
});
assert.equal(logout.status, 303);
assert.match(logout.headers.get("set-cookie") || "", /Max-Age=0/);

const rejected = await auth({ action: "login", email, password: "incorrect-password", returnTo: "/fil" });
assert.equal(rejected.status, 401);

const login = await auth({ action: "login", email, password, returnTo: "/fil" });
assert.equal(login.status, 200, await login.text());
assert.match(sessionCookie(login), /^luma_session=/);

console.log("Native authentication and public landing page verified.");

function auth(body) {
  return fetch(base + "/api/auth", {
    method: "POST",
    headers: { Origin: publicOrigin, "X-Forwarded-Host": "luma.example", "X-Forwarded-Proto": "https", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function sessionCookie(response) {
  return (response.headers.get("set-cookie") || "").split(";")[0];
}
