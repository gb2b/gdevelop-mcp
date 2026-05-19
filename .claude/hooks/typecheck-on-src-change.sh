#!/usr/bin/env bash
# Quick typecheck hook: only fires when a TS file under src/ was touched.
# Reads Claude Code's PostToolUse JSON payload from stdin to know which file changed.

set -uo pipefail

PAYLOAD="$(cat)"
FILE_PATH="$(printf '%s' "$PAYLOAD" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path",""))' 2>/dev/null || true)"

case "$FILE_PATH" in
  */src/*.ts|*/test/*.ts)
    ;;
  *)
    exit 0
    ;;
esac

cd "$(dirname "$0")/../.." || exit 0
OUT="$(npx --no-install tsc --noEmit 2>&1)"
if [ $? -ne 0 ]; then
  printf '{"systemMessage":"typecheck failed after edit:\\n%s"}' "$(printf '%s' "$OUT" | head -c 1500 | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read())[1:-1])')"
fi
exit 0
