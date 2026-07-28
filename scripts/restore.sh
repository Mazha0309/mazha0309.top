#!/usr/bin/env bash
set -Eeuo pipefail

archive="${1:-}"
mode="${2:---verify}"
compose_file="${COMPOSE_FILE_PATH:-compose.yaml}"
postgres_user="${POSTGRES_USER:-mazha}"
postgres_db="${POSTGRES_DB:-mazha_home}"

if [[ -z "$archive" || ! -f "$archive" ]]; then
  echo "Usage: $0 path/to/backup.tar.gz [--verify|--apply]" >&2
  exit 2
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
tar -xzf "$archive" -C "$work_dir"
(
  cd "$work_dir"
  sha256sum --check SHA256SUMS
)

if [[ "$mode" == "--verify" ]]; then
  echo "Backup verified; no data was changed."
  exit 0
fi

if [[ "$mode" != "--apply" || "${RESTORE_CONFIRM:-}" != "replace-cms-content" ]]; then
  echo "Restore replaces current CMS rows." >&2
  echo "Re-run with --apply and RESTORE_CONFIRM=replace-cms-content." >&2
  exit 2
fi

compose=(docker compose -f "$compose_file")

"${compose[@]}" exec -T postgres psql \
  --username "$postgres_user" \
  --dbname "$postgres_db" \
  --set ON_ERROR_STOP=1 \
  --command "truncate table public.post_revisions, public.post_slugs, public.posts, public.projects, public.pages, public.content_links, public.site_profiles, public.media cascade"

"${compose[@]}" exec -T postgres pg_restore \
  --username "$postgres_user" \
  --dbname "$postgres_db" \
  --data-only \
  --no-owner \
  --no-privileges \
  --disable-triggers \
  < "$work_dir/content.dump"

"${compose[@]}" exec -T app tar -C /data/media -xzf - \
  < "$work_dir/media.tar.gz"

echo "CMS content and media restored. Auth and analytics were left untouched."
