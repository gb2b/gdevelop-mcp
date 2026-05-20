/**
 * Shared helpers for MCP tool handlers. Keeps each tools/*.ts thin and
 * consistent: every handler returns text content; errors are surfaced with
 * isError:true so the agent can react instead of failing silently.
 */

export type ToolTextContent = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function textResult(value: unknown): ToolTextContent {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text" as const, text }] };
}

export function errorResult(message: string): ToolTextContent {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}
