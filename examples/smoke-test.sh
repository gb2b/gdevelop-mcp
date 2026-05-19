#!/usr/bin/env bash
# Sends initialize + tools/list to the MCP server and prints responses.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f dist/index.js ]; then
  echo "dist/index.js not found. Run 'npm run build' first." >&2
  exit 1
fi

printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke-test","version":"1.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  '{"jsonrpc":"2.0","id":3,"method":"prompts/list","params":{}}' \
  | node dist/index.js
