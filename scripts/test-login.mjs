import assert from 'node:assert/strict';
const origin = process.env.LUMA_TEST_ORIGIN || 'http://localhost:5173';
const landing = await fetch(origin + '/');
assert.equal(landing.status, 200);
assert.match(await landing.text(), /Parlez\. Créez\./);
const anonymous = await fetch(origin + '/connexion?returnTo=%2Fcommunities');
assert.equal(anonymous.status, 200);
assert.match(await anonymous.text(), /signin-with-chatgpt\?return_to=%2Fcommunities/);
for (const target of ['https://evil.example', '//evil.example', '/signin-with-chatgpt', '/connexion']) {
  const response = await fetch(origin + '/connexion?returnTo=' + encodeURIComponent(target), { headers: { Cookie: '__sites_local_auth=1' } });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Continuer vers Luma/);
  assert.match(html, /class="login-primary" href="\/fil"/);
}
console.log('Login: public landing, anonymous entry, active session and safe return destinations passed.');
