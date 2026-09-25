CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
CREATE TABLE "chats" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"owner" text NOT NULL,
	"invite" text NOT NULL,
	"created" bigint NOT NULL,
	FOREIGN KEY ("owner") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE "members" (
	"chat" text NOT NULL,
	"user" text NOT NULL,
	PRIMARY KEY("chat", "user"),
	FOREIGN KEY ("chat") REFERENCES "chats"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("user") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"chat" text NOT NULL,
	"author" text NOT NULL,
	"body" text NOT NULL,
	"created" bigint NOT NULL,
	"scheduled" bigint DEFAULT 0 NOT NULL,
	"reply" text,
	"file" text,
	"filename" text,
	FOREIGN KEY ("chat") REFERENCES "chats"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("author") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE "stars" (
	"message" text NOT NULL,
	"user" text NOT NULL,
	PRIMARY KEY("message", "user"),
	FOREIGN KEY ("message") REFERENCES "messages"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("user") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE "polls" (
	"message" text PRIMARY KEY NOT NULL,
	"options" text NOT NULL,
	"closed" bigint DEFAULT 0 NOT NULL,
	FOREIGN KEY ("message") REFERENCES "messages"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE "reactions" (
	"message" text NOT NULL,
	"user" text NOT NULL,
	"emoji" text NOT NULL,
	PRIMARY KEY("message", "user", "emoji"),
	FOREIGN KEY ("message") REFERENCES "messages"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("user") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE "spaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"owner" text NOT NULL,
	"invite" text NOT NULL,
	"created" bigint NOT NULL,
	FOREIGN KEY ("owner") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE "space_members" (
	"space" text NOT NULL,
	"user" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	PRIMARY KEY("space", "user"),
	FOREIGN KEY ("space") REFERENCES "spaces"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("user") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE "votes" (
	"message" text NOT NULL,
	"user" text NOT NULL,
	"choice" bigint NOT NULL,
	PRIMARY KEY("message", "user"),
	FOREIGN KEY ("message") REFERENCES "polls"("message") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("user") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE "erasure_files" (
	"key" text PRIMARY KEY NOT NULL,
	"user" text NOT NULL,
	"created" bigint NOT NULL
);
CREATE TABLE "calls" (
	"id" text PRIMARY KEY NOT NULL,
	"caller" text NOT NULL,
	"callee" text NOT NULL,
	"mode" text NOT NULL,
	"state" text NOT NULL,
	"offer" text,
	"answer" text,
	"created" bigint NOT NULL,
	"expires" bigint NOT NULL,
	FOREIGN KEY ("caller") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("callee") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE "contacts" (
	"user" text PRIMARY KEY NOT NULL,
	"email_hash" text,
	"code" text NOT NULL,
	"discoverable" bigint DEFAULT 0 NOT NULL,
	FOREIGN KEY ("user") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE "friendships" (
	"id" text PRIMARY KEY NOT NULL,
	"sender" text NOT NULL,
	"recipient" text NOT NULL,
	"state" text NOT NULL,
	"created" bigint NOT NULL,
	FOREIGN KEY ("sender") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("recipient") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE "posts" (
	"id" text PRIMARY KEY NOT NULL,
	"author" text NOT NULL,
	"body" text NOT NULL,
	"created" bigint NOT NULL,
	"edited" bigint DEFAULT 0 NOT NULL,
	FOREIGN KEY ("author") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE "post_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"post" text NOT NULL,
	"author" text NOT NULL,
	"body" text NOT NULL,
	"created" bigint NOT NULL,
	FOREIGN KEY ("post") REFERENCES "posts"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("author") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE "post_likes" (
	"post" text NOT NULL,
	"user" text NOT NULL,
	PRIMARY KEY("post", "user"),
	FOREIGN KEY ("post") REFERENCES "posts"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("user") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE "social_profiles" (
	"user" text PRIMARY KEY NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	FOREIGN KEY ("user") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
CREATE TABLE "auth_accounts" (
	"user" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_salt" text NOT NULL,
	"password_hash" text NOT NULL,
	"created" bigint NOT NULL,
	FOREIGN KEY ("user") REFERENCES "users"("id") ON UPDATE no action ON DELETE CASCADE
);
CREATE TABLE "auth_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user" text NOT NULL,
	"created" bigint NOT NULL,
	"expires" bigint NOT NULL,
	FOREIGN KEY ("user") REFERENCES "users"("id") ON UPDATE no action ON DELETE CASCADE
);
CREATE TABLE "auth_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" bigint DEFAULT 0 NOT NULL,
	"reset" bigint NOT NULL
);
CREATE UNIQUE INDEX "chats_invite" ON "chats" ("invite");
CREATE INDEX "members_user" ON "members" ("user");
CREATE INDEX "messages_chat_time" ON "messages" ("chat","created");
CREATE INDEX "space_members_user" ON "space_members" ("user");
CREATE UNIQUE INDEX "spaces_invite" ON "spaces" ("invite");
ALTER TABLE "chats" ADD "space" text;
ALTER TABLE "chats" ADD "mode" text DEFAULT 'text' NOT NULL;
ALTER TABLE "chats" ADD "topic" text DEFAULT '' NOT NULL;
ALTER TABLE "messages" ADD "pinned" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "messages" ADD "edited" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD "closed" bigint DEFAULT 0 NOT NULL;
CREATE INDEX "calls_recipient" ON "calls" ("callee","expires");
CREATE INDEX "calls_expiry" ON "calls" ("expires");
CREATE UNIQUE INDEX "contacts_code" ON "contacts" ("code");
CREATE INDEX "contacts_email" ON "contacts" ("email_hash");
CREATE INDEX "friendships_recipient" ON "friendships" ("recipient","state");
CREATE INDEX "friendships_sender" ON "friendships" ("sender","state");
CREATE INDEX "post_comments_post" ON "post_comments" ("post","id");
CREATE INDEX "posts_author" ON "posts" ("author","created");
CREATE UNIQUE INDEX "auth_accounts_email" ON "auth_accounts" ("email");
CREATE INDEX "auth_sessions_user" ON "auth_sessions" ("user");
CREATE INDEX "auth_sessions_expiry" ON "auth_sessions" ("expires");
CREATE FUNCTION messages_active_author_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM users WHERE id IN (NEW."author") AND closed=1) THEN RAISE EXCEPTION 'Account closed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER messages_active_author BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION messages_active_author_check();

CREATE FUNCTION members_active_user_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM users WHERE id IN (NEW."user") AND closed=1) THEN RAISE EXCEPTION 'Account closed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER members_active_user BEFORE INSERT ON members FOR EACH ROW EXECUTE FUNCTION members_active_user_check();

CREATE FUNCTION space_members_active_user_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM users WHERE id IN (NEW."user") AND closed=1) THEN RAISE EXCEPTION 'Account closed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER space_members_active_user BEFORE INSERT ON space_members FOR EACH ROW EXECUTE FUNCTION space_members_active_user_check();

CREATE FUNCTION reactions_active_user_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM users WHERE id IN (NEW."user") AND closed=1) THEN RAISE EXCEPTION 'Account closed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER reactions_active_user BEFORE INSERT ON reactions FOR EACH ROW EXECUTE FUNCTION reactions_active_user_check();

CREATE FUNCTION stars_active_user_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM users WHERE id IN (NEW."user") AND closed=1) THEN RAISE EXCEPTION 'Account closed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER stars_active_user BEFORE INSERT ON stars FOR EACH ROW EXECUTE FUNCTION stars_active_user_check();

CREATE FUNCTION votes_active_user_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM users WHERE id IN (NEW."user") AND closed=1) THEN RAISE EXCEPTION 'Account closed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER votes_active_user BEFORE INSERT ON votes FOR EACH ROW EXECUTE FUNCTION votes_active_user_check();

CREATE FUNCTION chats_active_owner_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM users WHERE id IN (NEW."owner") AND closed=1) THEN RAISE EXCEPTION 'Account closed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER chats_active_owner BEFORE INSERT ON chats FOR EACH ROW EXECUTE FUNCTION chats_active_owner_check();

CREATE FUNCTION spaces_active_owner_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM users WHERE id IN (NEW."owner") AND closed=1) THEN RAISE EXCEPTION 'Account closed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER spaces_active_owner BEFORE INSERT ON spaces FOR EACH ROW EXECUTE FUNCTION spaces_active_owner_check();

CREATE FUNCTION contacts_active_user_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM users WHERE id IN (NEW."user") AND closed=1) THEN RAISE EXCEPTION 'Account closed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER contacts_active_user BEFORE INSERT ON contacts FOR EACH ROW EXECUTE FUNCTION contacts_active_user_check();

CREATE FUNCTION friendships_active_users_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM users WHERE id IN (NEW."sender",NEW."recipient") AND closed=1) THEN RAISE EXCEPTION 'Account closed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER friendships_active_users BEFORE INSERT ON friendships FOR EACH ROW EXECUTE FUNCTION friendships_active_users_check();

CREATE FUNCTION calls_active_users_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM users WHERE id IN (NEW."caller",NEW."callee") AND closed=1) THEN RAISE EXCEPTION 'Account closed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER calls_active_users BEFORE INSERT ON calls FOR EACH ROW EXECUTE FUNCTION calls_active_users_check();

CREATE FUNCTION posts_active_author_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM users WHERE id IN (NEW."author") AND closed=1) THEN RAISE EXCEPTION 'Account closed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER posts_active_author BEFORE INSERT ON posts FOR EACH ROW EXECUTE FUNCTION posts_active_author_check();

CREATE FUNCTION post_comments_active_author_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM users WHERE id IN (NEW."author") AND closed=1) THEN RAISE EXCEPTION 'Account closed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER post_comments_active_author BEFORE INSERT ON post_comments FOR EACH ROW EXECUTE FUNCTION post_comments_active_author_check();

CREATE FUNCTION post_likes_active_user_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM users WHERE id IN (NEW."user") AND closed=1) THEN RAISE EXCEPTION 'Account closed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER post_likes_active_user BEFORE INSERT ON post_likes FOR EACH ROW EXECUTE FUNCTION post_likes_active_user_check();

CREATE FUNCTION social_profiles_active_user_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM users WHERE id IN (NEW."user") AND closed=1) THEN RAISE EXCEPTION 'Account closed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER social_profiles_active_user BEFORE INSERT ON social_profiles FOR EACH ROW EXECUTE FUNCTION social_profiles_active_user_check();
