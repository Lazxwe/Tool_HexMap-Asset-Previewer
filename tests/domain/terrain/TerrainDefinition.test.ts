import { describe, it, expect } from "vitest";
import { TerrainDefinition } from "../../../src/domain/terrain/TerrainDefinition";
import { TerrainId } from "../../../src/domain/terrain/TerrainId";

describe("TerrainDefinition", () => {
  it("should construct with valid id and displayName", () => {
    const def = new TerrainDefinition({
      id: "grass",
      displayName: "Plains Grass",
    });

    expect(def.id.value).toBe("grass");
    expect(def.displayName).toBe("Plains Grass");
    expect(Object.isFrozen(def)).toBe(true);
  });

  it("should accept TerrainId instance or string for id", () => {
    const idObj = new TerrainId("forest");
    const def = new TerrainDefinition({
      id: idObj,
      displayName: "Deep Forest",
    });

    expect(def.id).toBe(idObj);
    expect(def.displayName).toBe("Deep Forest");
  });

  it("should explicitly NOT contain weight property", () => {
    const def = new TerrainDefinition({
      id: "water",
      displayName: "Water",
    });

    // @ts-expect-error - testing that weight is not defined on TerrainDefinition
    expect(def.weight).toBeUndefined();
  });

  it("should reject empty or whitespace-only display names", () => {
    expect(() => new TerrainDefinition({ id: "t1", displayName: "" })).toThrow();
    expect(() => new TerrainDefinition({ id: "t2", displayName: "   " })).toThrow();
  });

  it("should reject invalid TerrainId values", () => {
    expect(() => new TerrainDefinition({ id: "", displayName: "Valid Name" })).toThrow();
    expect(() => new TerrainDefinition({ id: "   ", displayName: "Valid Name" })).toThrow();
  });

  it("should support immutable updates via withDisplayName", () => {
    const original = new TerrainDefinition({ id: "mountain", displayName: "Rocky Mountain" });
    const updatedName = original.withDisplayName("Snow Peak");

    expect(original.displayName).toBe("Rocky Mountain");
    expect(updatedName.displayName).toBe("Snow Peak");
    expect(updatedName.id.value).toBe("mountain");
  });
});
