---
name: audit-repo
description: Run a structural audit of the gdevelop-mcp repo before tagging a release. Checks file sizes, README↔code sync, test coverage, deps freshness. Reports concisely without auto-fixing.
---

# Repo audit

This skill is a manual checklist. For a more thorough automated review,
dispatch the `repo-reviewer` agent (`.claude/agents/repo-reviewer.md`).

## Manual quick checks

Run these in order. Each is fast (~1 second).

### File sizes

```bash
wc -l src/index.ts src/core/*.ts src/tools/*.ts 2>/dev/null | awk '$1 > 500 && $2 != "total"'
```

Flag anything over 500 lines. `src/index.ts` should be under 200.

### Tool surface vs README

```bash
# Count registered tools
TOOLS=$(grep -hE "^\s*server\.tool\(" src/tools/*.ts src/index.ts 2>/dev/null | wc -l)
# Count README tool table rows (lines starting with "| `")
README_ROWS=$(grep -cE "^\| \`[a-z_]+\`" README.md)
echo "Tools registered: $TOOLS"
echo "README rows: $README_ROWS"
```

If they don't match, run the `update-readme` skill.

### Test coverage signal

```bash
ls src/core/*.ts | xargs -n1 basename | sed 's/\.ts$/.test.ts/' | while read f; do
  [[ -f "test/$f" ]] || echo "MISSING test/$f"
done
```

Lists modules without a matching test file.

### CHANGELOG up to date

```bash
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "none")
COMMITS_SINCE=$(git log "$LAST_TAG..HEAD" --oneline 2>/dev/null | wc -l)
echo "Commits since $LAST_TAG: $COMMITS_SINCE"
```

If > 0 commits since the last tag, the CHANGELOG should have a pending
section (with the next version) for whatever those commits changed.

### Dependency freshness

```bash
npm outdated --depth=0 2>/dev/null | head -20
```

Don't auto-update — just note what's behind. Dependabot handles routine
updates; this is for catching anything stuck.

## When to invoke the agent

The `repo-reviewer` agent (under `.claude/agents/`) does a deeper audit
including:

- Hardcoded catalog duplicates between static and dynamic parsers
- Path safety in tool handlers
- Stdio pollution (`console.log` in non-error paths)
- Rule violations (cross-referenced with `.claude/rules/*.md`)

Invoke when the repo has changed significantly (3+ commits since the
last audit) or before tagging a release.
