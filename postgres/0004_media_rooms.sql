CREATE TABLE post_media (
  post text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  key text NOT NULL UNIQUE,
  kind text NOT NULL CHECK(kind IN ('image','video')),
  mime text NOT NULL,
  filename text NOT NULL,
  size bigint NOT NULL CHECK(size>0),
  position integer NOT NULL CHECK(position>=0 AND position<4),
  PRIMARY KEY(post,position)
);
CREATE INDEX post_media_post ON post_media(post,position);

CREATE TABLE media_rooms (
  id text PRIMARY KEY,
  chat text NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  creator text NOT NULL REFERENCES users(id),
  kind text NOT NULL CHECK(kind IN ('group','voice')),
  mode text NOT NULL CHECK(mode IN ('audio','video')),
  state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','ended')),
  created bigint NOT NULL,
  expires bigint NOT NULL
);
CREATE INDEX media_rooms_chat ON media_rooms(chat,state,expires);

CREATE TABLE media_participants (
  room text NOT NULL REFERENCES media_rooms(id) ON DELETE CASCADE,
  "user" text NOT NULL REFERENCES users(id),
  joined bigint NOT NULL,
  last_seen bigint NOT NULL,
  PRIMARY KEY(room,"user")
);
CREATE INDEX media_participants_presence ON media_participants(room,last_seen);

CREATE TABLE media_signals (
  id text PRIMARY KEY,
  room text NOT NULL REFERENCES media_rooms(id) ON DELETE CASCADE,
  sender text NOT NULL REFERENCES users(id),
  recipient text NOT NULL REFERENCES users(id),
  type text NOT NULL CHECK(type IN ('offer','answer')),
  payload text NOT NULL,
  created bigint NOT NULL
);
CREATE INDEX media_signals_recipient ON media_signals(room,recipient,created);
