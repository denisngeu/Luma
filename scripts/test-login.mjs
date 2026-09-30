import assert from 'node:assert/strict';
const origin = process.env.LUMA_TEST_ORIGIN || 'http://localhost:5173';
const landing = await fetch(origin + '/');
assert.equal(landing.status, 200);
assert.match(await landing.text(), /Parlez\. Créez\./);
const anonymous = await fetch(origin + '/connexion?returnTo=%2Fcommunities');
assert.equal(anonymous.status, 200);
const anonymousHtml = await anonymous.text();
assert.match(anonymousHtml, /Créer un compte/);
assert.match(anonymousHtml, /Connexion sécurisée par Luma/);
for (const target of ['https://evil.example', '//evil.example', '/signin-with-chatgpt', '/connexion']) {
  const response = await fetch(origin + '/connexion?returnTo=' + encodeURIComponent(target));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Créer un compte/);
  assert.doesNotMatch(html, /href="https:\/\/evil\.example|href="\/\/evil\.example/);
}
console.log('Login: public landing, native authentication and safe return destinations passed.');
