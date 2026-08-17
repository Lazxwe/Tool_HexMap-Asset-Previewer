import { describe, it, expect } from "vitest";
import { TerrainId } from "../../../src/domain/terrain/TerrainId";

describe("TerrainId", () => {
  it("should create valid TerrainId instances", () => {
    const id = new TerrainId("grass");
    expect(id.value).toBe("grass");
    expect(id.toString()).toBe("grass");
    expect(id.toJSON()).toBe("grass");
  });

  it("should trim surrounding whitespace", () => {
    const id = new TerrainId("  mountain  ");
    expect(id.value).toBe("mountain");
  });

  it("should reject empty, whitespace-only, or non-string values", () => {
    expect(() => new TerrainId("")).toThrow();
    expect(() => new TerrainId("   ")).toThrow();
    // @ts-expect-error - testing runtime type defense
    expect(() => new TerrainId(123)).toThrow();
    // @ts-expect-error - testing runtime type defense
    expect(() => new TerrainId(null)).toThrow();
  });

  it("should be immutable", () => {
    const id = new TerrainId("water");
    expect(Object.isFrozen(id)).toBe(true);
    // @ts-expect-error - testing runtime immutability
    expect(() => { id.value = "lava"; }).toThrow();
  });

  it("should verify value equality against TerrainId instances and strings", () => {
    const id1 = new TerrainId("forest");
    const id2 = new TerrainId("forest");
    const id3 = new TerrainId("desert");

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals("forest")).toBe(true);
    expect(id1.equals(id3)).toBe(false);
    expect(id1.equals("desert")).toBe(false);
    expect(id1.equals(null)).toBe(false);
    expect(id1.equals(undefined)).toBe(false);

    expect(TerrainId.equals(id1, id2)).toBe(true);
    expect(TerrainId.equals(id1, "forest")).toBe(true);
    expect(TerrainId.equals(id1, id3)).toBe(false);
    expect(TerrainId.equals(null, null)).toBe(true);
    expect(TerrainId.equals(id1, null)).toBe(false);
  });
});
