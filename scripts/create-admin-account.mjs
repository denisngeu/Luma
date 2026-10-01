import { Pool } from 'pg';

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function randomToken(size) {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return toBase64Url(bytes);
}

async function passwordDigest(password, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64Url(salt), iterations: 310_000 },
    material,
    256,
  );
  return toBase64Url(new Uint8Array(bits));
}

export async function createOrUpdateAdmin(email, password, displayName = 'Administrateur') {
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/luma';
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    const cleanEmail = email.trim().toLowerCase();
    const existing = await pool.query('SELECT "user" FROM auth_accounts WHERE email = $1', [cleanEmail]);

    const salt = randomToken(18);
    const hash = await passwordDigest(password, salt);
    const now = Date.now();

    if (existing.rows.length > 0) {
      const userId = existing.rows[0].user;
      await pool.query('UPDATE users SET role = $1, closed = 0, suspended = 0, name = $2 WHERE id = $3', ['admin', displayName, userId]);
      await pool.query('UPDATE auth_accounts SET password_salt = $1, password_hash = $2 WHERE "user" = $3', [salt, hash, userId]);
      console.log(`Compte administrateur mis à jour pour ${cleanEmail} (ID: ${userId})`);
      return { userId, email: cleanEmail };
    } else {
      const userId = `usr_${crypto.randomUUID()}`;
      await pool.query('INSERT INTO users (id, name, role, closed, suspended) VALUES ($1, $2, $3, 0, 0)', [userId, displayName, 'admin']);
      await pool.query('INSERT INTO auth_accounts ("user", email, password_salt, password_hash, created) VALUES ($1, $2, $3, $4, $5)', [userId, cleanEmail, salt, hash, now]);
      console.log(`Compte administrateur créé avec succès pour ${cleanEmail} (ID: ${userId})`);
      return { userId, email: cleanEmail };
    }
  } finally {
    await pool.end();
  }
}

const email = process.argv[2] || 'admin@luma.local';
const password = process.argv[3] || 'Admin123456!';
const name = process.argv[4] || 'Administrateur';

await createOrUpdateAdmin(email, password, name);
