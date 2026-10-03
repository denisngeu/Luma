import { Pool } from 'pg';

async function seed() {
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/luma';
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('[Seed] Seeding Denis and Stitch conversations...');

    // 1. Create or get Denis
    const denisId = 'usr_denis_stitch';
    await pool.query(
      `INSERT INTO users (id, name, role, closed, suspended) VALUES ('${denisId}', 'Denis', 'admin', 0, 0) ON CONFLICT (id) DO UPDATE SET name = 'Denis'`
    );
    await pool.query(
      `INSERT INTO auth_accounts ("user", email, password_salt, password_hash, created) VALUES ('${denisId}', 'denis@luma.local', 'salt', 'hash', ${Date.now()}) ON CONFLICT ("user") DO NOTHING`
    );

    // 2. Create other contacts
    const contacts = [
      { id: 'usr_frete', name: 'Frete', email: 'frete@luma.local' },
      { id: 'usr_christ', name: 'Christ Ndong', email: 'christ@luma.local' },
      { id: 'usr_lina', name: 'Lina', email: 'lina@luma.local' },
      { id: 'usr_eric', name: 'Eric', email: 'eric@luma.local' },
      { id: 'usr_yo', name: 'yo', email: 'yo@luma.local' },
    ];

    for (const c of contacts) {
      await pool.query(
        `INSERT INTO users (id, name, role, closed, suspended) VALUES ('${c.id}', '${c.name}', 'user', 0, 0) ON CONFLICT (id) DO UPDATE SET name = '${c.name}'`
      );
    }

    // 3. Create Chats
    // Chat 1: Frete
    const chatFreteId = 'chat_stitch_frete';
    await pool.query(
      `INSERT INTO chats (id, name, kind, owner, invite, created) VALUES ('${chatFreteId}', 'Frete', 'direct', '${denisId}', 'inv_frete', ${Date.now() - 3600000}) ON CONFLICT (id) DO NOTHING`
    );
    await pool.query(`INSERT INTO members (chat, "user") VALUES ('${chatFreteId}', '${denisId}') ON CONFLICT DO NOTHING`);
    await pool.query(`INSERT INTO members (chat, "user") VALUES ('${chatFreteId}', 'usr_frete') ON CONFLICT DO NOTHING`);

    // Messages for Frete
    await pool.query(
      `INSERT INTO messages (id, chat, author, body, created, scheduled) VALUES ('msg_frete_1', '${chatFreteId}', 'usr_frete', 'Salut', ${Date.now() - 120000}, 0) ON CONFLICT (id) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO messages (id, chat, author, body, created, scheduled) VALUES ('msg_frete_2', '${chatFreteId}', 'usr_frete', 'Cv', ${Date.now() - 110000}, 0) ON CONFLICT (id) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO messages (id, chat, author, body, created, scheduled) VALUES ('msg_frete_3', '${chatFreteId}', '${denisId}', '669e6bcb-aecc-4298-b04b-a7e9af872a55', ${Date.now() - 30000}, 0) ON CONFLICT (id) DO NOTHING`
    );

    // Chat 2: Christ Ndong
    const chatChristId = 'chat_stitch_christ';
    await pool.query(
      `INSERT INTO chats (id, name, kind, owner, invite, created) VALUES ('${chatChristId}', 'Christ Ndong', 'direct', '${denisId}', 'inv_christ', ${Date.now() - 7200000}) ON CONFLICT (id) DO NOTHING`
    );
    await pool.query(`INSERT INTO members (chat, "user") VALUES ('${chatChristId}', '${denisId}') ON CONFLICT DO NOTHING`);
    await pool.query(`INSERT INTO members (chat, "user") VALUES ('${chatChristId}', 'usr_christ') ON CONFLICT DO NOTHING`);
    await pool.query(
      `INSERT INTO messages (id, chat, author, body, created, scheduled) VALUES ('msg_christ_1', '${chatChristId}', 'usr_christ', 'NON, rendez-vous à la séance demain matin', ${Date.now() - 600000}, 0) ON CONFLICT (id) DO NOTHING`
    );

    // Chat 3: Salon Audio & Veille
    const chatAudioId = 'chat_stitch_audio';
    await pool.query(
      `INSERT INTO chats (id, name, kind, owner, invite, created) VALUES ('${chatAudioId}', 'Salon Audio & Veille', 'group', '${denisId}', 'inv_audio', ${Date.now() - 86400000}) ON CONFLICT (id) DO NOTHING`
    );
    await pool.query(`INSERT INTO members (chat, "user") VALUES ('${chatAudioId}', '${denisId}') ON CONFLICT DO NOTHING`);
    await pool.query(`INSERT INTO members (chat, "user") VALUES ('${chatAudioId}', 'usr_lina') ON CONFLICT DO NOTHING`);
    await pool.query(
      `INSERT INTO messages (id, chat, author, body, created, scheduled) VALUES ('msg_audio_1', '${chatAudioId}', 'usr_lina', 'Lina: Écoutez la maquette v2', ${Date.now() - 3600000}, 0) ON CONFLICT (id) DO NOTHING`
    );

    // Chat 4: Eric
    const chatEricId = 'chat_stitch_eric';
    await pool.query(
      `INSERT INTO chats (id, name, kind, owner, invite, created) VALUES ('${chatEricId}', 'Eric', 'direct', '${denisId}', 'inv_eric', ${Date.now() - 172800000}) ON CONFLICT (id) DO NOTHING`
    );
    await pool.query(`INSERT INTO members (chat, "user") VALUES ('${chatEricId}', '${denisId}') ON CONFLICT DO NOTHING`);
    await pool.query(`INSERT INTO members (chat, "user") VALUES ('${chatEricId}', 'usr_eric') ON CONFLICT DO NOTHING`);

    // Chat 5: yo
    const chatYoId = 'chat_stitch_yo';
    await pool.query(
      `INSERT INTO chats (id, name, kind, owner, invite, created) VALUES ('${chatYoId}', 'yo', 'direct', '${denisId}', 'inv_yo', ${Date.now() - 259200000}) ON CONFLICT (id) DO NOTHING`
    );
    await pool.query(`INSERT INTO members (chat, "user") VALUES ('${chatYoId}', '${denisId}') ON CONFLICT DO NOTHING`);
    await pool.query(`INSERT INTO members (chat, "user") VALUES ('${chatYoId}', 'usr_yo') ON CONFLICT DO NOTHING`);

    console.log('[Seed] Seeding completed successfully!');
  } finally {
    await pool.end();
  }
}

seed().catch(err => {
  console.error('[Seed Error]:', err);
  process.exit(1);
});
