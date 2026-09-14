CREATE TABLE `chats` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`owner` text NOT NULL,
	`invite` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chats_invite` ON `chats` (`invite`);--> statement-breakpoint
CREATE TABLE `members` (
	`chat` text NOT NULL,
	`user` text NOT NULL,
	PRIMARY KEY(`chat`, `user`),
	FOREIGN KEY (`chat`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `members_user` ON `members` (`user`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`chat` text NOT NULL,
	`author` text NOT NULL,
	`body` text NOT NULL,
	`created` integer NOT NULL,
	`scheduled` integer DEFAULT 0 NOT NULL,
	`reply` text,
	`file` text,
	`filename` text,
	FOREIGN KEY (`chat`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_chat_time` ON `messages` (`chat`,`created`);--> statement-breakpoint
CREATE TABLE `stars` (
	`message` text NOT NULL,
	`user` text NOT NULL,
	PRIMARY KEY(`message`, `user`),
	FOREIGN KEY (`message`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
