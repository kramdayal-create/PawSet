#!/usr/bin/env bash
# Start the Mobile App Security Scanner web dashboard.
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8000}"
HOST="${HOST:-127.0.0.1}"

# Create a virtualenv on first run.
if [ ! -d ".venv" ]; then
  echo "[setup] creating virtualenv…"
  python3 -m venv .venv
  ./.venv/bin/pip install --quiet --upgrade pip
  ./.venv/bin/pip install --quiet -r requirements.txt
fi

echo "[run] dashboard → http://${HOST}:${PORT}"
exec ./.venv/bin/uvicorn app.server:app --host "$HOST" --port "$PORT" "$@"
