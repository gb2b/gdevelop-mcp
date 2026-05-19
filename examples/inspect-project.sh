#!/usr/bin/env bash
# Calls inspect_project on a given GDevelop project file.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 /absolute/path/to/game.json" >&2
  exit 1
fi

PROJECT_PATH="$1"

cd "$(dirname "$0")/.."

if [ ! -f dist/index.js ]; then
  echo "dist/index.js not found. Run 'npm run build' first." >&2
  exit 1
fi

printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"inspect-project","version":"1.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}' \
  "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"inspect_project\",\"arguments\":{\"path\":\"$PROJECT_PATH\"}}}" \
  | node dist/index.js
