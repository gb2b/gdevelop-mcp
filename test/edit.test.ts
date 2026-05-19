import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { editProject } from "../src/core/edit.js";
import { minimalValidProject } from "./fixtures.js";

function makeTempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "edit-test-"));
  const path = join(dir, "game.json");
  writeFileSync(path, JSON.stringify(minimalValidProject(), null, 2), "utf-8");
  return path;
}

describe("editProject", () => {
  let projectPath: string;
  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it("applies add_layout in dryRun without modifying the file", async () => {
    const before = readFileSync(projectPath, "utf-8");
    const result = await editProject(
      projectPath,
      [{ op: "add_layout", name: "Level1" }],
      { dryRun: true },
    );
    expect(result.applied).toBe(1);
    expect(result.written).toBe(false);
    expect(result.validation.valid).toBe(true);
    expect(readFileSync(projectPath, "utf-8")).toBe(before);
  });

  it("writes changes when dryRun is false and creates a backup", async () => {
    const result = await editProject(
      projectPath,
      [
        { op: "add_layout", name: "Level1" },
        {
          op: "add_object",
          scope: "scene",
          scene: "Level1",
          type: "Sprite",
          name: "Hero",
        },
      ],
      { dryRun: false, backup: true },
    );
    expect(result.written).toBe(true);
    expect(result.applied).toBe(2);
    expect(result.backupPath).toBeDefined();
    expect(existsSync(result.backupPath!)).toBe(true);

    const after = JSON.parse(readFileSync(projectPath, "utf-8"));
    expect(after.layouts).toHaveLength(2);
    expect(after.layouts[1].objects[0].name).toBe("Hero");
  });

  it("is atomic: a failing op leaves the file untouched", async () => {
    const before = readFileSync(projectPath, "utf-8");
    const result = await editProject(
      projectPath,
      [
        { op: "add_layout", name: "Level1" },
        {
          op: "add_object",
          scope: "scene",
          scene: "Nonexistent",
          type: "Sprite",
          name: "Hero",
        },
      ],
      { dryRun: false },
    );
    expect(result.written).toBe(false);
    expect(result.failedAt).toBeDefined();
    expect(result.failedAt?.index).toBe(1);
    expect(readFileSync(projectPath, "utf-8")).toBe(before);
  });

  it("attaches a behavior to an existing object", async () => {
    const result = await editProject(
      projectPath,
      [
        { op: "add_layout", name: "Level1" },
        {
          op: "add_object",
          scope: "scene",
          scene: "Level1",
          type: "Sprite",
          name: "Hero",
        },
        {
          op: "attach_behavior",
          scope: "scene",
          scene: "Level1",
          objectName: "Hero",
          type: "PlatformBehavior::PlatformerObjectBehavior",
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.applied).toBe(3);
    const after = JSON.parse(readFileSync(projectPath, "utf-8"));
    const hero = after.layouts[1].objects[0];
    expect(hero.behaviors).toHaveLength(1);
    expect(hero.behaviors[0].type).toBe(
      "PlatformBehavior::PlatformerObjectBehavior",
    );
  });

  it("places instances with persistentUuid", async () => {
    const result = await editProject(
      projectPath,
      [
        { op: "add_layout", name: "Level1" },
        {
          op: "add_object",
          scope: "scene",
          scene: "Level1",
          type: "Sprite",
          name: "Hero",
        },
        {
          op: "add_instance",
          scene: "Level1",
          objectName: "Hero",
          x: 100,
          y: 200,
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.applied).toBe(3);
    const after = JSON.parse(readFileSync(projectPath, "utf-8"));
    const inst = after.layouts[1].instances[0];
    expect(inst.x).toBe(100);
    expect(inst.y).toBe(200);
    expect(typeof inst.persistentUuid).toBe("string");
    expect(inst.persistentUuid.length).toBeGreaterThan(0);
  });
});
