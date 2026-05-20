/**
 * Stdio-safe logger.
 *
 * The MCP transport owns `process.stdout` — anything we write there breaks
 * the JSON-RPC stream. This module ensures all log output goes to
 * `process.stderr`, with a level filter controlled by the
 * `GDEVELOP_MCP_LOG_LEVEL` env var (default: "warn").
 *
 * Use this in `src/core/*` instead of `console.log` / `console.error`.
 * Tool handlers shouldn't need it — they return structured content.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

function resolveLevel(): number {
  const raw = (process.env.GDEVELOP_MCP_LOG_LEVEL ?? "warn") as LogLevel;
  return LEVELS[raw] ?? LEVELS.warn;
}

const currentLevel = resolveLevel();

function emit(level: LogLevel, message: string, extra?: unknown): void {
  if (LEVELS[level] < currentLevel) return;
  const ts = new Date().toISOString();
  const head = `[${ts}] [${level.toUpperCase()}]`;
  const body =
    extra !== undefined ? `${message} ${safeStringify(extra)}` : message;
  process.stderr.write(`${head} ${body}\n`);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const logger = {
  debug: (msg: string, extra?: unknown) => emit("debug", msg, extra),
  info: (msg: string, extra?: unknown) => emit("info", msg, extra),
  warn: (msg: string, extra?: unknown) => emit("warn", msg, extra),
  error: (msg: string, extra?: unknown) => emit("error", msg, extra),
};
