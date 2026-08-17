import { describe, it, expect } from "vitest";
import { AssetId } from "../../../src/domain/asset/AssetId";
import { TerrainAsset } from "../../../src/domain/asset/TerrainAsset";
import { TerrainId } from "../../../src/domain/terrain/TerrainId";

describe("TerrainAsset", () => {
  it("should construct with valid properties and default weight = 1.0", () => {
    const asset = new TerrainAsset({
      id: "forest_01",
      terrainId: "forest",
      name: "Pine Forest",
      source: "assets/forest_01.png",
    });

    expect(asset.id.value).toBe("forest_01");
    expect(asset.terrainId.value).toBe("forest");
    expect(asset.name).toBe("Pine Forest");
    expect(asset.source).toBe("assets/forest_01.png");
    expect(asset.weight).toBe(1.0);
    expect(Object.isFrozen(asset)).toBe(true);
  });

  it("should accept AssetId and TerrainId instances", () => {
    const assetId = new AssetId("mountain_01");
    const terrainId = new TerrainId("mountain");

    const asset = new TerrainAsset({
      id: assetId,
      terrainId: terrainId,
      name: "Snow Mountain",
      source: "assets/mountain_01.png",
      weight: 3.5,
    });

    expect(asset.id).toBe(assetId);
    expect(asset.terrainId).toBe(terrainId);
    expect(asset.weight).toBe(3.5);
  });

  it("should accept weight = 0 and positive fractional weights", () => {
    const assetZero = new TerrainAsset({
      id: "a0",
      terrainId: "water",
      name: "Water 0",
      source: "w0.png",
      weight: 0,
    });
    expect(assetZero.weight).toBe(0);

    const assetFrac = new TerrainAsset({
      id: "a1",
      terrainId: "water",
      name: "Water 1",
      source: "w1.png",
      weight: 0.125,
    });
    expect(assetFrac.weight).toBe(0.125);
  });

  it("should reject negative, NaN, or non-finite weights", () => {
    expect(
      () =>
        new TerrainAsset({
          id: "a1",
          terrainId: "t1",
          name: "Name",
          source: "s.png",
          weight: -1,
        })
    ).toThrow();

    expect(
      () =>
        new TerrainAsset({
          id: "a2",
          terrainId: "t1",
          name: "Name",
          source: "s.png",
          weight: NaN,
        })
    ).toThrow();

    expect(
      () =>
        new TerrainAsset({
          id: "a3",
          terrainId: "t1",
          name: "Name",
          source: "s.png",
          weight: Infinity,
        })
    ).toThrow();
  });

  it("should reject empty or whitespace-only name and source", () => {
    expect(
      () =>
        new TerrainAsset({
          id: "a1",
          terrainId: "t1",
          name: "",
          source: "s.png",
        })
    ).toThrow();

    expect(
      () =>
        new TerrainAsset({
          id: "a2",
          terrainId: "t1",
          name: "Valid Name",
          source: "   ",
        })
    ).toThrow();
  });

  it("should support immutable update helpers", () => {
    const original = new TerrainAsset({
      id: "grass_01",
      terrainId: "grass",
      name: "Short Grass",
      source: "grass_01.png",
      weight: 5,
    });

    const updatedWeight = original.withWeight(10);
    const updatedName = original.withName("Tall Grass");
    const updatedSource = original.withSource("grass_02.png");

    expect(original.weight).toBe(5);
    expect(updatedWeight.weight).toBe(10);
    expect(updatedWeight.id.value).toBe("grass_01");

    expect(original.name).toBe("Short Grass");
    expect(updatedName.name).toBe("Tall Grass");

    expect(original.source).toBe("grass_01.png");
    expect(updatedSource.source).toBe("grass_02.png");
  });
});
