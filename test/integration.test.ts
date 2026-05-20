/**
 * Integration tests — exercise the cache + parser + edit + diff pipeline
 * with a real on-disk cache. Skipped by default in CI (set
 * GDEVELOP_MCP_INTEGRATION=1 to run). The cache must already exist —
 * run `sync_gdevelop_sources` once before this passes locally.
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { quickStartTemplate } from "../src/core/templates.js";
import { editProject } from "../src/core/edit.js";
import { diffProjects } from "../src/core/diff.js";
import { validateProjectData } from "../src/core/validation.js";
import { listProjectDependencies } from "../src/core/project-introspect.js";

const SHOULD_RUN = process.env.GDEVELOP_MCP_INTEGRATION === "1";
const CACHE_PRESENT = existsSync(
  join(homedir(), ".cache", "gdevelop-mcp", "manifest.json"),
);

(SHOULD_RUN && CACHE_PRESENT ? describe : describe.skip)(
  "integration: template → edit → diff",
  () => {
    it("scaffolds a platformer, adds a Coin, diffs against backup", async () => {
      const dir = mkdtempSync(join(tmpdir(), "integration-"));
      const path = join(dir, "game.json");

      const scaffold = quickStartTemplate({
        targetPath: path,
        name: "integration test",
        genre: "platformer",
      });
      expect(scaffold.objects).toEqual(["Player", "Ground"]);

      const beforeContent = readFileSync(path, "utf-8");
      const beforePath = join(dir, "before.json");
      writeFileSync(beforePath, beforeContent, "utf-8");

      const result = await editProject(
        path,
        [
          {
            op: "add_object",
            scope: "scene",
            scene: "Level1",
            type: "Sprite",
            name: "Coin",
          },
          {
            op: "add_instance",
            scene: "Level1",
            objectName: "Coin",
            x: 200,
            y: 300,
          },
          {
            op: "add_instance",
            scene: "Level1",
            objectName: "Coin",
            x: 400,
            y: 300,
          },
        ],
        { dryRun: false, backup: false },
      );
      expect(result.written).toBe(true);
      expect(result.applied).toBe(3);

      const after = JSON.parse(readFileSync(path, "utf-8"));
      expect(validateProjectData(after).valid).toBe(true);

      const diff = diffProjects(beforePath, path);
      expect(diff.identical).toBe(false);
      const level1Diff = diff.layoutsModified.find((l) => l.name === "Level1");
      expect(level1Diff).toBeDefined();
      expect(level1Diff!.objectsAdded).toContain("Coin");
      expect(level1Diff!.instancesAfter - level1Diff!.instancesBefore).toBe(2);

      const deps = listProjectDependencies(path);
      expect(deps.objectTypes).toContain("Sprite");
      expect(deps.behaviorTypes).toContain(
        "PlatformBehavior::PlatformerObjectBehavior",
      );
      expect(deps.scenes).toContain("Level1");
    });
  },
);

if (!SHOULD_RUN || !CACHE_PRESENT) {
  describe("integration", () => {
    it("is skipped — set GDEVELOP_MCP_INTEGRATION=1 and ensure the cache exists", () => {
      expect(true).toBe(true);
    });
  });
}
