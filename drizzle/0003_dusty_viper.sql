CREATE TABLE `calls` (
	`id` text PRIMARY KEY NOT NULL,
	`caller` text NOT NULL,
	`callee` text NOT NULL,
	`mode` text NOT NULL,
	`state` text NOT NULL,
	`offer` text,
	`answer` text,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`caller`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`callee`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `calls_recipient` ON `calls` (`callee`,`expires`);--> statement-breakpoint
CREATE INDEX `calls_expiry` ON `calls` (`expires`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`user` text PRIMARY KEY NOT NULL,
	`email_hash` text,
	`code` text NOT NULL,
	`discoverable` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_code` ON `contacts` (`code`);--> statement-breakpoint
CREATE INDEX `contacts_email` ON `contacts` (`email_hash`);--> statement-breakpoint
CREATE TABLE `friendships` (
	`id` text PRIMARY KEY NOT NULL,
	`sender` text NOT NULL,
	`recipient` text NOT NULL,
	`state` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`sender`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `friendships_recipient` ON `friendships` (`recipient`,`state`);--> statement-breakpoint
CREATE INDEX `friendships_sender` ON `friendships` (`sender`,`state`);
--> statement-breakpoint
CREATE TRIGGER contacts_active_user BEFORE INSERT ON contacts WHEN EXISTS(SELECT 1 FROM users WHERE id=NEW.user AND closed=1) BEGIN SELECT RAISE(ABORT, 'Account closed'); END;
--> statement-breakpoint
CREATE TRIGGER friendships_active_users BEFORE INSERT ON friendships WHEN EXISTS(SELECT 1 FROM users WHERE id IN (NEW.sender,NEW.recipient) AND closed=1) BEGIN SELECT RAISE(ABORT, 'Account closed'); END;
--> statement-breakpoint
CREATE TRIGGER calls_active_users BEFORE INSERT ON calls WHEN EXISTS(SELECT 1 FROM users WHERE id IN (NEW.caller,NEW.callee) AND closed=1) BEGIN SELECT RAISE(ABORT, 'Account closed'); END;
