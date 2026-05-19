/**
 * Static architectural overview of GDevelop for orientation.
 * Kept short on purpose: the goal is to point the agent toward the
 * relevant pieces of the GitHub-synced cache for deeper queries.
 */
export const GDEVELOP_OVERVIEW = `# GDevelop Architecture (orientation for agents)

Source of truth: \`4ian/GDevelop\` GitHub repo, mirrored into ~/.cache/gdevelop-mcp/ref-<ref>/
by \`sync_gdevelop_sources\`. Everything below is RELATIVE to that cache root.

## High-level layout

- **Core/** — C++ core ("GDCore"). Schemas and metadata that bridge to JS via WASM.
  - \`Core/GDCore/Project/\` — Object, Layout, Layer, Variable, Resource, Behavior,
    EventsFunctionsExtension, Project — the canonical types of a game project.
  - \`Core/GDCore/Events/Builtin/\` — built-in event types (Standard, ForEach,
    Comment, Group, Repeat, While, Link, JsCode).
  - \`Core/GDCore/Extensions/Builtin/\` — built-in actions/conditions/expressions
    (audio, scene, time, variables, mouse, keyboard, object base, etc.).
- **Extensions/** — non-builtin extensions.
  - C++ extensions (\`Extension.cpp\`): Sprite, PlatformBehavior, Physics2/3,
    PathfindingBehavior, TopDownMovementBehavior, etc.
  - JS extensions (\`JsExtension.js\` + \`*.ts\`): Lighting, Multiplayer, P2P,
    BBText, BitmapText, TileMap, Effects, DialogueTree, etc.
  - Per-extension TS runtime objects/behaviors live alongside (e.g.
    \`textruntimeobject.ts\`).
- **GDJS/Runtime/** — the JS game engine that runs exported games (PixiJS,
  audio, input, debugger client, etc.).
- **GDJS/Runtime/types/** — TypeScript declarations for the project JSON
  schema (project-data.d.ts, save-state.d.ts, etc.).

## Project file (\`game.json\`)

Top-level fields: \`firstLayout\`, \`gdVersion\`, \`properties\`, \`resources\`,
\`objects\` (globals), \`variables\`, \`layouts\` (scenes), \`externalLayouts\`,
\`eventsFunctionsExtensions\`, \`externalEvents\`.

A Layout (scene) contains: objects (scene-local), instances (placed),
variables, layers (with cameras, effects, lighting), events (the gameplay
logic tree), behaviorsSharedData.

## Events (the gameplay tree)

Event tree at \`layout.events\`. Each node has a \`type\` discriminator:
- \`BuiltinCommonInstructions::Standard\` — conditions + actions + optional sub-events
- \`Comment\`, \`Group\` — organization
- \`ForEach\`, \`Repeat\`, \`While\` — loops
- \`Link\` — reference external events
- \`JsCode\` — raw JS

An instruction (condition or action) has \`{ type: { value: "<Name>", inverted? }, parameters: string[] }\`.
The \`type.value\` matches a name registered via \`AddAction\` / \`AddCondition\` /
\`AddExpression\` in some \`Extension.cpp\` or \`JsExtension.js\`.

## Where to look — quick map

| Want to understand… | Look here |
|---|---|
| How a project is shaped | \`GDJS/Runtime/types/project-data.d.ts\` (635 lines, all types) |
| All built-in actions / conditions | \`Core/GDCore/Extensions/Builtin/*Extension.cpp\` |
| All extension actions / conditions | \`Extensions/<Name>/Extension.cpp\` (C++) or \`Extensions/<Name>/JsExtension.js\` (JS) |
| Runtime behavior of an object | \`Extensions/<Name>/*runtimeobject.ts\` |
| Runtime behavior of a behavior | \`Extensions/<Name>/*runtimebehavior.ts\` |
| Event types | \`Core/GDCore/Events/Builtin/*.cpp\` and \`*.h\` |
| Resource types | \`Core/GDCore/Project/*Resource.h\` |
| Variable types | \`Core/GDCore/Project/Variable.h\` (enum Type) |
| The game engine itself | \`GDJS/Runtime/runtimegame.ts\`, \`runtimescene.ts\`, \`pixi-renderers/\` |

## Use these MCP tools to drill in

- \`search_gdevelop_code(query)\` — regex grep over the cache. Fast, returns paths + line numbers.
- \`read_github_source(path)\` — read a specific file (uses cache when possible).
- \`list_extensions\` / \`list_object_types\` / \`list_behavior_types\` — known catalogs.
- \`describe_object_schema(type)\` / \`describe_instruction(type)\` — typed details.
- \`list_event_types\` / \`list_resource_types\` / \`list_variable_types\` — feature inventories.
- \`describe_extension(name)\` — everything an extension declares (objects, behaviors, instructions).
- \`validate_project(path)\` — structural and cross-reference validation.

For runtime preview, see \`preview_scene\` (uses gdexporter + Chromium).
For fast static layout previews, see \`render_scene_static\`.
`;
