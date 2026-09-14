CREATE TABLE `polls` (
	`message` text PRIMARY KEY NOT NULL,
	`options` text NOT NULL,
	`closed` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`message`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reactions` (
	`message` text NOT NULL,
	`user` text NOT NULL,
	`emoji` text NOT NULL,
	PRIMARY KEY(`message`, `user`, `emoji`),
	FOREIGN KEY (`message`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `space_members` (
	`space` text NOT NULL,
	`user` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	PRIMARY KEY(`space`, `user`),
	FOREIGN KEY (`space`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `space_members_user` ON `space_members` (`user`);--> statement-breakpoint
CREATE TABLE `spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`owner` text NOT NULL,
	`invite` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spaces_invite` ON `spaces` (`invite`);--> statement-breakpoint
CREATE TABLE `votes` (
	`message` text NOT NULL,
	`user` text NOT NULL,
	`choice` integer NOT NULL,
	PRIMARY KEY(`message`, `user`),
	FOREIGN KEY (`message`) REFERENCES `polls`(`message`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `chats` ADD `space` text;--> statement-breakpoint
ALTER TABLE `chats` ADD `mode` text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE `chats` ADD `topic` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `pinned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `edited` integer DEFAULT 0 NOT NULL;