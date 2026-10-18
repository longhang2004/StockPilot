#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

compose_file=docker-compose.production-e2e.yml
port="${PRODUCTION_E2E_PORT:-4187}"
if [[ "$port" == 3000 || "$port" == 4000 || "$port" == 55432 || "$port" == 55433 ]]; then
  echo "Production E2E refuses to bind reserved user ports 3000, 4000, 55432, and 55433." >&2
  exit 2
fi
if ! [[ "$port" =~ ^[0-9]{1,5}$ ]] || (( port < 1 || port > 65535 )); then
  echo "PRODUCTION_E2E_PORT must be an integer from 1 to 65535." >&2
  exit 2
fi
if ss -H -ltn "sport = :$port" | grep -q .; then
  echo "Production E2E port $port is already in use; choose another port." >&2
  exit 2
fi

run_id="${GITHUB_RUN_ID:-local}"
attempt="${GITHUB_RUN_ATTEMPT:-$$}"
project="stockpilot-production-e2e-${run_id}-${attempt}"
if ! [[ "$project" =~ ^[a-z0-9][a-z0-9_-]*$ ]]; then
  echo "Could not create a safe Compose project name." >&2
  exit 2
fi

export PRODUCTION_E2E_PORT="$port"
export API_REVISION="${API_REVISION:-local-working-tree}"
export WEB_REVISION="${WEB_REVISION:-$API_REVISION}"
export E2E_BASE_URL="http://127.0.0.1:$port"
export WEB_ORIGIN="$E2E_BASE_URL"
export SITE_URL="$E2E_BASE_URL"
export WEBHOOK_SIGNING_SECRET=local-production-e2e-webhook-secret

compose() {
  docker compose --env-file /dev/null --project-name "$project" \
    --file "$compose_file" "$@"
}

cleanup() {
  local exit_code=$?
  trap - EXIT
  mkdir -p test-results-production
  compose logs --no-color > test-results-production/production-e2e-compose.log 2>&1 || true
  compose down --volumes --remove-orphans || true
  exit "$exit_code"
}
trap cleanup EXIT

echo "Building isolated production images for revision $API_REVISION."
compose build
compose up --detach --no-build --wait --wait-timeout 240 web

api_json="$(compose exec --no-TTY api node -e "fetch('http://127.0.0.1:4000/v1/health/ready').then(async r => console.log(JSON.stringify({ httpStatus: r.status, body: await r.json() }))).catch(e => { console.error(e); process.exit(1); })")"
api_revision="$(node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const r=JSON.parse(s);if(r.httpStatus!==200||r.body.status!=="ready"||r.body.checks?.database!=="ok")process.exit(1);process.stdout.write(r.body.revision??"")})' <<<"$api_json")" || {
  echo "API did not report ready with a healthy database." >&2
  exit 1
}
if [[ "$api_revision" != "$API_REVISION" ]]; then
  echo "API image revision mismatch: expected $API_REVISION, got $api_revision." >&2
  exit 1
fi

web_json="$(curl --fail --silent --show-error "$E2E_BASE_URL/version")"
web_revision="$(node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const body=JSON.parse(s);if(body.service!=="stockpilot-web")process.exit(1);process.stdout.write(body.revision??"")})' <<<"$web_json")"
if [[ "$web_revision" != "$WEB_REVISION" ]]; then
  echo "Web image revision mismatch: expected $WEB_REVISION, got $web_revision." >&2
  exit 1
fi

for service in api web; do
  user="$(compose ps --all --quiet "$service" | xargs -r docker inspect --format '{{.Config.User}}')"
  if [[ "$user" != node ]]; then
    echo "$service production container must run as node; found '$user'." >&2
    exit 1
  fi
done

echo "API and web images report revision $API_REVISION; database readiness passed."
pnpm exec playwright test --config playwright.production.config.ts "$@"
