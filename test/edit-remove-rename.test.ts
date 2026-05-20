import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { editProject } from "../src/core/edit.js";
import { minimalValidProject } from "./fixtures.js";

function makeProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "rmrn-test-"));
  const path = join(dir, "game.json");
  // Seed with one global Sprite + one scene Sprite + one instance of each.
  const project = minimalValidProject() as Record<string, unknown>;
  (project.objects as unknown[]).push({
    name: "GlobalOrb",
    type: "Sprite",
    variables: [],
    behaviors: [],
    effects: [],
    tags: "",
  });
  const layout = (project.layouts as Array<Record<string, unknown>>)[0];
  layout.objects = [
    {
      name: "Hero",
      type: "Sprite",
      variables: [],
      behaviors: [],
      effects: [],
      tags: "",
    },
  ];
  layout.instances = [
    {
      name: "Hero",
      x: 10,
      y: 20,
      angle: 0,
      customSize: false,
      height: 0,
      layer: "",
      locked: false,
      persistentUuid: "11111111-1111-1111-1111-111111111111",
      width: 0,
      zOrder: 1,
      numberProperties: [],
      stringProperties: [],
      initialVariables: [],
    },
    {
      name: "GlobalOrb",
      x: 50,
      y: 50,
      angle: 0,
      customSize: false,
      height: 0,
      layer: "",
      locked: false,
      persistentUuid: "22222222-2222-2222-2222-222222222222",
      width: 0,
      zOrder: 1,
      numberProperties: [],
      stringProperties: [],
      initialVariables: [],
    },
  ];
  writeFileSync(path, JSON.stringify(project, null, 2), "utf-8");
  return path;
}

describe("remove ops", () => {
  let path: string;
  beforeEach(() => {
    path = makeProject();
  });

  it("remove_layout removes a layout and reassigns firstLayout", async () => {
    // Add a second layout, then remove the first one and verify firstLayout
    // is reassigned.
    await editProject(path, [{ op: "add_layout", name: "Level2" }], {
      dryRun: false,
      backup: false,
    });
    const result = await editProject(
      path,
      [{ op: "remove_layout", name: "MainScene" }],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(true);
    const after = JSON.parse(readFileSync(path, "utf-8"));
    expect(after.firstLayout).toBe("Level2");
    expect(after.layouts).toHaveLength(1);
  });

  it("remove_object cascade removes instances", async () => {
    const result = await editProject(
      path,
      [
        {
          op: "remove_object",
          scope: "scene",
          scene: "MainScene",
          name: "Hero",
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(true);
    const after = JSON.parse(readFileSync(path, "utf-8"));
    expect(
      after.layouts[0].objects.find((o: { name: string }) => o.name === "Hero"),
    ).toBeUndefined();
    expect(
      after.layouts[0].instances.find(
        (i: { name: string }) => i.name === "Hero",
      ),
    ).toBeUndefined();
  });

  it("remove_object with cascadeInstances:false refuses when instances exist", async () => {
    const result = await editProject(
      path,
      [
        {
          op: "remove_object",
          scope: "scene",
          scene: "MainScene",
          name: "Hero",
          cascadeInstances: false,
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(false);
    expect(result.failedAt?.error).toMatch(/instances exist/);
  });

  it("remove_instance by persistentUuid", async () => {
    const result = await editProject(
      path,
      [
        {
          op: "remove_instance",
          scene: "MainScene",
          persistentUuid: "11111111-1111-1111-1111-111111111111",
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(true);
    const after = JSON.parse(readFileSync(path, "utf-8"));
    expect(after.layouts[0].instances).toHaveLength(1);
    expect(after.layouts[0].instances[0].name).toBe("GlobalOrb");
  });

  it("rename_object propagates to instances", async () => {
    const result = await editProject(
      path,
      [
        {
          op: "rename_object",
          scope: "scene",
          scene: "MainScene",
          oldName: "Hero",
          newName: "Champion",
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(true);
    const after = JSON.parse(readFileSync(path, "utf-8"));
    expect(after.layouts[0].objects[0].name).toBe("Champion");
    expect(after.layouts[0].instances[0].name).toBe("Champion");
    // Other instance untouched
    expect(after.layouts[0].instances[1].name).toBe("GlobalOrb");
  });

  it("set_object_property writes via dot-path", async () => {
    const result = await editProject(
      path,
      [
        {
          op: "set_object_property",
          scope: "scene",
          scene: "MainScene",
          objectName: "Hero",
          path: "tags",
          value: "controllable,player",
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(true);
    const after = JSON.parse(readFileSync(path, "utf-8"));
    expect(after.layouts[0].objects[0].tags).toBe("controllable,player");
  });

  it("set_object_property creates intermediate objects on the dot-path", async () => {
    const result = await editProject(
      path,
      [
        {
          op: "set_object_property",
          scope: "scene",
          scene: "MainScene",
          objectName: "Hero",
          path: "content.text",
          value: "hello",
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(true);
    const after = JSON.parse(readFileSync(path, "utf-8"));
    expect(after.layouts[0].objects[0].content.text).toBe("hello");
  });
});
