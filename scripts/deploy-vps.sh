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

echo "Cleaning up stale deployment one-off containers"
mapfile -t stale_oneoffs < <(
  docker ps -aq \
    --filter "label=com.docker.compose.project=mazha-home" \
    --filter "label=com.docker.compose.oneoff=True"
)
if ((${#stale_oneoffs[@]} > 0)); then
  docker rm -f "${stale_oneoffs[@]}" >/dev/null
fi

active_oneoff=""
previous_image=""
app_stopped_for_deploy=false

cleanup_active_oneoff() {
  if [[ -n "$active_oneoff" ]]; then
    docker rm -f "$active_oneoff" >/dev/null 2>&1 || true
  fi
}

cleanup_on_exit() {
  local exit_code=$?
  trap - EXIT
  set +e
  cleanup_active_oneoff
  if
    ((exit_code != 0)) &&
    [[ "$app_stopped_for_deploy" == true ]] &&
    [[ -n "$previous_image" ]] &&
    [[ "$previous_image" != "$APP_IMAGE" ]]
  then
    echo "Deployment failed; restoring $previous_image" >&2
    export APP_IMAGE="$previous_image"
    docker compose up -d --no-build app postgres >&2
  fi
  exit "$exit_code"
}
trap cleanup_on_exit EXIT

run_app_oneoff() {
  local name="$1"
  shift
  docker rm -f "$name" >/dev/null 2>&1 || true
  active_oneoff="$name"
  if ! timeout --foreground --signal=TERM --kill-after=15s 180s \
    docker compose run \
      --rm \
      --name "$name" \
      --no-deps \
      -e PGCONNECT_TIMEOUT=10 \
      app "$@"; then
    echo "One-off task failed or exceeded 180 seconds: $name" >&2
    docker rm -f "$name" >/dev/null 2>&1 || true
    active_oneoff=""
    docker compose logs --tail=120 postgres >&2 || true
    return 1
  fi
  active_oneoff=""
}

container_id="$(docker compose ps -q app 2>/dev/null || true)"
if [[ -n "$container_id" ]]; then
  previous_image="$(docker inspect --format '{{.Config.Image}}' "$container_id" 2>/dev/null || true)"
fi

echo "Pulling $APP_IMAGE"
docker compose pull app

echo "Starting PostgreSQL"
docker compose up -d --no-build postgres

database_ready=false
for _attempt in {1..30}; do
  if docker compose exec -T postgres sh -c \
    'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
    >/dev/null 2>&1; then
    database_ready=true
    break
  fi
  sleep 2
done

if [[ "$database_ready" != true ]]; then
  echo "PostgreSQL did not become ready." >&2
  docker compose logs --tail=120 postgres >&2 || true
  exit 1
fi

if [[ -n "$container_id" ]]; then
  echo "Stopping the current application to free memory for migrations"
  app_stopped_for_deploy=true
  docker compose stop -t 20 app
fi

echo "Applying forward-only database migrations"
run_app_oneoff mazha-home-migrate npm run db:migrate
run_app_oneoff mazha-home-seed npm run db:seed

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
if [[ -z "$previous_image" || "$previous_image" == "$APP_IMAGE" ]]; then
  echo "No previous image was available for automatic rollback." >&2
fi

exit 1
