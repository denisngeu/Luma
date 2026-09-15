CREATE TABLE `post_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post` text NOT NULL,
	`author` text NOT NULL,
	`body` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`post`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `post_comments_post` ON `post_comments` (`post`,`id`);--> statement-breakpoint
CREATE TABLE `post_likes` (
	`post` text NOT NULL,
	`user` text NOT NULL,
	PRIMARY KEY(`post`, `user`),
	FOREIGN KEY (`post`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`author` text NOT NULL,
	`body` text NOT NULL,
	`created` integer NOT NULL,
	`edited` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`author`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `posts_author` ON `posts` (`author`,`created`);--> statement-breakpoint
CREATE TABLE `social_profiles` (
	`user` text PRIMARY KEY NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TRIGGER posts_active_author BEFORE INSERT ON posts WHEN EXISTS(SELECT 1 FROM users WHERE id=NEW.author AND closed=1) BEGIN SELECT RAISE(ABORT,'Account closed'); END;
--> statement-breakpoint
CREATE TRIGGER post_comments_active_author BEFORE INSERT ON post_comments WHEN EXISTS(SELECT 1 FROM users WHERE id=NEW.author AND closed=1) BEGIN SELECT RAISE(ABORT,'Account closed'); END;
--> statement-breakpoint
CREATE TRIGGER post_likes_active_user BEFORE INSERT ON post_likes WHEN EXISTS(SELECT 1 FROM users WHERE id=NEW.user AND closed=1) BEGIN SELECT RAISE(ABORT,'Account closed'); END;
--> statement-breakpoint
CREATE TRIGGER social_profiles_active_user BEFORE INSERT ON social_profiles WHEN EXISTS(SELECT 1 FROM users WHERE id=NEW.user AND closed=1) BEGIN SELECT RAISE(ABORT,'Account closed'); END;
