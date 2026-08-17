import { describe, it, expect } from "vitest";
import { AssetId } from "../../../src/domain/asset/AssetId";

describe("AssetId", () => {
  it("should construct valid AssetId instances", () => {
    const id = new AssetId("forest_01");
    expect(id.value).toBe("forest_01");
    expect(id.toString()).toBe("forest_01");
    expect(id.toJSON()).toBe("forest_01");
  });

  it("should trim surrounding whitespace", () => {
    const id = new AssetId("  mountain_top_02  ");
    expect(id.value).toBe("mountain_top_02");
  });

  it("should reject empty, whitespace-only, or non-string values", () => {
    expect(() => new AssetId("")).toThrow();
    expect(() => new AssetId("   ")).toThrow();
    // @ts-expect-error - testing runtime type defense
    expect(() => new AssetId(123)).toThrow();
    // @ts-expect-error - testing runtime type defense
    expect(() => new AssetId(null)).toThrow();
  });

  it("should be immutable", () => {
    const id = new AssetId("grass_01");
    expect(Object.isFrozen(id)).toBe(true);
    // @ts-expect-error - testing runtime immutability
    expect(() => { id.value = "lava_01"; }).toThrow();
  });

  it("should verify value equality against AssetId instances and strings", () => {
    const id1 = new AssetId("tree_01");
    const id2 = new AssetId("tree_01");
    const id3 = new AssetId("tree_02");

    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals("tree_01")).toBe(true);
    expect(id1.equals(id3)).toBe(false);
    expect(id1.equals("tree_02")).toBe(false);
    expect(id1.equals(null)).toBe(false);
    expect(id1.equals(undefined)).toBe(false);

    expect(AssetId.equals(id1, id2)).toBe(true);
    expect(AssetId.equals(id1, "tree_01")).toBe(true);
    expect(AssetId.equals(id1, id3)).toBe(false);
    expect(AssetId.equals(null, null)).toBe(true);
    expect(AssetId.equals(id1, null)).toBe(false);
  });
});
