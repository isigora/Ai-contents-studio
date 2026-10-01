#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/setup-codespaces.mjs
mkdir -p .data
if curl --max-time 3 -fsS http://localhost:4173/ -o /dev/null; then
  echo "Content Studio is already running on port 4173."
  exit 0
fi
nohup node scripts/node-dev.mjs > .data/dev-server.log 2>&1 < /dev/null &
server_pid=$!
for attempt in $(seq 1 60); do
  if curl --max-time 3 -fsS http://localhost:4173/ -o /dev/null 2>/dev/null; then
    echo "Content Studio is ready. Open private port 4173 from the Ports panel."
    exit 0
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "Server exited. Inspect .data/dev-server.log." >&2
    exit 1
  fi
  sleep 2
done
echo "Server readiness timed out. Inspect .data/dev-server.log." >&2
exit 1
