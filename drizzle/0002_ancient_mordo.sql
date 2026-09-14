CREATE TABLE `erasure_files` (
	`key` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `users` ADD `closed` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TRIGGER messages_active_author BEFORE INSERT ON messages WHEN EXISTS(SELECT 1 FROM users WHERE id=NEW.author AND closed=1) BEGIN SELECT RAISE(ABORT, 'Account closed'); END;
--> statement-breakpoint
CREATE TRIGGER members_active_user BEFORE INSERT ON members WHEN EXISTS(SELECT 1 FROM users WHERE id=NEW.user AND closed=1) BEGIN SELECT RAISE(ABORT, 'Account closed'); END;
--> statement-breakpoint
CREATE TRIGGER space_members_active_user BEFORE INSERT ON space_members WHEN EXISTS(SELECT 1 FROM users WHERE id=NEW.user AND closed=1) BEGIN SELECT RAISE(ABORT, 'Account closed'); END;
--> statement-breakpoint
CREATE TRIGGER reactions_active_user BEFORE INSERT ON reactions WHEN EXISTS(SELECT 1 FROM users WHERE id=NEW.user AND closed=1) BEGIN SELECT RAISE(ABORT, 'Account closed'); END;
--> statement-breakpoint
CREATE TRIGGER stars_active_user BEFORE INSERT ON stars WHEN EXISTS(SELECT 1 FROM users WHERE id=NEW.user AND closed=1) BEGIN SELECT RAISE(ABORT, 'Account closed'); END;
--> statement-breakpoint
CREATE TRIGGER votes_active_user BEFORE INSERT ON votes WHEN EXISTS(SELECT 1 FROM users WHERE id=NEW.user AND closed=1) BEGIN SELECT RAISE(ABORT, 'Account closed'); END;
--> statement-breakpoint
CREATE TRIGGER chats_active_owner BEFORE INSERT ON chats WHEN EXISTS(SELECT 1 FROM users WHERE id=NEW.owner AND closed=1) BEGIN SELECT RAISE(ABORT, 'Account closed'); END;
--> statement-breakpoint
CREATE TRIGGER spaces_active_owner BEFORE INSERT ON spaces WHEN EXISTS(SELECT 1 FROM users WHERE id=NEW.owner AND closed=1) BEGIN SELECT RAISE(ABORT, 'Account closed'); END;
