#!/usr/bin/env bash
# PostToolUse hook: warn when src/ files exceed the size limits defined
# in .claude/rules/file-size.md.
#
# Limits:
#   - src/index.ts          : 200 lines (entry point only)
#   - src/**/*.ts           : 500 lines
#   - test/**/*.ts          : 600 lines

set -u

SRC_DIR="$(cd "$(dirname "$0")/../.." && pwd)/src"
TEST_DIR="$(cd "$(dirname "$0")/../.." && pwd)/test"

threshold_for() {
  local f="$1"
  if [[ "$f" == */src/index.ts ]]; then
    echo 200
  elif [[ "$f" == */test/* ]]; then
    echo 600
  else
    echo 500
  fi
}

over=()
for f in "$SRC_DIR"/*.ts "$SRC_DIR"/**/*.ts "$TEST_DIR"/*.ts 2>/dev/null; do
  [[ -f "$f" ]] || continue
  lines=$(wc -l < "$f" | tr -d ' ')
  limit=$(threshold_for "$f")
  if (( lines > limit )); then
    over+=("$f ($lines > $limit)")
  fi
done

if (( ${#over[@]} > 0 )); then
  echo "⚠️  File-size limit exceeded — consider splitting:" >&2
  for line in "${over[@]}"; do
    echo "    $line" >&2
  done
  echo "  See .claude/rules/file-size.md for the splitting playbook." >&2
fi

exit 0
