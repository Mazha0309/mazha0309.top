CREATE TABLE "comment_secrets" (
	"id" text PRIMARY KEY DEFAULT 'main' NOT NULL,
	"api_key_ciphertext" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
