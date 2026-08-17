import { describe, it, expect } from "vitest";
import { AssetId } from "../../../src/domain/asset/AssetId";
import { TerrainAsset } from "../../../src/domain/asset/TerrainAsset";
import { TerrainAssetRegistry } from "../../../src/domain/asset/TerrainAssetRegistry";
import { TerrainId } from "../../../src/domain/terrain/TerrainId";

describe("TerrainAssetRegistry", () => {
  it("should register and retrieve assets by AssetId", () => {
    const registry = new TerrainAssetRegistry();
    const asset1 = new TerrainAsset({
      id: "f_01",
      terrainId: "forest",
      name: "Forest Stamp 1",
      source: "f1.png",
      weight: 5,
    });
    const asset2 = new TerrainAsset({
      id: "m_01",
      terrainId: "mountain",
      name: "Mountain Stamp 1",
      source: "m1.png",
      weight: 2,
    });

    registry.register(asset1);
    registry.register(asset2);

    expect(registry.size).toBe(2);
    expect(registry.has("f_01")).toBe(true);
    expect(registry.has(new AssetId("m_01"))).toBe(true);
    expect(registry.has("unknown_01")).toBe(false);

    expect(registry.get("f_01")).toBe(asset1);
    expect(registry.get(new AssetId("m_01"))).toBe(asset2);
    expect(registry.get("unknown_01")).toBeUndefined();
  });

  it("should reject duplicate asset ID registration", () => {
    const registry = new TerrainAssetRegistry();
    const a1 = new TerrainAsset({ id: "dup", terrainId: "grass", name: "A1", source: "s1.png" });
    const a2 = new TerrainAsset({ id: "dup", terrainId: "water", name: "A2", source: "s2.png" });

    registry.register(a1);
    expect(() => registry.register(a2)).toThrow(/already registered/);
  });

  it("should support removing assets", () => {
    const registry = new TerrainAssetRegistry();
    const asset = new TerrainAsset({ id: "rem", terrainId: "sand", name: "Rem", source: "r.png" });
    registry.register(asset);

    expect(registry.has("rem")).toBe(true);
    expect(registry.remove("rem")).toBe(true);
    expect(registry.has("rem")).toBe(false);
    expect(registry.remove("rem")).toBe(false);
  });

  it("should query all assets for a given TerrainId (getByTerrain)", () => {
    const registry = new TerrainAssetRegistry();
    const f1 = new TerrainAsset({ id: "f1", terrainId: "forest", name: "F1", source: "f1.png", weight: 5 });
    const f2 = new TerrainAsset({ id: "f2", terrainId: "forest", name: "F2", source: "f2.png", weight: 3 });
    const f3 = new TerrainAsset({ id: "f3", terrainId: "forest", name: "F3", source: "f3.png", weight: 1 });
    const m1 = new TerrainAsset({ id: "m1", terrainId: "mountain", name: "M1", source: "m1.png", weight: 4 });

    registry.register(f1);
    registry.register(m1);
    registry.register(f2);
    registry.register(f3);

    const forestAssets = registry.getByTerrain("forest");
    expect(forestAssets).toHaveLength(3);
    expect(forestAssets[0].id.value).toBe("f1");
    expect(forestAssets[1].id.value).toBe("f2");
    expect(forestAssets[2].id.value).toBe("f3");

    const mountainAssets = registry.getByTerrain(new TerrainId("mountain"));
    expect(mountainAssets).toHaveLength(1);
    expect(mountainAssets[0].id.value).toBe("m1");

    const emptyAssets = registry.getByTerrain("desert");
    expect(emptyAssets).toHaveLength(0);
  });

  it("should list all assets in deterministic registration order", () => {
    const registry = new TerrainAssetRegistry();
    const a = new TerrainAsset({ id: "a", terrainId: "t1", name: "A", source: "a.png" });
    const b = new TerrainAsset({ id: "b", terrainId: "t2", name: "B", source: "b.png" });
    const c = new TerrainAsset({ id: "c", terrainId: "t1", name: "C", source: "c.png" });

    registry.register(a);
    registry.register(b);
    registry.register(c);

    const list = registry.list();
    expect(list).toHaveLength(3);
    expect(list[0].id.value).toBe("a");
    expect(list[1].id.value).toBe("b");
    expect(list[2].id.value).toBe("c");
  });

  it("should protect internal state from external array mutation", () => {
    const registry = new TerrainAssetRegistry();
    const a = new TerrainAsset({ id: "a", terrainId: "t1", name: "A", source: "a.png" });
    registry.register(a);

    const list = registry.list();
    list.pop();
    expect(registry.size).toBe(1);
    expect(registry.list()).toHaveLength(1);

    const byTerrain = registry.getByTerrain("t1");
    byTerrain.pop();
    expect(registry.getByTerrain("t1")).toHaveLength(1);
  });

  it("should support clear", () => {
    const registry = new TerrainAssetRegistry();
    registry.register(new TerrainAsset({ id: "a1", terrainId: "t1", name: "A1", source: "a1.png" }));
    registry.register(new TerrainAsset({ id: "a2", terrainId: "t2", name: "A2", source: "a2.png" }));

    expect(registry.size).toBe(2);
    registry.clear();
    expect(registry.size).toBe(0);
    expect(registry.list()).toHaveLength(0);
  });

  describe("updateWeight (Task 016)", () => {
    it("should successfully update weight of an existing asset", () => {
      const registry = new TerrainAssetRegistry();
      const asset = new TerrainAsset({
        id: "forest_01",
        terrainId: "forest",
        name: "Forest 1",
        source: "forest_01.png",
        weight: 1.0,
      });
      registry.register(asset);

      registry.updateWeight("forest_01", 5.5);
      const updated = registry.get("forest_01")!;
      expect(updated.weight).toBe(5.5);
      expect(updated.name).toBe("Forest 1");
      expect(updated.source).toBe("forest_01.png");
      expect(updated.terrainId.value).toBe("forest");
    });

    it("should allow setting weight to 0", () => {
      const registry = new TerrainAssetRegistry();
      const asset = new TerrainAsset({
        id: "forest_01",
        terrainId: "forest",
        name: "Forest 1",
        source: "forest_01.png",
        weight: 2.0,
      });
      registry.register(asset);

      registry.updateWeight(new AssetId("forest_01"), 0);
      expect(registry.get("forest_01")!.weight).toBe(0);
    });

    it("should reject negative weights", () => {
      const registry = new TerrainAssetRegistry();
      registry.register(
        new TerrainAsset({ id: "f1", terrainId: "forest", name: "F1", source: "f1.png", weight: 1.0 })
      );

      expect(() => registry.updateWeight("f1", -0.5)).toThrow(/Invalid weight/);
      expect(() => registry.updateWeight("f1", -10)).toThrow(/Invalid weight/);
    });

    it("should reject NaN and Infinity weights", () => {
      const registry = new TerrainAssetRegistry();
      registry.register(
        new TerrainAsset({ id: "f1", terrainId: "forest", name: "F1", source: "f1.png", weight: 1.0 })
      );

      expect(() => registry.updateWeight("f1", NaN)).toThrow(/Invalid weight/);
      expect(() => registry.updateWeight("f1", Infinity)).toThrow(/Invalid weight/);
      expect(() => registry.updateWeight("f1", -Infinity)).toThrow(/Invalid weight/);
    });

    it("should reject updating non-existent assetId", () => {
      const registry = new TerrainAssetRegistry();
      expect(() => registry.updateWeight("non_existent", 2.0)).toThrow(/not found in registry/);
    });
  });
});
