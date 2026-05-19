---
name: add-mcp-prompt
description: Use when adding a new MCP prompt (slash command) to the gdevelop-mcp server. Prompts inject a guided workflow message — they don't run code directly.
---

# Adding an MCP prompt

Prompts in `gdevelop-mcp` are workflow templates surfaced as slash commands
(e.g. `/gdevelop:add-hero`). They inject a structured user message that
tells the agent which tools to call, in what order, and where to pause for
user confirmation.

## Checklist

- [ ] Decide if a prompt is the right primitive. A prompt is appropriate
      when the workflow has 3+ steps, involves multiple tools, and benefits
      from a fixed "rail". For single-step actions, a tool is enough.
- [ ] Add the prompt in `src/prompts.ts` inside `registerPrompts(server)`.
- [ ] Use a kebab-case name (e.g. `import-pack`, `setup-platformer`).
- [ ] Define args with Zod — keep them few and meaningful.
- [ ] Write the prompt body as a numbered workflow:
      1. inspect
      2. discover
      3. plan (dryRun if a write is involved)
      4. wait for user approval
      5. apply
      6. verify
- [ ] When the workflow involves writing, **always** include `dryRun: true`
      before the apply step.
- [ ] Run `npm test` (smoke-tests prompts/list).
- [ ] Update `README.md`'s prompts table.

## Template

```ts
server.prompt(
  "my-prompt-name",
  "One-sentence description of what this workflow does.",
  {
    projectPath: z.string().describe("Absolute path to the project"),
    something: z.string().describe("..."),
  },
  ({ projectPath, something }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: [
            `<one-line goal statement>`,
            "",
            "Steps (do NOT modify until I approve):",
            `1. inspect_project({path: "${projectPath}"})`,
            `2. ...discovery tool calls...`,
            "3. Build the edit_project payload, dryRun:true.",
            "4. Show me the summary, wait for approval.",
            "5. Apply with dryRun:false. backup defaults to true.",
            "6. inspect_project to verify.",
          ].join("\n"),
        },
      },
    ],
  }),
);
```

## Style guide

- The prompt body is read by the model — be **explicit** about which tools
  to call (give them by name, with their argument structure).
- Make confirmation points **explicit**: say "WAIT for my confirmation"
  before any write.
- Keep the prompt under ~30 lines — long prompts get ignored or
  paraphrased.
