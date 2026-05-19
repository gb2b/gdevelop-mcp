# Security Policy

## Reporting a vulnerability

If you find a security issue in `gdevelop-mcp`, please **do not** open a
public GitHub issue.

Instead, use one of:

- **GitHub Security Advisories** (preferred): the
  "[Report a vulnerability](https://github.com/gb2b/gdevelop-mcp/security/advisories/new)"
  button on the repository's Security tab.
- A direct message to a maintainer on GitHub.

We aim to respond within 7 days and to land a fix within 30 days for
confirmed issues. We'll publish a security advisory after the fix ships.

## Scope

In scope:

- Path-traversal in tools that read or write project files
  (`edit_project`, `import_assets_into_project`, `read_extension_source`,
  `undo_last_edit`, etc.).
- Command injection in any subprocess invocation.
- Stdio-protocol pollution that could be triggered by a malicious project
  file or asset response.
- Unsafe deserialization (parsing untrusted JSON / responses).

Out of scope:

- Issues that require the attacker to already control the local machine.
- Bugs in GDevelop itself (please report those upstream).
- Bugs in 3rd-party dependencies (please report to their respective
  projects — we'll pick up patched releases via Dependabot).

## Supported versions

The latest minor `0.x` release receives security fixes. Older versions
do not.

| Version  | Supported |
| -------- | --------- |
| `0.10.x` | ✅        |
| `< 0.10` | ❌        |
