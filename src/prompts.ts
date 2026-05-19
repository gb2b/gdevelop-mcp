import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer): void {
  server.prompt(
    "start-from-example",
    "Bootstrap or extend a GDevelop project by learning from one of the 281 official MIT-licensed examples.",
    {
      exampleSlug: z
        .string()
        .describe(
          "Example slug, e.g. 'platformer', '3d-car-coin-hunt', 'top-down-rpg'",
        ),
      projectPath: z
        .string()
        .describe("Absolute path to the target GDevelop .json project file"),
    },
    ({ exampleSlug, projectPath }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `I want to learn from the official GDevelop example "${exampleSlug}" and adapt patterns from it into my project at ${projectPath}.`,
              "",
              "Please follow this exact workflow — do NOT modify the project until I approve a plan:",
              "",
              `1. Call get_example_details({slugOrId: "${exampleSlug}"}) to see metadata and source path.`,
              `2. Call read_github_source({repo: "GDevelopApp/GDevelop-examples", path: "examples/${exampleSlug}"}) to list the example's files.`,
              `3. Read the example's game.json with read_github_source (same repo).`,
              `4. Call inspect_project({path: "${projectPath}"}) to see my current state.`,
              "5. Summarize the example's structure: scenes, key objects, behaviors, notable event patterns.",
              "6. Propose a concrete adaptation plan: which scenes/objects/behaviors to add to MY project, and how.",
              "7. WAIT for my confirmation before running edit_project (use dryRun:true first when I approve).",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.prompt(
    "add-hero",
    "Find a free CC0 hero/player sprite and wire it up with the right movement behavior.",
    {
      projectPath: z
        .string()
        .describe("Absolute path to the GDevelop project file"),
      genre: z
        .enum(["platformer", "topdown"])
        .describe("Game genre — drives the behavior choice"),
      scene: z.string().describe("Scene name where the hero should be placed"),
    },
    ({ projectPath, genre, scene }) => {
      const behavior =
        genre === "platformer"
          ? "PlatformBehavior::PlatformerObjectBehavior"
          : "TopDownMovementBehavior::TopDownMovementBehavior";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Add a hero/player character to my GDevelop project at ${projectPath}, in scene "${scene}".`,
                `Genre: ${genre} — use ${behavior}.`,
                "",
                "Workflow:",
                `1. inspect_project({path: "${projectPath}"}) — confirm "${scene}" exists.`,
                `2. search_assets({query: "${genre === "platformer" ? "hero player run" : "character top-down"}", license: "CC0 (public domain)", objectType: "sprite", limit: 6}) — show me 4-6 candidates with their previewImageUrls.`,
                "3. Once I pick an asset id, call get_asset_details to verify the structure.",
                "4. Build an edit_project batch (dryRun:true first):",
                `   - import_assets_into_project to download files and add the object`,
                `   - attach_behavior with type "${behavior}" with reasonable defaults`,
                `   - add_instance at a sensible starting position`,
                "5. Show me the summary, wait for approval, then apply with dryRun:false.",
                "6. inspect_project after to confirm.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  );

  server.prompt(
    "debug-project",
    "Diagnose problems with a GDevelop project that won't open or behaves unexpectedly.",
    {
      projectPath: z
        .string()
        .describe("Absolute path to the GDevelop project file"),
    },
    ({ projectPath }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Diagnose what's wrong with my GDevelop project at ${projectPath}. Do NOT modify anything until I approve a fix.`,
              "",
              "Diagnostic workflow:",
              `1. validate_project({path: "${projectPath}"}) — report errors and warnings.`,
              `2. inspect_project({path: "${projectPath}"}) — show the overall structure.`,
              `3. list_backups({path: "${projectPath}"}) — list available backups.`,
              `4. If backups exist, diff_projects between the most recent backup and the current file to spot what changed recently.`,
              "5. For any unknown object/behavior types in the validation warnings, call describe_object_schema and/or read_extension_source to verify whether they're valid for my GDevelop install.",
              "6. Synthesize: list each concrete issue, its likely cause, and a proposed minimal fix as a set of edit_project ops (or an undo_last_edit if applicable).",
              "7. WAIT for my confirmation before any modification.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.prompt(
    "browse-store",
    "Search the GDevelop asset store for a theme/style and import matching CC0 assets into a project.",
    {
      projectPath: z
        .string()
        .describe("Absolute path to the GDevelop project file"),
      theme: z
        .string()
        .describe("Theme or style keywords (e.g. 'forest', 'space shooter')"),
      scene: z
        .string()
        .optional()
        .describe(
          "If provided, suggest placement and offer to insert instances",
        ),
    },
    ({ projectPath, theme, scene }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Find GDevelop public store assets matching theme "${theme}" and prepare them for import into ${projectPath}.`,
              scene ? `Target scene: "${scene}".` : "",
              "",
              "Workflow:",
              `1. inspect_project({path: "${projectPath}"}) — current state.`,
              "2. list_asset_filters — discover relevant tags for this theme.",
              `3. list_asset_packs filtered by category if a relevant one exists.`,
              `4. search_assets({query: "${theme}", license: "CC0 (public domain)", limit: 30}) — show me a curated shortlist with previews, grouped by pack.`,
              "5. After I pick assets, for each one:",
              "   - get_asset_details to verify",
              `   - import_assets_into_project with backup:true${scene ? `, scope:"scene", scene:"${scene}"` : ""}`,
              "   - inspect_project briefly to confirm",
              "6. At the end, diff_projects between the original backup and the current state for a clean changelog.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        },
      ],
    }),
  );

  server.prompt(
    "safe-edit-flow",
    "Reminds the assistant of the safe edit flow (inspect → dryRun → apply → verify).",
    {
      projectPath: z
        .string()
        .describe("Absolute path to the GDevelop project file"),
      intent: z
        .string()
        .describe("What you want to change in natural language"),
    },
    ({ projectPath, intent }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `I want to make this change to my GDevelop project at ${projectPath}:`,
              "",
              `> ${intent}`,
              "",
              "Apply the safe edit flow strictly:",
              "1. inspect_project — current state.",
              "2. For any new object/behavior type involved, describe_object_schema or read_extension_source to confirm the exact properties.",
              "3. Build the edit_project payload, run with dryRun:true.",
              "4. Show me the validation result + summary.",
              "5. Wait for my OK, then run with dryRun:false, backup:true (default).",
              "6. inspect_project + diff_projects against the just-created backup to confirm what changed.",
              "7. If the result is not what I wanted, propose undo_last_edit.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
