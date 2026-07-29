#!/usr/bin/env bash
set -Eeuo pipefail

compose_file="${COMPOSE_FILE_PATH:-compose.yaml}"
output_dir="${BACKUP_OUTPUT_DIR:-backups}"
postgres_user="${POSTGRES_USER:-mazha}"
postgres_db="${POSTGRES_DB:-mazha_home}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive_name="mazha-home-cms-${timestamp}.tar.gz"

mkdir -p "$output_dir"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

compose=(docker compose -f "$compose_file")

echo "Exporting CMS tables (auth and analytics are intentionally excluded)."
"${compose[@]}" exec -T postgres pg_dump \
  --username "$postgres_user" \
  --dbname "$postgres_db" \
  --format custom \
  --data-only \
  --no-owner \
  --no-privileges \
  --table public.site_profiles \
  --table public.content_links \
  --table public.posts \
  --table public.post_slugs \
  --table public.post_revisions \
  --table public.comment_settings \
  --table public.comments \
  --table public.projects \
  --table public.friend_links \
  --table public.pages \
  --table public.music_tracks \
  --table public.media \
  > "$work_dir/content.dump"

echo "Exporting persistent media."
"${compose[@]}" exec -T app tar -C /data/media -czf - . \
  > "$work_dir/media.tar.gz"

(
  cd "$work_dir"
  sha256sum content.dump media.tar.gz > SHA256SUMS
  cat > BACKUP-NOTES.txt <<'EOF'
This archive contains CMS content, revisions, comments, comment moderation settings,
projects, friend links, page settings, music tracks, media metadata, and media files. Better Auth
tables, sessions, OAuth tokens, secrets, and raw analytics are deliberately excluded.

This backup is not encrypted. Store it only in the dedicated private repository.
EOF
  tar -czf "$archive_name" content.dump media.tar.gz SHA256SUMS BACKUP-NOTES.txt
)

mv "$work_dir/$archive_name" "$output_dir/$archive_name"
echo "$output_dir/$archive_name"
