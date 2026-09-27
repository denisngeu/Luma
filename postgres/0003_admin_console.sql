ALTER TABLE users ADD COLUMN suspended integer NOT NULL DEFAULT 0 CHECK (suspended IN (0,1));
ALTER TABLE spaces ADD COLUMN locked integer NOT NULL DEFAULT 0 CHECK (locked IN (0,1));
ALTER TABLE chats ADD COLUMN locked integer NOT NULL DEFAULT 0 CHECK (locked IN (0,1));
ALTER TABLE messages ADD COLUMN hidden integer NOT NULL DEFAULT 0 CHECK (hidden IN (0,1));
ALTER TABLE posts ADD COLUMN hidden integer NOT NULL DEFAULT 0 CHECK (hidden IN (0,1));
CREATE TABLE service_settings (id integer PRIMARY KEY CHECK(id=1), registrations_open integer NOT NULL DEFAULT 1, calls_open integer NOT NULL DEFAULT 1);
INSERT INTO service_settings(id) VALUES(1);
CREATE TABLE admin_audit (id text PRIMARY KEY, actor text NOT NULL, action text NOT NULL, target text NOT NULL, reason text NOT NULL, before_state jsonb NOT NULL, after_state jsonb NOT NULL, created bigint NOT NULL);
CREATE INDEX admin_audit_created ON admin_audit(created DESC);
CREATE TABLE reports (id text PRIMARY KEY, reporter text NOT NULL REFERENCES users(id), kind text NOT NULL CHECK(kind IN ('user','message','post','space')), target text NOT NULL, reason text NOT NULL, state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','resolved','dismissed')), resolution text NOT NULL DEFAULT '', created bigint NOT NULL, resolved bigint);
CREATE UNIQUE INDEX reports_pending ON reports(reporter,kind,target) WHERE state='open';
CREATE INDEX reports_created ON reports(created DESC);
CREATE FUNCTION preserve_active_admin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.role='admin' AND OLD.closed=0 AND OLD.suspended=0 THEN
  PERFORM pg_advisory_xact_lock(721438901);
  IF (TG_OP='DELETE' OR NEW.role<>'admin' OR NEW.closed<>0 OR NEW.suspended<>0)
    AND NOT EXISTS(SELECT 1 FROM users WHERE id<>OLD.id AND role='admin' AND closed=0 AND suspended=0) THEN
   RAISE EXCEPTION 'The last active administrator must be retained';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preserve_active_admin BEFORE UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION preserve_active_admin();
