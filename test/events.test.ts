import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { editProject } from "../src/core/edit.js";
import { summarizeEvents } from "../src/core/events.js";
import { minimalValidProject } from "./fixtures.js";

function makeTempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "events-test-"));
  const path = join(dir, "game.json");
  writeFileSync(path, JSON.stringify(minimalValidProject(), null, 2), "utf-8");
  return path;
}

describe("add_event op", () => {
  let projectPath: string;
  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it("appends a standard event to the scene root", async () => {
    const result = await editProject(
      projectPath,
      [
        {
          op: "add_event",
          scene: "MainScene",
          event: {
            type: "BuiltinCommonInstructions::Standard",
            conditions: [
              { type: { value: "KeyPressed" }, parameters: ["", "Space"] },
            ],
            actions: [
              {
                type: { value: "SimulateJumpKey" },
                parameters: ["Player", "PlatformerObject"],
              },
            ],
          },
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(true);
    const after = JSON.parse(readFileSync(projectPath, "utf-8"));
    expect(after.layouts[0].events).toHaveLength(1);
    expect(after.layouts[0].events[0].actions[0].type.value).toBe(
      "SimulateJumpKey",
    );
  });

  it("nests events under a Group via parentPath", async () => {
    await editProject(
      projectPath,
      [
        {
          op: "add_event",
          scene: "MainScene",
          event: {
            type: "BuiltinCommonInstructions::Group",
            name: "Player logic",
            events: [],
          },
        },
        {
          op: "add_event",
          scene: "MainScene",
          parentPath: [0],
          event: {
            type: "BuiltinCommonInstructions::Comment",
            comment: "Handle input",
          },
        },
      ],
      { dryRun: false, backup: false },
    );
    const after = JSON.parse(readFileSync(projectPath, "utf-8"));
    expect(after.layouts[0].events[0].type).toBe(
      "BuiltinCommonInstructions::Group",
    );
    expect(after.layouts[0].events[0].events[0].comment).toBe("Handle input");
  });

  it("refuses to nest under an event type that can't have sub-events", async () => {
    const result = await editProject(
      projectPath,
      [
        {
          op: "add_event",
          scene: "MainScene",
          event: {
            type: "BuiltinCommonInstructions::Comment",
            comment: "no children allowed",
          },
        },
        {
          op: "add_event",
          scene: "MainScene",
          parentPath: [0],
          event: {
            type: "BuiltinCommonInstructions::Standard",
            actions: [],
          },
        },
      ],
      { dryRun: false, backup: false },
    );
    expect(result.written).toBe(false);
    expect(result.failedAt?.error).toMatch(/cannot contain sub-events/);
  });

  it("supports prepend and numeric position", async () => {
    await editProject(
      projectPath,
      [
        {
          op: "add_event",
          scene: "MainScene",
          event: {
            type: "BuiltinCommonInstructions::Comment",
            comment: "A",
          },
        },
        {
          op: "add_event",
          scene: "MainScene",
          event: {
            type: "BuiltinCommonInstructions::Comment",
            comment: "B",
          },
        },
        {
          op: "add_event",
          scene: "MainScene",
          position: "prepend",
          event: {
            type: "BuiltinCommonInstructions::Comment",
            comment: "Z",
          },
        },
      ],
      { dryRun: false, backup: false },
    );
    const after = JSON.parse(readFileSync(projectPath, "utf-8"));
    expect(
      after.layouts[0].events.map((e: { comment: string }) => e.comment),
    ).toEqual(["Z", "A", "B"]);
  });
});

describe("remove_event op", () => {
  let projectPath: string;
  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it("removes an event by path", async () => {
    await editProject(
      projectPath,
      [
        {
          op: "add_event",
          scene: "MainScene",
          event: {
            type: "BuiltinCommonInstructions::Comment",
            comment: "remove me",
          },
        },
        { op: "remove_event", scene: "MainScene", path: [0] },
      ],
      { dryRun: false, backup: false },
    );
    const after = JSON.parse(readFileSync(projectPath, "utf-8"));
    expect(after.layouts[0].events).toHaveLength(0);
  });
});

describe("summarizeEvents", () => {
  it("counts events and nesting depth", () => {
    const events = [
      { type: "A" },
      {
        type: "Group",
        events: [
          { type: "Standard" },
          { type: "Standard", events: [{ type: "Comment" }] },
        ],
      },
    ];
    const s = summarizeEvents(events);
    expect(s.total).toBe(5);
    expect(s.maxDepth).toBe(3);
    expect(s.byType.Standard).toBe(2);
  });
});
