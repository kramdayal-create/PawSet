#!/usr/bin/env bash
# Start the Wallet Integrity Gateway (demo) or run the attack demonstration.
#   ./run.sh          -> serve the gateway API on :8000
#   ./run.sh demo     -> run the in-process attack demonstration and exit
#   ./run.sh test     -> run the test suite
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "[setup] creating virtualenv…"
  python3 -m venv .venv
  ./.venv/bin/pip install --quiet --upgrade pip
  ./.venv/bin/pip install --quiet -r requirements.txt
fi
PY=./.venv/bin/python

case "${1:-serve}" in
  demo) exec "$PY" demo/attack_demo.py ;;
  test) exec "$PY" -m pytest tests/ -q ;;
  serve)
    PORT="${PORT:-8000}"
    echo "[run] gateway → http://127.0.0.1:${PORT}  (POST /session, /wallet/*, /webhooks/processor)"
    exec ./.venv/bin/uvicorn app.server:app --host 127.0.0.1 --port "$PORT"
    ;;
  *) echo "usage: ./run.sh [serve|demo|test]"; exit 1 ;;
esac
