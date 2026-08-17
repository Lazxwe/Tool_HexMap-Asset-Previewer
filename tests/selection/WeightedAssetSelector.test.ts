import { describe, it, expect, vi } from "vitest";
import { TerrainAsset } from "../../src/domain/asset/TerrainAsset";
import { TerrainAssetRegistry } from "../../src/domain/asset/TerrainAssetRegistry";
import { HexCoordinate } from "../../src/domain/hex/HexCoordinate";
import { TerrainId } from "../../src/domain/terrain/TerrainId";
import { TerrainMap } from "../../src/domain/terrain/TerrainMap";
import { RandomSource } from "../../src/selection/RandomTypes";
import { SeededRandomSource } from "../../src/selection/SeededRandomSource";
import { WeightedAssetSelector } from "../../src/selection/WeightedAssetSelector";

class MockRandomSource implements RandomSource {
  constructor(public values: number[] = [0.5]) {}
  private index = 0;

  next(): number {
    const val = this.values[this.index % this.values.length];
    this.index++;
    return val;
  }
}

describe("WeightedAssetSelector", () => {
  const forestId = new TerrainId("forest");
  const mountainId = new TerrainId("mountain");

  function createSampleRegistry(): TerrainAssetRegistry {
    const reg = new TerrainAssetRegistry();
    reg.register(new TerrainAsset({ id: "f1", terrainId: forestId, name: "F1", source: "f1.png", weight: 5 }));
    reg.register(new TerrainAsset({ id: "f2", terrainId: forestId, name: "F2", source: "f2.png", weight: 3 }));
    reg.register(new TerrainAsset({ id: "f3", terrainId: forestId, name: "F3", source: "f3.png", weight: 2 }));
    return reg;
  }

  it("should construct with valid registry and random source", () => {
    const reg = createSampleRegistry();
    const rng = new SeededRandomSource(42);
    const selector = new WeightedAssetSelector(reg, rng);

    expect(selector.registry).toBe(reg);
    expect(selector.random).toBe(rng);
    expect(Object.isFrozen(selector)).toBe(true);
  });

  it("should select assets for terrain using cumulative threshold boundaries", () => {
    const reg = createSampleRegistry(); // f1: 5, f2: 3, f3: 2 (total 10)
    const mockRng = new MockRandomSource();
    const selector = new WeightedAssetSelector(reg, mockRng);

    // r = 0 -> target 0.0 < 5 -> f1
    mockRng.values = [0.0];
    expect(selector.selectForTerrain(forestId).id.value).toBe("f1");

    // r = 0.499 -> target 4.99 < 5 -> f1
    mockRng.values = [0.499];
    expect(selector.selectForTerrain(forestId).id.value).toBe("f1");

    // r = 0.5 -> target 5.0 < 8 -> f2
    mockRng.values = [0.5];
    expect(selector.selectForTerrain(forestId).id.value).toBe("f2");

    // r = 0.799 -> target 7.99 < 8 -> f2
    mockRng.values = [0.799];
    expect(selector.selectForTerrain(forestId).id.value).toBe("f2");

    // r = 0.8 -> target 8.0 < 10 -> f3
    mockRng.values = [0.8];
    expect(selector.selectForTerrain(forestId).id.value).toBe("f3");

    // r = 0.999 -> target 9.99 < 10 -> f3
    mockRng.values = [0.999];
    expect(selector.selectForTerrain(forestId).id.value).toBe("f3");
  });

  it("should never select zero-weight assets across large samples", () => {
    const reg = new TerrainAssetRegistry();
    reg.register(new TerrainAsset({ id: "active1", terrainId: "grass", name: "A1", source: "a1.png", weight: 10 }));
    reg.register(new TerrainAsset({ id: "zero_asset", terrainId: "grass", name: "Z", source: "z.png", weight: 0 }));
    reg.register(new TerrainAsset({ id: "active2", terrainId: "grass", name: "A2", source: "a2.png", weight: 10 }));

    const rng = new SeededRandomSource(12345);
    const selector = new WeightedAssetSelector(reg, rng);

    for (let i = 0; i < 5000; i++) {
      const selected = selector.selectForTerrain("grass");
      expect(selected.id.value).not.toBe("zero_asset");
    }
  });

  it("should throw error if all assets for a terrain have zero weight", () => {
    const reg = new TerrainAssetRegistry();
    reg.register(new TerrainAsset({ id: "z1", terrainId: "desert", name: "Z1", source: "z1.png", weight: 0 }));
    reg.register(new TerrainAsset({ id: "z2", terrainId: "desert", name: "Z2", source: "z2.png", weight: 0 }));

    const selector = new WeightedAssetSelector(reg, new MockRandomSource([0.5]));
    expect(() => selector.selectForTerrain("desert")).toThrow(/zero or invalid selection weight/);
  });

  it("should throw error if terrain has no registered assets", () => {
    const reg = new TerrainAssetRegistry();
    const selector = new WeightedAssetSelector(reg, new MockRandomSource([0.5]));
    expect(() => selector.selectForTerrain("ocean")).toThrow(/No assets registered/);
  });

  it("should always return the single asset and consume exactly 1 RNG call", () => {
    const reg = new TerrainAssetRegistry();
    reg.register(new TerrainAsset({ id: "single", terrainId: mountainId, name: "Peak", source: "p.png", weight: 4 }));

    const mockRng = new MockRandomSource([0.3]);
    const spy = vi.spyOn(mockRng, "next");

    const selector = new WeightedAssetSelector(reg, mockRng);
    const selected = selector.selectForTerrain(mountainId);

    expect(selected.id.value).toBe("single");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("should match theoretical probability distribution (10%, 30%, 60% ± 1.5%) across 100,000 samples", () => {
    const reg = new TerrainAssetRegistry();
    reg.register(new TerrainAsset({ id: "a", terrainId: "test", name: "A", source: "a.png", weight: 1 }));
    reg.register(new TerrainAsset({ id: "b", terrainId: "test", name: "B", source: "b.png", weight: 3 }));
    reg.register(new TerrainAsset({ id: "c", terrainId: "test", name: "C", source: "c.png", weight: 6 }));

    const rng = new SeededRandomSource(98765);
    const selector = new WeightedAssetSelector(reg, rng);

    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    const TOTAL = 100000;

    for (let i = 0; i < TOTAL; i++) {
      const item = selector.selectForTerrain("test");
      counts[item.id.value]++;
    }

    const pctA = counts.a / TOTAL;
    const pctB = counts.b / TOTAL;
    const pctC = counts.c / TOTAL;

    expect(pctA).toBeGreaterThanOrEqual(0.1 - 0.015);
    expect(pctA).toBeLessThanOrEqual(0.1 + 0.015);

    expect(pctB).toBeGreaterThanOrEqual(0.3 - 0.015);
    expect(pctB).toBeLessThanOrEqual(0.3 + 0.015);

    expect(pctC).toBeGreaterThanOrEqual(0.6 - 0.015);
    expect(pctC).toBeLessThanOrEqual(0.6 + 0.015);
  });

  it("should reject invalid values returned from RandomSource (< 0, >= 1, NaN, Infinity)", () => {
    const reg = createSampleRegistry();
    const mockRng = new MockRandomSource([-0.1]);
    const selector = new WeightedAssetSelector(reg, mockRng);

    expect(() => selector.selectForTerrain(forestId)).toThrow(/RandomSource returned invalid value/);

    mockRng.values = [1.0];
    expect(() => selector.selectForTerrain(forestId)).toThrow(/RandomSource returned invalid value/);

    mockRng.values = [1.5];
    expect(() => selector.selectForTerrain(forestId)).toThrow(/RandomSource returned invalid value/);

    mockRng.values = [NaN];
    expect(() => selector.selectForTerrain(forestId)).toThrow(/RandomSource returned invalid value/);
  });

  describe("selectForMap", () => {
    it("should return an empty HexAssetMap for an empty TerrainMap", () => {
      const reg = createSampleRegistry();
      const selector = new WeightedAssetSelector(reg, new SeededRandomSource(1));
      const emptyMap = new TerrainMap();

      const result = selector.selectForMap(emptyMap);
      expect(result.size).toBe(0);
    });

    it("should deterministically generate HexAssetMap matching identical seed and inputs", () => {
      const reg = new TerrainAssetRegistry();
      reg.register(new TerrainAsset({ id: "f_01", terrainId: "forest", name: "F1", source: "f1.png", weight: 5 }));
      reg.register(new TerrainAsset({ id: "f_02", terrainId: "forest", name: "F2", source: "f2.png", weight: 3 }));
      reg.register(new TerrainAsset({ id: "m_01", terrainId: "mountain", name: "M1", source: "m1.png", weight: 2 }));
      reg.register(new TerrainAsset({ id: "m_02", terrainId: "mountain", name: "M2", source: "m2.png", weight: 1 }));

      const terrainMap = new TerrainMap();
      terrainMap.set(new HexCoordinate(0, 0), "forest");
      terrainMap.set(new HexCoordinate(1, 0), "forest");
      terrainMap.set(new HexCoordinate(0, 1), "mountain");
      terrainMap.set(new HexCoordinate(1, 1), "forest");

      const selectorA = new WeightedAssetSelector(reg, new SeededRandomSource(12345));
      const resultA = selectorA.selectForMap(terrainMap);

      const selectorB = new WeightedAssetSelector(reg, new SeededRandomSource(12345));
      const resultB = selectorB.selectForMap(terrainMap);

      expect(resultA.size).toBe(4);
      expect(resultA.entries()).toEqual(resultB.entries());
    });

    it("should maintain independent RNG sequences when instances are interleaved", () => {
      const reg = createSampleRegistry();
      const selA = new WeightedAssetSelector(reg, new SeededRandomSource(777));
      const selB = new WeightedAssetSelector(reg, new SeededRandomSource(777));

      // Reference sequence from selRef
      const selRef = new WeightedAssetSelector(reg, new SeededRandomSource(777));
      const refPicks = [
        selRef.selectForTerrain(forestId).id.value,
        selRef.selectForTerrain(forestId).id.value,
        selRef.selectForTerrain(forestId).id.value,
      ];

      // Interleaved execution: A, B, A, B, A, B
      const pickA1 = selA.selectForTerrain(forestId).id.value;
      const pickB1 = selB.selectForTerrain(forestId).id.value;
      const pickA2 = selA.selectForTerrain(forestId).id.value;
      const pickB2 = selB.selectForTerrain(forestId).id.value;
      const pickA3 = selA.selectForTerrain(forestId).id.value;
      const pickB3 = selB.selectForTerrain(forestId).id.value;

      expect([pickA1, pickA2, pickA3]).toEqual(refPicks);
      expect([pickB1, pickB2, pickB3]).toEqual(refPicks);
    });
  });
});
