import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { editProject } from "../src/core/edit.js";
import { minimalValidProject } from "./fixtures.js";

function makeTempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "efe-test-"));
  const path = join(dir, "game.json");
  writeFileSync(path, JSON.stringify(minimalValidProject(), null, 2), "utf-8");
  return path;
}

describe("custom extensions ops", () => {
  let projectPath: string;
  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it("creates an extension", async () => {
    const result = await editProject(
      projectPath,
      [
        {
          op: "add_extension",
          name: "MyTools",
          fullName: "My Tools",
          version: "1.0.0",
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(true);
    const after = JSON.parse(readFileSync(projectPath, "utf-8"));
    expect(after.eventsFunctionsExtensions).toHaveLength(1);
    expect(after.eventsFunctionsExtensions[0].name).toBe("MyTools");
  });

  it("refuses duplicate extension names", async () => {
    const result = await editProject(
      projectPath,
      [
        { op: "add_extension", name: "Dup" },
        { op: "add_extension", name: "Dup" },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(false);
    expect(result.failedAt?.error).toMatch(/already exists/);
  });

  it("creates an events-based object inside an extension and adds a function", async () => {
    await editProject(
      projectPath,
      [
        { op: "add_extension", name: "MyExt" },
        {
          op: "add_events_based_object",
          extension: "MyExt",
          name: "Coin",
          fullName: "Coin object",
          is3D: false,
        },
        {
          op: "add_extension_function",
          extension: "MyExt",
          parent: "object",
          parentName: "Coin",
          name: "Collect",
          functionType: "Action",
          fullName: "Collect coin",
          sentence: "Collect the _PARAM0_ coin",
        },
      ],
      { dryRun: false, backup: false },
    );
    const after = JSON.parse(readFileSync(projectPath, "utf-8"));
    const ext = after.eventsFunctionsExtensions[0];
    const ebo = ext.eventsBasedObjects[0];
    expect(ebo.name).toBe("Coin");
    expect(ebo.eventsFunctions[0].name).toBe("Collect");
  });

  it("creates an events-based behavior with a property", async () => {
    await editProject(
      projectPath,
      [
        { op: "add_extension", name: "BehExt" },
        {
          op: "add_events_based_behavior",
          extension: "BehExt",
          name: "Damageable",
          fullName: "Damageable",
          objectType: "",
        },
        {
          op: "add_extension_property",
          extension: "BehExt",
          parent: "behavior",
          parentName: "Damageable",
          property: { name: "Health", type: "number", value: "100" },
        },
      ],
      { dryRun: false, backup: false },
    );
    const after = JSON.parse(readFileSync(projectPath, "utf-8"));
    const ebb = after.eventsFunctionsExtensions[0].eventsBasedBehaviors[0];
    expect(ebb.name).toBe("Damageable");
    expect(ebb.propertyDescriptors[0]).toMatchObject({
      name: "Health",
      type: "number",
    });
  });
});
