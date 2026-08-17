import { describe, it, expect } from "vitest";
import { AssetId } from "../../../src/domain/asset/AssetId";
import { generateUniqueAssetId } from "../../../src/domain/asset/AssetIdGenerator";
import { TerrainAsset } from "../../../src/domain/asset/TerrainAsset";
import { TerrainAssetRegistry } from "../../../src/domain/asset/TerrainAssetRegistry";

describe("AssetIdGenerator", () => {
  it("should generate a sanitized, lowercase AssetId from a clean file name", () => {
    const id = generateUniqueAssetId("Forest_Tree_01.png", "forest");
    expect(id).toBeInstanceOf(AssetId);
    expect(id.value).toBe("forest_tree_01");
  });

  it("should sanitize spaces and special characters into underscores", () => {
    const id = generateUniqueAssetId("  my cool stamp #3!.PNG  ", "water");
    expect(id.value).toBe("my_cool_stamp_3");
  });

  it("should fallback to terrainId_stamp when file name produces empty base name", () => {
    const id = generateUniqueAssetId(".png", "mountain");
    expect(id.value).toBe("mountain_stamp");

    const idSpecial = generateUniqueAssetId("!@#$%.png", "sand");
    expect(idSpecial.value).toBe("sand_stamp");
  });

  it("should resolve collision by appending numeric counter when registry contains the ID", () => {
    const registry = new TerrainAssetRegistry();
    registry.register(
      new TerrainAsset({
        id: "forest_tree",
        terrainId: "forest",
        name: "Forest Tree",
        source: "assets/forest_tree.png",
      })
    );

    const id2 = generateUniqueAssetId("forest_tree.png", "forest", registry);
    expect(id2.value).toBe("forest_tree_1");

    registry.register(
      new TerrainAsset({
        id: "forest_tree_1",
        terrainId: "forest",
        name: "Forest Tree 1",
        source: "assets/forest_tree_1.png",
      })
    );

    const id3 = generateUniqueAssetId("forest_tree.png", "forest", registry);
    expect(id3.value).toBe("forest_tree_2");
  });
});
