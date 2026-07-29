CREATE TABLE "analytics_visitors" (
	"visitor_hash" text PRIMARY KEY NOT NULL,
	"views" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analytics_visitors_last_seen_idx" ON "analytics_visitors" USING btree ("last_seen_at");