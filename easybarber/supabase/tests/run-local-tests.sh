#!/usr/bin/env bash
# Spins up a throwaway Postgres container, applies the real product
# migrations from supabase/migrations/ UNMODIFIED, layers on the
# local-only auth stub + test helpers, then runs the negative-test
# suite in supabase/tests/negative/. Exits non-zero on the first
# failure (ON_ERROR_STOP=1), so a clean exit code is the "verified"
# signal.
#
# Nothing here is deployed anywhere — it is purely local verification
# before this schema is ever pointed at a real Supabase project.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTAINER_NAME="easybarber-rls-test"
IMAGE="postgres:16-alpine"
DB_NAME="easybarber_test"
DB_USER="postgres"
CONTAINER_SUPABASE_DIR="/supabase"

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Starting throwaway Postgres container ($IMAGE)..."
cleanup
docker run -d --name "$CONTAINER_NAME" \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB="$DB_NAME" \
  "$IMAGE" >/dev/null

echo "==> Waiting for Postgres to accept connections..."
for i in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo "Postgres did not become ready in time." >&2
    exit 1
  fi
done

echo "==> Copying supabase/ into the container..."
docker exec "$CONTAINER_NAME" mkdir -p "$CONTAINER_SUPABASE_DIR"
docker cp "$SUPABASE_DIR/." "$CONTAINER_NAME:$CONTAINER_SUPABASE_DIR"

run_sql_file() {
  local container_path="$1"
  echo "----------------------------------------------------------------"
  echo "==> Applying: $container_path"
  docker exec "$CONTAINER_NAME" \
    psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -f "$container_path"
}

echo "==> Loading local auth stub + test helpers..."
run_sql_file "$CONTAINER_SUPABASE_DIR/tests/local-harness/000_auth_stub.sql"
run_sql_file "$CONTAINER_SUPABASE_DIR/tests/local-harness/001_test_helpers.sql"

echo "==> Applying product migrations (supabase/migrations/*.sql, unmodified)..."
for f in "$SUPABASE_DIR"/migrations/*.sql; do
  base="$(basename "$f")"
  run_sql_file "$CONTAINER_SUPABASE_DIR/migrations/$base"
done

echo "==> Running negative / isolation test suite..."
run_sql_file "$CONTAINER_SUPABASE_DIR/tests/negative/run_all.sql"

echo "----------------------------------------------------------------"
echo "ALL TESTS PASSED"
