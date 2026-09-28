ALTER TABLE social_profiles ADD COLUMN avatar text;
ALTER TABLE social_profiles ADD COLUMN avatar_mime text;

ALTER TABLE spaces ADD COLUMN rules text NOT NULL DEFAULT '';

CREATE TABLE user_preferences (
  "user" text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notifications text NOT NULL DEFAULT 'mentions',
  call_camera integer NOT NULL DEFAULT 0 CHECK(call_camera IN (0,1)),
  call_noise_suppression integer NOT NULL DEFAULT 1 CHECK(call_noise_suppression IN (0,1)),
  call_echo_cancellation integer NOT NULL DEFAULT 1 CHECK(call_echo_cancellation IN (0,1)),
  reduce_motion integer NOT NULL DEFAULT 0 CHECK(reduce_motion IN (0,1)),
  updated bigint NOT NULL
);

CREATE TABLE space_bots (
  space text NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('welcome','moderation','digest')),
  enabled integer NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated bigint NOT NULL,
  PRIMARY KEY(space,kind)
);

CREATE INDEX space_bots_enabled ON space_bots(space,enabled);
