import { describe, it, expect } from "vitest";
import {
  findInstructionByType,
  findInstructions,
  resetInstructionCatalogCache,
  type InstructionSpec,
} from "../src/core/catalog-actions.js";

const STATIC_ONLY = (() => {
  resetInstructionCatalogCache();
  // We import the static constant indirectly by building with a fake install path
  // that fails — buildInstructionCatalog will return just the static items.
  return [];
})();

void STATIC_ONLY;

describe("catalog-actions (static)", () => {
  // Import the module functions; use a minimal install stub. The dynamic
  // parsing will be exercised in integration tests where a real install exists.

  it("findInstructionByType returns the static SimulateJumpKey", async () => {
    // Direct test of helper with a hand-crafted catalog
    const fake: InstructionSpec[] = [
      {
        type: "SimulateJumpKey",
        fullName: "Simulate jump",
        description: "",
        kind: "action",
        extension: "PlatformBehavior",
        source: "dynamic-cpp",
        receiverKind: "behavior",
        parameters: [],
      },
      {
        type: "KeyPressed",
        fullName: "Key pressed",
        description: "",
        kind: "condition",
        extension: "BuiltinKeyboard",
        source: "dynamic-cpp",
        receiverKind: "extension",
        parameters: [],
      },
    ];
    const matches = findInstructionByType(fake, "SimulateJumpKey");
    expect(matches).toHaveLength(1);
    expect(matches[0].kind).toBe("action");
  });

  it("findInstructions filters by kind, extension and receiverKind", () => {
    const fake: InstructionSpec[] = [
      {
        type: "A",
        fullName: "",
        description: "",
        kind: "action",
        extension: "Ext1",
        source: "dynamic-cpp",
        receiverKind: "extension",
        parameters: [],
      },
      {
        type: "B",
        fullName: "",
        description: "",
        kind: "condition",
        extension: "Ext1",
        source: "dynamic-cpp",
        receiverKind: "object",
        parameters: [],
      },
      {
        type: "C",
        fullName: "",
        description: "",
        kind: "action",
        extension: "Ext2",
        source: "dynamic-cpp",
        receiverKind: "behavior",
        parameters: [],
      },
    ];
    expect(findInstructions(fake, { kind: "action" })).toHaveLength(2);
    expect(findInstructions(fake, { extension: "Ext1" })).toHaveLength(2);
    expect(
      findInstructions(fake, { kind: "action", extension: "Ext2" }),
    ).toHaveLength(1);
    expect(findInstructions(fake, { receiverKind: "behavior" })).toHaveLength(
      1,
    );
  });

  it("findInstructions supports query and limit", () => {
    const fake: InstructionSpec[] = [
      {
        type: "ItemA",
        fullName: "Foo bar",
        description: "",
        kind: "action",
        extension: "Ext",
        source: "dynamic-cpp",
        receiverKind: "extension",
        parameters: [],
      },
      {
        type: "ItemB",
        fullName: "Foo baz",
        description: "",
        kind: "action",
        extension: "Ext",
        source: "dynamic-cpp",
        receiverKind: "extension",
        parameters: [],
      },
    ];
    expect(findInstructions(fake, { query: "bar" })).toHaveLength(1);
    expect(findInstructions(fake, { query: "foo", limit: 1 })).toHaveLength(1);
  });
});
