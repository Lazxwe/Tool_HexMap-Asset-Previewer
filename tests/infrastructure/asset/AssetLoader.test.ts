import { describe, it, expect, beforeEach } from "vitest";
import { AssetId } from "../../../src/domain/asset/AssetId";
import { TerrainAsset } from "../../../src/domain/asset/TerrainAsset";
import { AssetLoader } from "../../../src/infrastructure/asset/AssetLoader";
import { MockImageDecoder } from "./MockImageDecoder";

describe("AssetLoader", () => {
  let mockDecoder: MockImageDecoder;
  let loader: AssetLoader;

  beforeEach(() => {
    mockDecoder = new MockImageDecoder();
    loader = new AssetLoader(mockDecoder);
  });

  it("should load a TerrainAsset and return a LoadedAsset with decoded RenderableImage", async () => {
    const asset = new TerrainAsset({
      id: "forest_01",
      terrainId: "forest",
      name: "Pine Forest",
      source: "assets/forest_01.png",
      weight: 5,
    });

    const loaded = await loader.load(asset);

    expect(loaded.assetId.value).toBe("forest_01");
    expect(loaded.source).toBe("assets/forest_01.png");
    expect(loaded.image.width).toBe(256);
    expect(loaded.image.height).toBe(256);
    expect(mockDecoder.decodeCount).toBe(1);
    expect(loader.size).toBe(1);
  });

  it("should cache loaded assets and not re-decode on subsequent calls", async () => {
    const asset = new TerrainAsset({
      id: "mountain_01",
      terrainId: "mountain",
      name: "Snow Mountain",
      source: "assets/mountain_01.png",
    });

    const loaded1 = await loader.load(asset);
    const loaded2 = await loader.load(asset);

    expect(loaded1).toBe(loaded2);
    expect(mockDecoder.decodeCount).toBe(1);
  });

  it("should deduplicate concurrent in-flight loading requests", async () => {
    const asset = new TerrainAsset({
      id: "water_01",
      terrainId: "water",
      name: "Water",
      source: "assets/water_01.png",
    });

    const [res1, res2, res3] = await Promise.all([
      loader.load(asset),
      loader.load(asset),
      loader.load(asset),
    ]);

    expect(res1).toBe(res2);
    expect(res2).toBe(res3);
    expect(mockDecoder.decodeCount).toBe(1);
  });

  it("should retrieve cached assets using get and check presence with has", async () => {
    const asset = new TerrainAsset({
      id: "grass_01",
      terrainId: "grass",
      name: "Grass",
      source: "assets/grass_01.png",
    });

    expect(loader.has("grass_01")).toBe(false);
    expect(loader.get("grass_01")).toBeUndefined();

    await loader.load(asset);

    expect(loader.has("grass_01")).toBe(true);
    expect(loader.has(new AssetId("grass_01"))).toBe(true);
    expect(loader.get("grass_01")?.assetId.value).toBe("grass_01");
    expect(loader.get(new AssetId("grass_01"))?.source).toBe("assets/grass_01.png");
  });

  it("should handle decode failures gracefully and not pollute cache", async () => {
    mockDecoder.shouldFail = true;
    mockDecoder.failureMessage = "File not found";

    const asset = new TerrainAsset({
      id: "bad_01",
      terrainId: "lava",
      name: "Corrupt Lava",
      source: "assets/corrupt.png",
    });

    await expect(loader.load(asset)).rejects.toThrow(/File not found/);
    expect(loader.has("bad_01")).toBe(false);
    expect(loader.get("bad_01")).toBeUndefined();
    expect(loader.size).toBe(0);

    // After fixing the error, loading should succeed
    mockDecoder.shouldFail = false;
    const retryLoaded = await loader.load(asset);
    expect(retryLoaded.assetId.value).toBe("bad_01");
    expect(loader.has("bad_01")).toBe(true);
  });

  it("should support clearing the cache", async () => {
    const a1 = new TerrainAsset({ id: "a1", terrainId: "t1", name: "A1", source: "s1.png" });
    const a2 = new TerrainAsset({ id: "a2", terrainId: "t2", name: "A2", source: "s2.png" });

    await loader.load(a1);
    await loader.load(a2);

    expect(loader.size).toBe(2);
    loader.clear();
    expect(loader.size).toBe(0);
    expect(loader.has("a1")).toBe(false);
  });
});
