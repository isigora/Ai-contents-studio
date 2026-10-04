#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .data
# Serialise concurrent postStart/manual launches; never open PGlite twice.
exec 9>.data/start.lock
flock -w 180 9 || { echo "Another startup is still running." >&2; exit 1; }
node scripts/setup-codespaces.mjs
if node scripts/check-ready.mjs >/dev/null 2>&1; then
  echo "Content Studio is already running on port 4173."
  exit 0
fi
# A listening but unhealthy server must not be duplicated against the same DB.
if node --input-type=module -e 'import net from "node:net";const s=net.connect(4173,"127.0.0.1");s.on("connect",()=>{s.destroy();process.exit(0)});s.on("error",()=>process.exit(1));s.setTimeout(2000,()=>{s.destroy();process.exit(1)});'; then
  echo "Port 4173 is occupied but Studio/authentication is not ready. Inspect .data/dev-server.log before restarting." >&2
  exit 1
fi
nohup node scripts/node-dev.mjs > .data/dev-server.log 2>&1 < /dev/null 9>&- &
server_pid=$!
for attempt in $(seq 1 60); do
  if node scripts/check-ready.mjs >/dev/null 2>&1; then
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
