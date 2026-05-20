import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { editProject } from "../src/core/edit.js";
import { minimalValidProject } from "./fixtures.js";

function makeProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "misc-test-"));
  const path = join(dir, "game.json");
  const project = minimalValidProject() as Record<string, unknown>;
  (project.objects as unknown[]).push({
    name: "GlobalOrb",
    type: "Sprite",
    variables: [],
    behaviors: [],
    effects: [],
    tags: "",
    animations: [],
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
      animations: [],
    },
  ];
  writeFileSync(path, JSON.stringify(project, null, 2), "utf-8");
  return path;
}

describe("variables ops", () => {
  let path: string;
  beforeEach(() => {
    path = makeProject();
  });

  it("set_variable adds a project-scope variable", async () => {
    const result = await editProject(
      path,
      [
        {
          op: "set_variable",
          scope: "project",
          name: "score",
          type: "number",
          value: 100,
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(true);
    const after = JSON.parse(readFileSync(path, "utf-8"));
    expect(after.variables).toEqual([
      { name: "score", type: "number", value: "100" },
    ]);
  });

  it("set_variable updates an existing variable in place", async () => {
    await editProject(
      path,
      [
        {
          op: "set_variable",
          scope: "scene",
          scene: "MainScene",
          name: "lives",
          type: "number",
          value: 3,
        },
      ],
      { dryRun: false, backup: false },
    );
    const result = await editProject(
      path,
      [
        {
          op: "set_variable",
          scope: "scene",
          scene: "MainScene",
          name: "lives",
          type: "number",
          value: 5,
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(true);
    const after = JSON.parse(readFileSync(path, "utf-8"));
    expect(after.layouts[0].variables).toEqual([
      { name: "lives", type: "number", value: "5" },
    ]);
  });

  it("set_variable handles object-scene scope", async () => {
    const result = await editProject(
      path,
      [
        {
          op: "set_variable",
          scope: "object-scene",
          scene: "MainScene",
          objectName: "Hero",
          name: "hp",
          type: "number",
          value: 10,
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(true);
    const after = JSON.parse(readFileSync(path, "utf-8"));
    expect(after.layouts[0].objects[0].variables).toEqual([
      { name: "hp", type: "number", value: "10" },
    ]);
  });

  it("set_variable handles boolean values", async () => {
    await editProject(
      path,
      [
        {
          op: "set_variable",
          scope: "project",
          name: "isReady",
          type: "boolean",
          value: true,
        },
      ],
      { dryRun: false, backup: false },
    );
    const after = JSON.parse(readFileSync(path, "utf-8"));
    expect(after.variables[0]).toMatchObject({
      name: "isReady",
      type: "boolean",
      value: true,
    });
  });

  it("remove_variable removes a previously-set variable", async () => {
    await editProject(
      path,
      [
        {
          op: "set_variable",
          scope: "project",
          name: "tmp",
          type: "string",
          value: "x",
        },
      ],
      { dryRun: false, backup: false },
    );
    const result = await editProject(
      path,
      [{ op: "remove_variable", scope: "project", name: "tmp" }],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(true);
    const after = JSON.parse(readFileSync(path, "utf-8"));
    expect(after.variables).toEqual([]);
  });
});

describe("object groups ops", () => {
  let path: string;
  beforeEach(() => {
    path = makeProject();
  });

  it("add_object_group creates a scene-scoped group with initial members", async () => {
    const result = await editProject(
      path,
      [
        {
          op: "add_object_group",
          scope: "scene",
          scene: "MainScene",
          name: "Enemies",
          objects: ["Hero"],
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(true);
    const after = JSON.parse(readFileSync(path, "utf-8"));
    expect(after.layouts[0].objectsGroups).toEqual([
      { name: "Enemies", objects: [{ name: "Hero" }] },
    ]);
  });

  it("add_object_to_group appends to an existing group", async () => {
    await editProject(
      path,
      [
        {
          op: "add_object_group",
          scope: "scene",
          scene: "MainScene",
          name: "Player",
        },
      ],
      { dryRun: false, backup: false },
    );
    const result = await editProject(
      path,
      [
        {
          op: "add_object_to_group",
          scope: "scene",
          scene: "MainScene",
          group: "Player",
          objectName: "Hero",
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(true);
    const after = JSON.parse(readFileSync(path, "utf-8"));
    expect(after.layouts[0].objectsGroups[0].objects).toEqual([
      { name: "Hero" },
    ]);
  });

  it("remove_object_group deletes a group", async () => {
    await editProject(
      path,
      [
        {
          op: "add_object_group",
          scope: "scene",
          scene: "MainScene",
          name: "ToDelete",
        },
      ],
      { dryRun: false, backup: false },
    );
    const result = await editProject(
      path,
      [
        {
          op: "remove_object_group",
          scope: "scene",
          scene: "MainScene",
          name: "ToDelete",
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(true);
    const after = JSON.parse(readFileSync(path, "utf-8"));
    expect(after.layouts[0].objectsGroups).toEqual([]);
  });
});

describe("resources op", () => {
  let path: string;
  beforeEach(() => {
    path = makeProject();
  });

  it("add_resource registers a new image resource", async () => {
    const result = await editProject(
      path,
      [
        {
          op: "add_resource",
          name: "player-idle",
          file: "assets/player.png",
          kind: "image",
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(true);
    const after = JSON.parse(readFileSync(path, "utf-8"));
    expect(after.resources.resources).toHaveLength(1);
    expect(after.resources.resources[0]).toMatchObject({
      name: "player-idle",
      file: "assets/player.png",
      kind: "image",
    });
  });

  it("add_resource refuses to add a duplicate name", async () => {
    await editProject(
      path,
      [
        {
          op: "add_resource",
          name: "shared",
          file: "a.png",
          kind: "image",
        },
      ],
      { dryRun: false, backup: false },
    );
    const result = await editProject(
      path,
      [
        {
          op: "add_resource",
          name: "shared",
          file: "b.png",
          kind: "image",
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(false);
    expect(result.failedAt?.error).toMatch(/already exists/);
  });
});

describe("externals ops", () => {
  let path: string;
  beforeEach(() => {
    path = makeProject();
  });

  it("add_external_events adds a new external events block", async () => {
    const result = await editProject(
      path,
      [
        {
          op: "add_external_events",
          name: "GlobalControls",
          associatedScene: "MainScene",
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(true);
    const after = JSON.parse(readFileSync(path, "utf-8"));
    expect(after.externalEvents).toHaveLength(1);
    expect(after.externalEvents[0]).toMatchObject({
      name: "GlobalControls",
      associatedScene: "MainScene",
    });
  });

  it("add_external_layout adds a new external layout", async () => {
    const result = await editProject(
      path,
      [{ op: "add_external_layout", name: "BossArea" }],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(true);
    const after = JSON.parse(readFileSync(path, "utf-8"));
    expect(after.externalLayouts).toHaveLength(1);
    expect(after.externalLayouts[0].name).toBe("BossArea");
  });
});
