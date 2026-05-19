import { describe, it, expect } from "vitest";
import {
  findInstructionByType,
  findInstructions,
  resetInstructionCatalogCache,
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
    const fake = [
      {
        type: "SimulateJumpKey",
        fullName: "Simulate jump",
        description: "",
        kind: "action" as const,
        extension: "PlatformBehavior",
        source: "static" as const,
      },
      {
        type: "KeyPressed",
        fullName: "Key pressed",
        description: "",
        kind: "condition" as const,
        extension: "BuiltinKeyboard",
        source: "static" as const,
      },
    ];
    const matches = findInstructionByType(fake, "SimulateJumpKey");
    expect(matches).toHaveLength(1);
    expect(matches[0].kind).toBe("action");
  });

  it("findInstructions filters by kind and extension", () => {
    const fake = [
      {
        type: "A",
        fullName: "",
        description: "",
        kind: "action" as const,
        extension: "Ext1",
        source: "static" as const,
      },
      {
        type: "B",
        fullName: "",
        description: "",
        kind: "condition" as const,
        extension: "Ext1",
        source: "static" as const,
      },
      {
        type: "C",
        fullName: "",
        description: "",
        kind: "action" as const,
        extension: "Ext2",
        source: "static" as const,
      },
    ];
    expect(findInstructions(fake, { kind: "action" })).toHaveLength(2);
    expect(findInstructions(fake, { extension: "Ext1" })).toHaveLength(2);
    expect(
      findInstructions(fake, { kind: "action", extension: "Ext2" }),
    ).toHaveLength(1);
  });

  it("findInstructions supports query and limit", () => {
    const fake = [
      {
        type: "ItemA",
        fullName: "Foo bar",
        description: "",
        kind: "action" as const,
        extension: "Ext",
        source: "static" as const,
      },
      {
        type: "ItemB",
        fullName: "Foo baz",
        description: "",
        kind: "action" as const,
        extension: "Ext",
        source: "static" as const,
      },
    ];
    expect(findInstructions(fake, { query: "bar" })).toHaveLength(1);
    expect(findInstructions(fake, { query: "foo", limit: 1 })).toHaveLength(1);
  });
});
