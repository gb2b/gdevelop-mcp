import { describe, it, expect } from "vitest";
import {
  OBJECT_TYPES,
  BEHAVIOR_TYPES,
  findObjectType,
  findBehaviorType,
} from "../src/core/catalog-static.js";

describe("static catalog", () => {
  it("contains at least the common object types", () => {
    const types = OBJECT_TYPES.map((o) => o.type);
    expect(types).toContain("Sprite");
    expect(types).toContain("TextObject::Text");
    expect(types).toContain("TiledSpriteObject::TiledSprite");
  });

  it("contains at least the common behavior types", () => {
    const types = BEHAVIOR_TYPES.map((b) => b.type);
    expect(types).toContain("PlatformBehavior::PlatformerObjectBehavior");
    expect(types).toContain("Tween::TweenBehavior");
  });

  it("findObjectType resolves Sprite", () => {
    const info = findObjectType("Sprite");
    expect(info).toBeDefined();
    expect(info?.extension).toBe("Sprite");
  });

  it("findObjectType returns undefined for unknown type", () => {
    expect(findObjectType("Not::Real")).toBeUndefined();
  });

  it("findBehaviorType resolves Platformer", () => {
    const info = findBehaviorType("PlatformBehavior::PlatformerObjectBehavior");
    expect(info).toBeDefined();
    expect(info?.extension).toBe("PlatformBehavior");
  });
});
