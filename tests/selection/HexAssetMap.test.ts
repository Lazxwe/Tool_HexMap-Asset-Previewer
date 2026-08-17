import { describe, it, expect } from "vitest";
import { AssetId } from "../../src/domain/asset/AssetId";
import { HexCoordinate } from "../../src/domain/hex/HexCoordinate";
import { HexAssetMap } from "../../src/selection/HexAssetMap";

describe("HexAssetMap", () => {
  it("should initialize with size 0 and handle set, get, has, delete", () => {
    const map = new HexAssetMap();
    const c1 = new HexCoordinate(0, 0);
    const c2 = new HexCoordinate(1, 2);
    const a1 = new AssetId("forest_01");

    expect(map.size).toBe(0);
    expect(map.has(c1)).toBe(false);
    expect(map.get(c1)).toBeUndefined();

    map.set(c1, a1);
    expect(map.size).toBe(1);
    expect(map.has(c1)).toBe(true);
    expect(map.get(c1)?.value).toBe("forest_01");

    // Overwrite
    map.set(c1, "forest_02");
    expect(map.size).toBe(1);
    expect(map.get(c1)?.value).toBe("forest_02");

    // Delete
    expect(map.delete(c1)).toBe(true);
    expect(map.size).toBe(0);
    expect(map.has(c1)).toBe(false);
    expect(map.delete(c2)).toBe(false);
  });

  it("should handle negative coordinates seamlessly", () => {
    const map = new HexAssetMap();
    const neg = new HexCoordinate(-3, -5);
    map.set(neg, "mountain_01");

    expect(map.has(neg)).toBe(true);
    expect(map.get(neg)?.value).toBe("mountain_01");
  });

  it("should return entries in deterministic (col ascending, row ascending) order", () => {
    const map = new HexAssetMap();
    map.set(new HexCoordinate(2, 3), "a1");
    map.set(new HexCoordinate(-1, 5), "a2");
    map.set(new HexCoordinate(0, 0), "a3");
    map.set(new HexCoordinate(0, -2), "a4");
    map.set(new HexCoordinate(0, 4), "a5");
    map.set(new HexCoordinate(2, -1), "a6");

    const entries = map.entries();
    expect(entries).toHaveLength(6);

    const keys = entries.map((e) => `${e.coord.col},${e.coord.row}`);
    expect(keys).toEqual([
      "-1,5",
      "0,-2",
      "0,0",
      "0,4",
      "2,-1",
      "2,3",
    ]);
  });

  it("should clone map with deep isolation", () => {
    const original = new HexAssetMap();
    original.set(new HexCoordinate(1, 1), "tree_01");

    const cloned = original.clone();
    expect(cloned.size).toBe(1);
    expect(cloned.get(new HexCoordinate(1, 1))?.value).toBe("tree_01");

    // Mutating cloned should not affect original
    cloned.set(new HexCoordinate(2, 2), "rock_01");
    cloned.delete(new HexCoordinate(1, 1));

    expect(original.size).toBe(1);
    expect(original.has(new HexCoordinate(1, 1))).toBe(true);
    expect(original.has(new HexCoordinate(2, 2))).toBe(false);

    expect(cloned.size).toBe(1);
    expect(cloned.has(new HexCoordinate(2, 2))).toBe(true);
  });

  it("should clear all entries", () => {
    const map = new HexAssetMap();
    map.set(new HexCoordinate(0, 0), "a1");
    map.set(new HexCoordinate(1, 1), "a2");
    expect(map.size).toBe(2);

    map.clear();
    expect(map.size).toBe(0);
    expect(map.entries()).toHaveLength(0);
  });
});
