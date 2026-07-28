#!/usr/bin/env bash
set -Eeuo pipefail

image="${1:-}"
if [[ -z "$image" || "$image" != ghcr.io/*:* ]]; then
  echo "Usage: $0 ghcr.io/owner/repository:tag" >&2
  exit 2
fi

if [[ ! -f .env ]]; then
  echo "Missing .env in $(pwd). Complete the one-time VPS bootstrap first." >&2
  exit 2
fi

export APP_IMAGE="$image"
docker compose config --quiet

container_id="$(docker compose ps -q app 2>/dev/null || true)"
previous_image=""
if [[ -n "$container_id" ]]; then
  previous_image="$(docker inspect --format '{{.Config.Image}}' "$container_id" 2>/dev/null || true)"
fi

echo "Pulling $APP_IMAGE"
docker compose pull app

echo "Applying forward-only database migrations"
docker compose run --rm --no-deps app npm run db:migrate
docker compose run --rm --no-deps app npm run db:seed

echo "Starting the new application container"
docker compose up -d --no-build app postgres

healthy=false
for _attempt in {1..30}; do
  if docker compose exec -T app node -e \
    "fetch('http://127.0.0.1:3000/readyz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" \
    >/dev/null 2>&1; then
    healthy=true
    break
  fi
  sleep 2
done

if [[ "$healthy" == true ]]; then
  printf '%s\n' "$APP_IMAGE" > .last-successful-image
  echo "Deployment is healthy: $APP_IMAGE"
  exit 0
fi

echo "Readiness check failed." >&2
docker compose logs --tail=120 app >&2 || true

if [[ -n "$previous_image" && "$previous_image" != "$APP_IMAGE" ]]; then
  echo "Rolling the app container back to $previous_image" >&2
  export APP_IMAGE="$previous_image"
  docker compose up -d --no-build app
else
  echo "No previous image was available for automatic rollback." >&2
fi

exit 1
