#!/usr/bin/env bash
# Runs PostgREST (public read-only API) and the ingester in one container.
# If either stops, the container exits so the host restarts it.
set -u

export PGRST_SERVER_PORT="${PORT:-10000}"
export PGRST_DB_URI="${PGRST_DB_URI:-${DATABASE_URL:-}}"
export PGRST_DB_SCHEMAS="${PGRST_DB_SCHEMAS:-public}"
export PGRST_DB_ANON_ROLE="${PGRST_DB_ANON_ROLE:-web_anon}"
export PGRST_DB_MAX_ROWS="${PGRST_DB_MAX_ROWS:-1000}"
export PGRST_DB_POOL="${PGRST_DB_POOL:-5}"

if [ -z "$PGRST_DB_URI" ]; then echo "Set DATABASE_URL (or PGRST_DB_URI)"; exit 1; fi

postgrest &
PG_PID=$!

(
  while true; do
    npx tsx src/ingest.ts
    echo "ingester exited; restarting in 5s"
    sleep 5
  done
) &
ING_PID=$!

trap 'kill $PG_PID $ING_PID 2>/dev/null; exit 0' TERM INT
wait -n
echo "a process exited; stopping the container so it restarts"
kill $PG_PID $ING_PID 2>/dev/null
exit 1
