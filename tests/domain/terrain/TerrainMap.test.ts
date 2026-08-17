import { describe, it, expect } from "vitest";
import { HexCoordinate } from "../../../src/domain/hex/HexCoordinate";
import { TerrainId } from "../../../src/domain/terrain/TerrainId";
import { TerrainMap } from "../../../src/domain/terrain/TerrainMap";

describe("TerrainMap", () => {
  it("should start with empty state and size 0", () => {
    const map = new TerrainMap();
    expect(map.size).toBe(0);
    expect(map.get(new HexCoordinate(0, 0))).toBeUndefined();
    expect(map.has(new HexCoordinate(0, 0))).toBe(false);
  });

  it("should assign and retrieve TerrainId by HexCoordinate", () => {
    const map = new TerrainMap();
    const c1 = new HexCoordinate(2, 3);
    const c2 = new HexCoordinate(5, -1);

    map.set(c1, "grass");
    map.set(c2, new TerrainId("water"));

    expect(map.size).toBe(2);
    expect(map.has(c1)).toBe(true);
    expect(map.has(c2)).toBe(true);

    const tid1 = map.get(c1);
    expect(tid1).toBeInstanceOf(TerrainId);
    expect(tid1?.value).toBe("grass");

    const tid2 = map.get(c2);
    expect(tid2?.value).toBe("water");
  });

  it("should overwrite existing terrain assignment cleanly", () => {
    const map = new TerrainMap();
    const coord = new HexCoordinate(1, 1);

    map.set(coord, "grass");
    expect(map.get(coord)?.value).toBe("grass");

    map.set(coord, "mountain");
    expect(map.size).toBe(1);
    expect(map.get(coord)?.value).toBe("mountain");
  });

  it("should support removing terrain assignments", () => {
    const map = new TerrainMap();
    const coord = new HexCoordinate(0, 4);

    map.set(coord, "desert");
    expect(map.has(coord)).toBe(true);

    expect(map.delete(coord)).toBe(true);
    expect(map.has(coord)).toBe(false);
    expect(map.get(coord)).toBeUndefined();
    expect(map.size).toBe(0);
    expect(map.delete(coord)).toBe(false);
  });

  it("should handle negative coordinates correctly", () => {
    const map = new TerrainMap();
    const negCoord = new HexCoordinate(-10, -25);

    map.set(negCoord, "snow");
    expect(map.has(negCoord)).toBe(true);
    expect(map.get(negCoord)?.value).toBe("snow");
  });

  it("should iterate entries in deterministic (col, row) order", () => {
    const map = new TerrainMap();
    // Insert in unsorted order
    map.set(new HexCoordinate(5, 2), "t5_2");
    map.set(new HexCoordinate(1, 8), "t1_8");
    map.set(new HexCoordinate(1, 3), "t1_3");
    map.set(new HexCoordinate(0, 0), "t0_0");
    map.set(new HexCoordinate(-2, 5), "tneg2_5");

    const entries = map.entries();
    expect(entries).toHaveLength(5);

    expect(entries[0].coord.equals(new HexCoordinate(-2, 5))).toBe(true);
    expect(entries[1].coord.equals(new HexCoordinate(0, 0))).toBe(true);
    expect(entries[2].coord.equals(new HexCoordinate(1, 3))).toBe(true);
    expect(entries[3].coord.equals(new HexCoordinate(1, 8))).toBe(true);
    expect(entries[4].coord.equals(new HexCoordinate(5, 2))).toBe(true);
  });

  it("should clone terrain map into an independent instance", () => {
    const original = new TerrainMap();
    const c1 = new HexCoordinate(0, 0);
    const c2 = new HexCoordinate(1, 1);

    original.set(c1, "grass");
    original.set(c2, "water");

    const cloned = original.clone();
    expect(cloned.size).toBe(2);
    expect(cloned.get(c1)?.value).toBe("grass");

    // Mutating clone does not affect original
    cloned.set(c1, "lava");
    expect(cloned.get(c1)?.value).toBe("lava");
    expect(original.get(c1)?.value).toBe("grass");
  });

  it("should store TerrainId references rather than TerrainDefinition objects", () => {
    const map = new TerrainMap();
    const coord = new HexCoordinate(3, 4);

    map.set(coord, "forest");
    const stored = map.get(coord);

    expect(stored).toBeInstanceOf(TerrainId);
    // @ts-expect-error - testing that weight/displayName are not on TerrainId
    expect(stored.weight).toBeUndefined();
    // @ts-expect-error - testing that weight/displayName are not on TerrainId
    expect(stored.displayName).toBeUndefined();
  });
});
