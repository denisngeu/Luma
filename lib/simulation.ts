import { getDatabase } from './runtime';

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function randomToken(size: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return toBase64Url(bytes);
}

async function passwordDigest(password: string, salt: string) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64Url(salt), iterations: 310_000 },
    material,
    256,
  );
  return toBase64Url(new Uint8Array(bits));
}

async function sha256Hex(s: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

export const SIMULATION_PASSWORD = 'LumaTest2026!';

export const SIMULATION_USERS = [
  {
    id: 'sim_usr_clara',
    email: 'clara@luma.local',
    name: 'Clara Vaneau',
    role: 'user',
    bio: '🎨 Designer UI/UX & photographe nomade. Amoureuse des belles typographies et des interfaces épurées.',
  },
  {
    id: 'sim_usr_alex',
    email: 'alex@luma.local',
    name: 'Alexandre Morel',
    role: 'user',
    bio: '💻 Développeur Fullstack, passionné de WebRTC, d’open source et de jeux vidéo indépendants.',
  },
  {
    id: 'sim_usr_sophie',
    email: 'sophie@luma.local',
    name: 'Sophie Martin',
    role: 'user',
    bio: '📚 Éditrice et passionnée de lecture. J’organise les clubs de lecture sur Luma !',
  },
  {
    id: 'sim_usr_lucas',
    email: 'lucas@luma.local',
    name: 'Lucas Petit',
    role: 'user',
    bio: '🎧 Sound designer et compositeur. Toujours prêt pour une session vocale ou un soundboard test.',
  },
  {
    id: 'sim_usr_eleonore',
    email: 'eleonore@luma.local',
    name: 'Éléonore Renard',
    role: 'user',
    bio: '🌿 Architecte d’intérieur & exploratrice urbaine. Partage mes carnets de route sur le fil.',
  },
];

export async function getSimulationStatus() {
  const c = await getDatabase().driver.connect();
  try {
    const simUsers = (await c.query("SELECT count(*) as count FROM users WHERE id LIKE 'sim_usr_%'")).rows[0]?.count || 0;
    const simSpaces = (await c.query("SELECT count(*) as count FROM spaces WHERE id LIKE 'sim_space_%'")).rows[0]?.count || 0;
    const simPosts = (await c.query("SELECT count(*) as count FROM posts WHERE id LIKE 'sim_post_%'")).rows[0]?.count || 0;
    const simReports = (await c.query("SELECT count(*) as count FROM reports WHERE id LIKE 'sim_rep_%'")).rows[0]?.count || 0;
    const totalUsers = (await c.query('SELECT count(*) as count FROM users WHERE closed = 0')).rows[0]?.count || 0;
    const totalMessages = (await c.query('SELECT count(*) as count FROM messages')).rows[0]?.count || 0;

    return {
      active: Number(simUsers) > 0,
      simulatedUsers: Number(simUsers),
      simulatedSpaces: Number(simSpaces),
      simulatedPosts: Number(simPosts),
      simulatedReports: Number(simReports),
      totalUsers: Number(totalUsers),
      totalMessages: Number(totalMessages),
      accounts: SIMULATION_USERS.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        password: SIMULATION_PASSWORD,
        bio: u.bio,
      })),
    };
  } finally {
    c.release?.();
  }
}

async function runCleanup(c: any) {
  // 1. Reports
  await c.query("DELETE FROM reports WHERE id LIKE 'sim_%' OR reporter LIKE 'sim_usr_%'");

  // 2. Media signals, participants, rooms
  await c.query("DELETE FROM media_signals WHERE id LIKE 'sim_%' OR room LIKE 'sim_%' OR sender LIKE 'sim_usr_%' OR recipient LIKE 'sim_usr_%'");
  await c.query("DELETE FROM media_participants WHERE room LIKE 'sim_%' OR \"user\" LIKE 'sim_usr_%'");
  await c.query("DELETE FROM media_rooms WHERE id LIKE 'sim_%' OR creator LIKE 'sim_usr_%'");

  // 3. Calls
  await c.query("DELETE FROM calls WHERE id LIKE 'sim_%' OR caller LIKE 'sim_usr_%' OR callee LIKE 'sim_usr_%'");

  // 4. Social post children, then posts
  await c.query("DELETE FROM post_likes WHERE post LIKE '%sim_%' OR \"user\" LIKE 'sim_usr_%'");
  await c.query("DELETE FROM post_comments WHERE id LIKE '%sim_%' OR post LIKE '%sim_%' OR author LIKE 'sim_usr_%'");
  await c.query("DELETE FROM post_media WHERE post LIKE '%sim_%'");
  await c.query("DELETE FROM posts WHERE id LIKE '%sim_%' OR author LIKE 'sim_usr_%'");

  // 5. Chat message children, then messages
  await c.query("DELETE FROM votes WHERE message LIKE 'sim_%' OR \"user\" LIKE 'sim_usr_%'");
  await c.query("DELETE FROM polls WHERE message LIKE 'sim_%'");
  await c.query("DELETE FROM reactions WHERE message LIKE 'sim_%' OR \"user\" LIKE 'sim_usr_%'");
  await c.query("DELETE FROM stars WHERE message LIKE 'sim_%' OR \"user\" LIKE 'sim_usr_%'");
  await c.query("DELETE FROM messages WHERE id LIKE 'sim_%' OR author LIKE 'sim_usr_%' OR chat LIKE 'sim_%' OR chat LIKE 'friend-%'");

  // 6. Members and chats
  await c.query("DELETE FROM members WHERE \"user\" LIKE 'sim_usr_%' OR chat LIKE 'sim_%' OR chat LIKE 'friend-%'");
  await c.query("DELETE FROM chats WHERE id LIKE 'sim_%' OR id LIKE 'friend-%' OR owner LIKE 'sim_usr_%' OR space LIKE 'sim_space_%'");

  // 7. Space members and spaces
  await c.query("DELETE FROM space_members WHERE space LIKE 'sim_space_%' OR \"user\" LIKE 'sim_usr_%'");
  await c.query("DELETE FROM spaces WHERE id LIKE 'sim_space_%' OR owner LIKE 'sim_usr_%'");

  // 8. Friendships and contacts
  await c.query("DELETE FROM friendships WHERE sender LIKE 'sim_usr_%' OR recipient LIKE 'sim_usr_%'");
  await c.query("DELETE FROM contacts WHERE \"user\" LIKE 'sim_usr_%'");

  // 9. Social profiles
  await c.query("DELETE FROM social_profiles WHERE \"user\" LIKE 'sim_usr_%'");

  // 10. Auth accounts and sessions
  await c.query("DELETE FROM auth_sessions WHERE \"user\" LIKE 'sim_usr_%'");
  await c.query("DELETE FROM auth_accounts WHERE \"user\" LIKE 'sim_usr_%'");

  // 11. Users
  await c.query("DELETE FROM users WHERE id LIKE 'sim_usr_%'");
}

export async function clearSimulationData(actorId?: string) {
  const c = await getDatabase().driver.connect();
  try {
    await c.query('BEGIN');
    await runCleanup(c);

    // Add audit log
    if (actorId) {
      await c.query(
        'INSERT INTO admin_audit(id, actor, action, target, reason, before_state, after_state, created) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          crypto.randomUUID(),
          actorId,
          'simulation_reset',
          'service',
          'Réinitialisation et nettoyage complet des données de simulation',
          JSON.stringify({ status: 'active' }),
          JSON.stringify({ status: 'cleared' }),
          Date.now(),
        ],
      );
    }

    await c.query('COMMIT');
    return { ok: true, cleared: true };
  } catch (error) {
    await c.query('ROLLBACK');
    throw error;
  } finally {
    c.release?.();
  }
}

export async function generateSimulationData(adminUserId: string) {
  const c = await getDatabase().driver.connect();
  const now = Date.now();

  try {
    await c.query('BEGIN');
    await runCleanup(c);

    // 2. Insert Simulated Users
    for (let i = 0; i < SIMULATION_USERS.length; i++) {
      const u = SIMULATION_USERS[i];
      const salt = randomToken(18);
      const hash = await passwordDigest(SIMULATION_PASSWORD, salt);
      const userCreated = now - (10 - i) * 86400000;

      await c.query('INSERT INTO users (id, name, role, closed, suspended) VALUES ($1, $2, $3, 0, 0)', [u.id, u.name, u.role]);
      await c.query('INSERT INTO auth_accounts ("user", email, password_salt, password_hash, created) VALUES ($1, $2, $3, $4, $5)', [
        u.id,
        u.email,
        salt,
        hash,
        userCreated,
      ]);
      await c.query('INSERT INTO social_profiles ("user", bio) VALUES ($1, $2)', [u.id, u.bio]);
      const emailHash = await sha256Hex(u.email.toLowerCase());
      await c.query('INSERT INTO contacts ("user", email_hash, code, discoverable) VALUES ($1, $2, $3, 1)', [
        u.id,
        emailHash,
        `code_${u.id}`,
      ]);
    }

    // 3. Friendships with Admin and Between Simulated Users
    const friendshipsToCreate = [
      { sender: SIMULATION_USERS[0].id, recipient: adminUserId, state: 'accepted', time: now - 3 * 86400000 },
      { sender: adminUserId, recipient: SIMULATION_USERS[1].id, state: 'accepted', time: now - 2 * 86400000 },
      { sender: SIMULATION_USERS[2].id, recipient: adminUserId, state: 'pending', time: now - 3600000 },
      { sender: adminUserId, recipient: SIMULATION_USERS[3].id, state: 'pending', time: now - 7200000 },
      { sender: SIMULATION_USERS[0].id, recipient: SIMULATION_USERS[1].id, state: 'accepted', time: now - 5 * 86400000 },
      { sender: SIMULATION_USERS[1].id, recipient: SIMULATION_USERS[2].id, state: 'accepted', time: now - 4 * 86400000 },
    ];

    for (const f of friendshipsToCreate) {
      const sortedPair = [f.sender, f.recipient].sort();
      const friendshipId = await sha256Hex(JSON.stringify(sortedPair));
      await c.query(
        'INSERT INTO friendships (id, sender, recipient, state, created) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(id) DO UPDATE SET state=excluded.state',
        [friendshipId, f.sender, f.recipient, f.state, f.time],
      );

      // If accepted, create the direct conversation
      if (f.state === 'accepted') {
        const chatId = 'friend-' + friendshipId;
        await c.query(
          "INSERT INTO chats (id, name, kind, mode, topic, owner, invite, created, locked) VALUES ($1, $2, 'direct', 'text', '', $3, $4, $5, 0) ON CONFLICT(id) DO NOTHING",
          [chatId, 'Discussion privée', f.sender, crypto.randomUUID(), f.time],
        );
        await c.query('INSERT INTO members (chat, "user") VALUES ($1, $2) ON CONFLICT DO NOTHING', [chatId, f.sender]);
        await c.query('INSERT INTO members (chat, "user") VALUES ($1, $2) ON CONFLICT DO NOTHING', [chatId, f.recipient]);

        // Add rich messages for Clara & Admin conversation
        if (sortedPair.includes(SIMULATION_USERS[0].id) && sortedPair.includes(adminUserId)) {
          const msg1Id = 'sim_msg_clara_1';
          const msg2Id = 'sim_msg_clara_2';
          const msg3Id = 'sim_msg_clara_3';
          const msg4Id = 'sim_msg_clara_4';

          await c.query(
            'INSERT INTO messages (id, chat, author, body, created, reply, pinned, edited, hidden) VALUES ($1, $2, $3, $4, $5, NULL, 0, 0, 0)',
            [msg1Id, chatId, SIMULATION_USERS[0].id, 'Bonjour ! Bienvenue sur ton serveur Luma fraîchement déployé 🎉', f.time + 1000],
          );
          await c.query(
            'INSERT INTO messages (id, chat, author, body, created, reply, pinned, edited, hidden) VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 0)',
            [msg2Id, chatId, adminUserId, 'Merci Clara ! Le serveur tourne super bien en local avec PostgreSQL.', f.time + 60000, msg1Id],
          );
          await c.query(
            'INSERT INTO messages (id, chat, author, body, created, reply, pinned, edited, hidden) VALUES ($1, $2, $3, $4, $5, NULL, 1, 0, 0)',
            [msg3Id, chatId, SIMULATION_USERS[0].id, '📌 Rappel : Tu peux tester le partage d’écran, les salons vocaux et le fil social privé !', f.time + 120000],
          );
          await c.query(
            'INSERT INTO messages (id, chat, author, body, created, reply, pinned, edited, hidden) VALUES ($1, $2, $3, $4, $5, NULL, 0, 0, 0)',
            [msg4Id, chatId, SIMULATION_USERS[0].id, 'N’hésite pas à m’appeler en vocal ou vidéo pour tester WebRTC quand tu veux ✨', f.time + 180000],
          );

          // Reactions & stars
          await c.query("INSERT INTO reactions (message, \"user\", emoji) VALUES ($1, $2, '❤️') ON CONFLICT DO NOTHING", [msg1Id, adminUserId]);
          await c.query("INSERT INTO reactions (message, \"user\", emoji) VALUES ($1, $2, '🔥') ON CONFLICT DO NOTHING", [msg2Id, SIMULATION_USERS[0].id]);
          await c.query("INSERT INTO reactions (message, \"user\", emoji) VALUES ($1, $2, '👍') ON CONFLICT DO NOTHING", [msg3Id, adminUserId]);
          await c.query('INSERT INTO stars (message, "user") VALUES ($1, $2) ON CONFLICT DO NOTHING', [msg3Id, adminUserId]);
        }

        // Add rich messages for Alex & Admin conversation
        if (sortedPair.includes(SIMULATION_USERS[1].id) && sortedPair.includes(adminUserId)) {
          const mAlex1 = 'sim_msg_alex_1';
          await c.query(
            'INSERT INTO messages (id, chat, author, body, created, reply, pinned, edited, hidden) VALUES ($1, $2, $3, $4, $5, NULL, 0, 0, 0)',
            [mAlex1, chatId, SIMULATION_USERS[1].id, 'Salut ! WebSockets et appels WebRTC configurés. Dispo si tu veux tester la liaison directe ! 🚀', f.time + 1000],
          );
          await c.query("INSERT INTO reactions (message, \"user\", emoji) VALUES ($1, $2, '🔥') ON CONFLICT DO NOTHING", [mAlex1, adminUserId]);
        }
      }
    }

    // 4. Create Communities (Spaces)
    // Space 1: Design & Créativité (Owner: Clara, Admin: adminUserId)
    const space1Id = 'sim_space_design';
    await c.query(
      'INSERT INTO spaces (id, name, description, owner, invite, created, locked) VALUES ($1, $2, $3, $4, $5, $6, 0)',
      [
        space1Id,
        'Design & Créativité',
        'Espace dédié aux maquettes, à la photographie et aux réflexions UX de Luma.',
        SIMULATION_USERS[0].id,
        'invite_design_2026',
        now - 4 * 86400000,
      ],
    );

    // Space 1 members
    await c.query("INSERT INTO space_members (space, \"user\", role) VALUES ($1, $2, 'owner')", [space1Id, SIMULATION_USERS[0].id]);
    await c.query("INSERT INTO space_members (space, \"user\", role) VALUES ($1, $2, 'admin')", [space1Id, adminUserId]);
    await c.query("INSERT INTO space_members (space, \"user\", role) VALUES ($1, $2, 'member')", [space1Id, SIMULATION_USERS[1].id]);
    await c.query("INSERT INTO space_members (space, \"user\", role) VALUES ($1, $2, 'member')", [space1Id, SIMULATION_USERS[2].id]);

    // Space 1 channels
    const chGeneral = 'sim_chat_design_general';
    const chAnnonces = 'sim_chat_design_annonces';
    const chVocal = 'sim_chat_design_vocal';

    await c.query(
      "INSERT INTO chats (id, name, kind, space, mode, topic, owner, invite, created, locked) VALUES ($1, $2, 'channel', $3, 'text', $4, $5, $6, $7, 0)",
      [chGeneral, 'général', space1Id, 'Discussions quotidiennes et entraide design', SIMULATION_USERS[0].id, crypto.randomUUID(), now - 4 * 86400000],
    );
    await c.query(
      "INSERT INTO chats (id, name, kind, space, mode, topic, owner, invite, created, locked) VALUES ($1, $2, 'channel', $3, 'announcement', $4, $5, $6, $7, 0)",
      [chAnnonces, 'annonces', space1Id, 'Mises à jour et nouveautés importantes', SIMULATION_USERS[0].id, crypto.randomUUID(), now - 4 * 86400000 + 1],
    );
    await c.query(
      "INSERT INTO chats (id, name, kind, space, mode, topic, owner, invite, created, locked) VALUES ($1, $2, 'channel', $3, 'voice', $4, $5, $6, $7, 0)",
      [chVocal, 'Salon Vocal Studio', space1Id, 'Salon vocal avec son spatial et soundboard', SIMULATION_USERS[0].id, crypto.randomUUID(), now - 4 * 86400000 + 2],
    );

    // Messages in #général
    const mGen1 = 'sim_msg_gen_1';
    const mGen2 = 'sim_msg_gen_2';
    const mPoll = 'sim_msg_poll_1';

    await c.query(
      'INSERT INTO messages (id, chat, author, body, created, reply, pinned, edited, hidden) VALUES ($1, $2, $3, $4, $5, NULL, 0, 0, 0)',
      [mGen1, chGeneral, SIMULATION_USERS[0].id, 'Bienvenue à tous dans la communauté Design & Créativité ! Partagez vos idées ici 🎨', now - 3 * 86400000],
    );
    await c.query(
      'INSERT INTO messages (id, chat, author, body, created, reply, pinned, edited, hidden) VALUES ($1, $2, $3, $4, $5, NULL, 0, 0, 0)',
      [mGen2, chGeneral, SIMULATION_USERS[1].id, 'Super espace ! J’ai hâte de partager mes prototypes d’animations CSS.', now - 2 * 86400000],
    );

    // Interactive Poll in Community
    await c.query(
      'INSERT INTO messages (id, chat, author, body, created, reply, pinned, edited, hidden) VALUES ($1, $2, $3, $4, $5, NULL, 1, 0, 0)',
      [mPoll, chGeneral, SIMULATION_USERS[0].id, '📊 Sondage : Quel thème visuel préférez-vous pour Luma ?', now - 86400000],
    );
    const pollOptions = ['Sombre Émeraude', 'Nébuleuse Violette', 'Clair Minimaliste', 'Contraste Élevé'];
    await c.query('INSERT INTO polls (message, options, closed) VALUES ($1, $2, 0)', [mPoll, JSON.stringify(pollOptions)]);
    // Votes
    await c.query('INSERT INTO votes (message, "user", choice) VALUES ($1, $2, 0)', [mPoll, SIMULATION_USERS[0].id]);
    await c.query('INSERT INTO votes (message, "user", choice) VALUES ($1, $2, 1)', [mPoll, SIMULATION_USERS[1].id]);
    await c.query('INSERT INTO votes (message, "user", choice) VALUES ($1, $2, 0)', [mPoll, SIMULATION_USERS[2].id]);
    await c.query('INSERT INTO votes (message, "user", choice) VALUES ($1, $2, 1)', [mPoll, adminUserId]);

    // Space 2: Tech & Open Source (Owner: Alex, Member: adminUserId)
    const space2Id = 'sim_space_tech';
    await c.query(
      'INSERT INTO spaces (id, name, description, owner, invite, created, locked) VALUES ($1, $2, $3, $4, $5, $6, 0)',
      [
        space2Id,
        'Tech & Open-Source',
        'Discussions autour de PostgreSQL, Next.js, Electron et les protocoles temps-réel.',
        SIMULATION_USERS[1].id,
        'invite_tech_2026',
        now - 3 * 86400000,
      ],
    );
    await c.query("INSERT INTO space_members (space, \"user\", role) VALUES ($1, $2, 'owner')", [space2Id, SIMULATION_USERS[1].id]);
    await c.query("INSERT INTO space_members (space, \"user\", role) VALUES ($1, $2, 'member')", [space2Id, adminUserId]);
    await c.query("INSERT INTO space_members (space, \"user\", role) VALUES ($1, $2, 'member')", [space2Id, SIMULATION_USERS[3].id]);
    await c.query("INSERT INTO space_members (space, \"user\", role) VALUES ($1, $2, 'member')", [space2Id, SIMULATION_USERS[4].id]);

    const chTechDev = 'sim_chat_tech_dev';
    await c.query(
      "INSERT INTO chats (id, name, kind, space, mode, topic, owner, invite, created, locked) VALUES ($1, $2, 'channel', $3, 'text', $4, $5, $6, $7, 0)",
      [chTechDev, 'développement', space2Id, 'Architecture et code de l’application', SIMULATION_USERS[1].id, crypto.randomUUID(), now - 3 * 86400000],
    );
    await c.query(
      'INSERT INTO messages (id, chat, author, body, created, reply, pinned, edited, hidden) VALUES ($1, $2, $3, $4, $5, NULL, 0, 0, 0)',
      [
        'sim_msg_tech_1',
        chTechDev,
        SIMULATION_USERS[1].id,
        'Le serveur standalone et le bundle Turbopack réduisent les temps de démarrage à moins de 800ms sur Windows.',
        now - 86400000,
      ],
    );

    // 5. Social Feed Posts (in /fil)
    const p1Id = String(now - 12000000).padStart(15, '0') + '-sim_post_1';
    const p2Id = String(now - 6000000).padStart(15, '0') + '-sim_post_2';
    const p3Id = String(now - 1000000).padStart(15, '0') + '-sim_post_3';

    await c.query(
      'INSERT INTO posts (id, author, body, created, edited, hidden) VALUES ($1, $2, $3, $4, 0, 0)',
      [
        p1Id,
        SIMULATION_USERS[0].id,
        'Je viens de finaliser la nouvelle palette de couleurs pour le thème sombre. Moins de lumière bleue, plus de douceur pour les yeux la nuit 🌙',
        now - 12000000,
      ],
    );
    await c.query('INSERT INTO post_likes (post, "user") VALUES ($1, $2)', [p1Id, adminUserId]);
    await c.query('INSERT INTO post_likes (post, "user") VALUES ($1, $2)', [p1Id, SIMULATION_USERS[1].id]);
    await c.query('INSERT INTO post_likes (post, "user") VALUES ($1, $2)', [p1Id, SIMULATION_USERS[2].id]);

    await c.query(
      'INSERT INTO post_comments (id, post, author, body, created) VALUES ($1, $2, $3, $4, $5)',
      [
        String(now - 11000000).padStart(15, '0') + '-sim_c1',
        p1Id,
        adminUserId,
        'Superbe rendu ! Le confort de lecture est nettement meilleur.',
        now - 11000000,
      ],
    );
    await c.query(
      'INSERT INTO post_comments (id, post, author, body, created) VALUES ($1, $2, $3, $4, $5)',
      [
        String(now - 10000000).padStart(15, '0') + '-sim_c2',
        p1Id,
        SIMULATION_USERS[1].id,
        'Totalement d’accord, bravo Clara !',
        now - 10000000,
      ],
    );

    await c.query(
      'INSERT INTO posts (id, author, body, created, edited, hidden) VALUES ($1, $2, $3, $4, 0, 0)',
      [
        p2Id,
        SIMULATION_USERS[1].id,
        'Serveur local configuré et opérationnel. Toutes les migrations SQL sont passées sans encombre sur notre environnement de test 🛠️',
        now - 6000000,
      ],
    );
    await c.query('INSERT INTO post_likes (post, "user") VALUES ($1, $2)', [p2Id, adminUserId]);
    await c.query('INSERT INTO post_likes (post, "user") VALUES ($1, $2)', [p2Id, SIMULATION_USERS[0].id]);

    await c.query(
      'INSERT INTO posts (id, author, body, created, edited, hidden) VALUES ($1, $2, $3, $4, 0, 0)',
      [
        p3Id,
        SIMULATION_USERS[2].id,
        'Bonjour le cercle Luma ! Première publication pour saluer la communauté. Très heureuse de rejoindre cet espace privé sans pub 🌿',
        now - 1000000,
      ],
    );
    await c.query('INSERT INTO post_likes (post, "user") VALUES ($1, $2)', [p3Id, adminUserId]);

    // 6. Calls (Ended and Active calls for monitoring in /admin)
    const call1Id = 'sim_call_1';
    const call2Id = 'sim_call_2';
    const call3Id = 'sim_call_3';

    // Active call (monitoring in /admin > Appels)
    await c.query(
      "INSERT INTO calls (id, caller, callee, mode, state, created, expires) VALUES ($1, $2, $3, 'video', 'active', $4, $5)",
      [call1Id, SIMULATION_USERS[0].id, SIMULATION_USERS[1].id, now - 300000, now + 3600000],
    );

    // Ringing call
    await c.query(
      "INSERT INTO calls (id, caller, callee, mode, state, created, expires) VALUES ($1, $2, $3, 'audio', 'ringing', $4, $5)",
      [call2Id, SIMULATION_USERS[3].id, SIMULATION_USERS[4].id, now - 60000, now + 3600000],
    );

    // Ended call
    await c.query(
      "INSERT INTO calls (id, caller, callee, mode, state, created, expires) VALUES ($1, $2, $3, 'video', 'ended', $4, $5)",
      [call3Id, SIMULATION_USERS[0].id, adminUserId, now - 86400000, now + 3600000],
    );

    // 7. Media Room (Voice room in Space)
    const roomId = 'sim_room_vocal';
    await c.query(
      "INSERT INTO media_rooms (id, chat, creator, kind, mode, state, created, expires) VALUES ($1, $2, $3, 'voice', 'audio', 'open', $4, $5)",
      [roomId, chVocal, SIMULATION_USERS[0].id, now - 600000, now + 3600000],
    );
    await c.query('INSERT INTO media_participants (room, "user", joined, last_seen) VALUES ($1, $2, $3, $4)', [
      roomId,
      SIMULATION_USERS[0].id,
      now - 600000,
      now,
    ]);
    await c.query('INSERT INTO media_participants (room, "user", joined, last_seen) VALUES ($1, $2, $3, $4)', [
      roomId,
      SIMULATION_USERS[1].id,
      now - 500000,
      now,
    ]);

    // 8. Reports (for testing moderation in /admin > Signalements)
    const rep1Id = 'sim_rep_1';
    const rep2Id = 'sim_rep_2';

    await c.query(
      "INSERT INTO reports (id, reporter, kind, target, reason, state, resolution, created) VALUES ($1, $2, 'message', $3, $4, 'open', '', $5)",
      [
        rep1Id,
        SIMULATION_USERS[2].id,
        mGen1,
        'Test de signalement modérateur : vérifier la conformité du message avec la charte de la communauté.',
        now - 7200000,
      ],
    );

    await c.query(
      "INSERT INTO reports (id, reporter, kind, target, reason, state, resolution, created) VALUES ($1, $2, 'post', $3, $4, 'open', '', $5)",
      [
        rep2Id,
        SIMULATION_USERS[1].id,
        p3Id,
        'Test de signalement sur une publication sociale : message test pour valider le traitement.',
        now - 3600000,
      ],
    );

    // 9. Audit log entry
    await c.query(
      'INSERT INTO admin_audit(id, actor, action, target, reason, before_state, after_state, created) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        crypto.randomUUID(),
        adminUserId,
        'simulation_generate',
        'service',
        'Génération complète du jeu de données de simulation (utilisateurs, amis, salons, posts, appels, signalements)',
        JSON.stringify({ status: 'empty' }),
        JSON.stringify({ users: SIMULATION_USERS.length, spaces: 2, posts: 3, calls: 3, reports: 2 }),
        now,
      ],
    );

    await c.query('COMMIT');
    return { ok: true, generated: true };
  } catch (error) {
    await c.query('ROLLBACK');
    throw error;
  } finally {
    c.release?.();
  }
}
