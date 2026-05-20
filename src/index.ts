#!/usr/bin/env node
/**
 * gdevelop-mcp server entry point.
 *
 * Each tool family lives in `src/tools/<family>.ts` and exports a
 * `register*Tools(server)` function. Keep this file thin — see
 * `.claude/rules/file-size.md`.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerPrompts } from "./prompts.js";
import { registerInstallTools } from "./tools/install.js";
import { registerDiscoveryTools } from "./tools/discovery.js";
import { registerExtensionsTools } from "./tools/extensions.js";
import { registerCatalogTools } from "./tools/catalog.js";
import { registerEditingTools } from "./tools/editing.js";
import { registerSafetyTools } from "./tools/safety.js";
import { registerAssetsTools } from "./tools/assets.js";
import { registerExamplesTools } from "./tools/examples.js";
import { registerGithubTools } from "./tools/github.js";
import { registerPreviewTools } from "./tools/preview.js";

const server = new McpServer({
  name: "gdevelop-mcp",
  version: "0.17.0",
});

registerInstallTools(server);
registerDiscoveryTools(server);
registerExtensionsTools(server);
registerCatalogTools(server);
registerEditingTools(server);
registerSafetyTools(server);
registerAssetsTools(server);
registerExamplesTools(server);
registerGithubTools(server);
registerPreviewTools(server);
registerPrompts(server);

const transport = new StdioServerTransport();
await server.connect(transport);
