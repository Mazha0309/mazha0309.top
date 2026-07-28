CREATE TABLE "friend_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"avatar_url" text,
	"description" text DEFAULT '' NOT NULL,
	"accent" text DEFAULT 'pink' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "icon_mode" text DEFAULT 'random' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "icon_value" text DEFAULT 'spark' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "icon_shape" text DEFAULT 'random' NOT NULL;--> statement-breakpoint
CREATE INDEX "friend_links_position_idx" ON "friend_links" USING btree ("position");--> statement-breakpoint
CREATE UNIQUE INDEX "friend_links_url_idx" ON "friend_links" USING btree ("url");