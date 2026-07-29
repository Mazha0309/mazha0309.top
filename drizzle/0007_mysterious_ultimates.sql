ALTER TABLE "music_tracks" ADD COLUMN "source_fingerprint" text;--> statement-breakpoint
CREATE UNIQUE INDEX "music_tracks_source_fingerprint_idx" ON "music_tracks" USING btree ("source_fingerprint");