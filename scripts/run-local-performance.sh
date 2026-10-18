#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

count="${1:-100000}"
port="${PERF_API_PORT:-4300}"
if ! [[ "$count" =~ ^[0-9]+$ ]] || (( count < 1 || count > 100000 )); then
  echo "Movement fixture size must be from 1 to 100000." >&2
  exit 2
fi
if ! [[ "$port" =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )) || [[ "$port" == 3000 || "$port" == 4000 || "$port" == 55432 || "$port" == 55433 ]]; then
  echo "PERF_API_PORT must be valid and cannot be 3000, 4000, 55432, or 55433." >&2
  exit 2
fi
if ss -H -ltn "sport = :$port" | grep -q .; then
  echo "Performance API port $port is already in use; choose another port." >&2
  exit 2
fi

project="stockpilot-local-perf-$$"
if ! [[ "$project" =~ ^stockpilot-local-perf-[0-9]+$ ]]; then
  echo "Could not create a safe isolated Compose project name." >&2
  exit 2
fi

export PERF_API_PORT="$port"
export PRODUCTION_E2E_PORT="$port"
export WEB_ORIGIN="http://127.0.0.1:$port"
export SITE_URL="$WEB_ORIGIN"
export API_REVISION="${API_REVISION:-local-working-tree}"
export WEB_REVISION="${WEB_REVISION:-$API_REVISION}"
export WEBHOOK_SIGNING_SECRET=local-performance-webhook-secret
mkdir -p test-results-performance
compose=(docker compose --env-file /dev/null --project-name "$project" \
  --file docker-compose.production-e2e.yml \
  --file docker-compose.performance.yml)

cleanup() {
  local exit_code=$?
  trap - EXIT
  mkdir -p test-results-performance
  "${compose[@]}" logs --no-color > "test-results-performance/$project-compose.log" 2>&1 || true
  "${compose[@]}" down --volumes --remove-orphans || true
  exit "$exit_code"
}
trap cleanup EXIT

echo "Building isolated local production API image (revision: $API_REVISION)."
"${compose[@]}" build api
"${compose[@]}" up --detach --wait --wait-timeout 240 api

echo "Adding $count synthetic movement rows to the disposable demo tenant."
seed_output="$("${compose[@]}" exec --no-TTY postgres env PGPASSWORD=stockpilot_admin psql -h 127.0.0.1 -v ON_ERROR_STOP=1 \
  -v "fixture_count=$count" -U stockpilot_admin -d stockpilot \
  < scripts/perf-seed-movements.sql)"
printf '%s\n' "$seed_output"
grep -Fq "INSERT 0 $count" <<<"$seed_output" || {
  echo "Expected exactly $count synthetic movement rows; fixture insert did not match." >&2
  exit 1
}

revision_json="$(curl --fail --silent --show-error "$WEB_ORIGIN/v1/health/ready")"
api_revision="$(node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>process.stdout.write(JSON.parse(s).revision??""))' <<<"$revision_json")"
if [[ "$api_revision" != "$API_REVISION" ]]; then
  echo "API revision mismatch: expected $API_REVISION, got $api_revision." >&2
  exit 1
fi

echo "Run a bounded, read-only workload with explicit warmup and repeats."
for run in 1 2 3; do
  echo "Measured read-only run $run of 3."
  API_URL="$WEB_ORIGIN" pnpm perf:smoke -- --requests 100 --concurrency 10 --warmup 20 --include-movements --json \
    | tee "test-results-performance/$project-run-$run.json"
done

echo "Run a tenant-scoped query-plan sample using the application role."
organization_id="$("${compose[@]}" exec --no-TTY postgres env PGPASSWORD=stockpilot_admin psql -h 127.0.0.1 -At -U stockpilot_admin -d stockpilot \
  -c "SELECT id FROM organizations WHERE slug = 'stockpilot-demo'")"
product_id="$("${compose[@]}" exec --no-TTY postgres env PGPASSWORD=stockpilot_admin psql -h 127.0.0.1 -At -U stockpilot_admin -d stockpilot \
  -c "SELECT id FROM products WHERE organization_id = '$organization_id'::uuid AND is_active ORDER BY sku LIMIT 1")"
if [[ -z "$organization_id" || -z "$product_id" ]]; then
  echo "Seeded demo organization/product was not found for query-plan evidence." >&2
  exit 1
fi
"${compose[@]}" exec --no-TTY postgres env PGPASSWORD=stockpilot_app psql -h 127.0.0.1 -U stockpilot_app -d stockpilot \
  -c "BEGIN; SET LOCAL app.current_org_id = '$organization_id'; EXPLAIN (ANALYZE, BUFFERS, SETTINGS) SELECT id, type, quantity_delta, on_hand_after, created_at FROM stock_movements WHERE organization_id = '$organization_id'::uuid AND product_id = '$product_id'::uuid ORDER BY created_at DESC LIMIT 25; ROLLBACK;" \
  | tee "test-results-performance/$project-explain.txt"

echo "Rehearsing a local logical backup and restore inside the disposable database service."
backup_file="test-results-performance/$project.dump"
"${compose[@]}" exec --no-TTY postgres env PGPASSWORD=stockpilot_admin pg_dump -h 127.0.0.1 -Fc -U stockpilot_admin -d stockpilot > "$backup_file"
"${compose[@]}" exec --no-TTY postgres env PGPASSWORD=stockpilot_admin createdb -h 127.0.0.1 -U stockpilot_admin stockpilot_restore_check
"${compose[@]}" exec --no-TTY postgres env PGPASSWORD=stockpilot_admin pg_restore --exit-on-error --no-owner -h 127.0.0.1 \
  -U stockpilot_admin -d stockpilot_restore_check < "$backup_file"
restored_rows="$("${compose[@]}" exec --no-TTY postgres env PGPASSWORD=stockpilot_admin psql -h 127.0.0.1 -At -U stockpilot_admin \
  -d stockpilot_restore_check -c "SELECT count(*) FROM stock_movements WHERE reason = 'Synthetic local performance fixture'")"
if [[ "$restored_rows" != "$count" ]]; then
  echo "Restored movement count mismatch: expected $count, got $restored_rows." >&2
  exit 1
fi
original_counts="$("${compose[@]}" exec --no-TTY postgres env PGPASSWORD=stockpilot_admin psql -h 127.0.0.1 -At -F, -U stockpilot_admin -d stockpilot \
  -c "SELECT (SELECT count(*) FROM organizations), (SELECT count(*) FROM users), (SELECT count(*) FROM inventory_balances), (SELECT count(*) FROM sales_orders), (SELECT count(*) FROM stock_movements)")"
restored_counts="$("${compose[@]}" exec --no-TTY postgres env PGPASSWORD=stockpilot_admin psql -h 127.0.0.1 -At -F, -U stockpilot_admin -d stockpilot_restore_check \
  -c "SELECT (SELECT count(*) FROM organizations), (SELECT count(*) FROM users), (SELECT count(*) FROM inventory_balances), (SELECT count(*) FROM sales_orders), (SELECT count(*) FROM stock_movements)")"
if [[ "$restored_counts" != "$original_counts" ]]; then
  echo "Restored table counts differ: original=$original_counts restored=$restored_counts." >&2
  exit 1
fi
invariants="$("${compose[@]}" exec --no-TTY postgres env PGPASSWORD=stockpilot_admin psql -h 127.0.0.1 -At -F, -U stockpilot_admin -d stockpilot_restore_check \
  -c "WITH target AS (SELECT b.on_hand, b.reserved, b.on_hand - b.reserved AS available, COALESCE((SELECT sum(m.quantity_delta) FROM stock_movements m WHERE m.organization_id = b.organization_id AND m.product_id = b.product_id), 0) AS ledger_units, COALESCE((SELECT sum(l.quantity) FROM sales_order_lines l JOIN sales_orders o ON o.id = l.sales_order_id WHERE l.organization_id = b.organization_id AND l.product_id = b.product_id AND o.status = 'CONFIRMED'), 0) AS confirmed_units FROM inventory_balances b WHERE b.organization_id = '$organization_id'::uuid AND b.product_id = '$product_id'::uuid) SELECT (ledger_units = on_hand), (confirmed_units = reserved), (available >= 0), (SELECT count(*) = 0 FROM inventory_balances WHERE on_hand - reserved < 0) FROM target")"
if [[ "$invariants" != "t,t,t,t" ]]; then
  echo "Restored inventory invariants failed (ledger=on_hand, confirmed=reserved, available>=0, no negative balances): $invariants" >&2
  exit 1
fi
echo "Logical restore verified: $restored_rows synthetic movements; table counts match ($restored_counts); ledger, reservation, and availability invariants pass. This is not managed-provider PITR evidence."
