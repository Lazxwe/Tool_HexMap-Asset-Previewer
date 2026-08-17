import { describe, it, expect } from "vitest";
import { generateVariantDisplayName } from "../../../src/domain/asset/AssetVariantNaming";
import { TerrainAsset } from "../../../src/domain/asset/TerrainAsset";
import { TerrainAssetRegistry } from "../../../src/domain/asset/TerrainAssetRegistry";
import { TerrainId } from "../../../src/domain/terrain/TerrainId";

describe("AssetVariantNaming (Task 015-P)", () => {
  it("should generate 'Forest 1' when registry is empty for that terrain", () => {
    const registry = new TerrainAssetRegistry();
    const name = generateVariantDisplayName("Forest", new TerrainId("forest"), registry);
    expect(name).toBe("Forest 1");
  });

  it("should generate 'Forest 1' when registry is undefined", () => {
    const name = generateVariantDisplayName("Forest", "forest");
    expect(name).toBe("Forest 1");
  });

  it("should increment sequentially from Forest 1 to Forest 2 and Forest 3", () => {
    const registry = new TerrainAssetRegistry();
    registry.register(
      new TerrainAsset({
        id: "forest_01",
        terrainId: "forest",
        name: "Forest 1",
        source: "assets/forest_01.png",
      })
    );

    expect(generateVariantDisplayName("Forest", "forest", registry)).toBe("Forest 2");

    registry.register(
      new TerrainAsset({
        id: "forest_02",
        terrainId: "forest",
        name: "Forest 2",
        source: "assets/forest_02.png",
      })
    );

    expect(generateVariantDisplayName("Forest", "forest", registry)).toBe("Forest 3");
  });

  it("should assign max existing variant number + 1 and not reuse gaps", () => {
    const registry = new TerrainAssetRegistry();
    // Assets with gap: Forest 1, Forest 2, Forest 4
    registry.register(
      new TerrainAsset({ id: "f1", terrainId: "forest", name: "Forest 1", source: "f1.png" })
    );
    registry.register(
      new TerrainAsset({ id: "f2", terrainId: "forest", name: "Forest 2", source: "f2.png" })
    );
    registry.register(
      new TerrainAsset({ id: "f4", terrainId: "forest", name: "Forest 4", source: "f4.png" })
    );

    // Max is 4, so next must be Forest 5 (not 3)
    const nextName = generateVariantDisplayName("Forest", "forest", registry);
    expect(nextName).toBe("Forest 5");
  });

  it("should keep numbering independent across different TerrainIds", () => {
    const registry = new TerrainAssetRegistry();
    registry.register(
      new TerrainAsset({ id: "f1", terrainId: "forest", name: "Forest 1", source: "f1.png" })
    );
    registry.register(
      new TerrainAsset({ id: "f2", terrainId: "forest", name: "Forest 2", source: "f2.png" })
    );
    registry.register(
      new TerrainAsset({ id: "m1", terrainId: "mountain", name: "Mountain 1", source: "m1.png" })
    );

    expect(generateVariantDisplayName("Forest", "forest", registry)).toBe("Forest 3");
    expect(generateVariantDisplayName("Mountain", "mountain", registry)).toBe("Mountain 2");
    expect(generateVariantDisplayName("Water", "water", registry)).toBe("Water 1");
  });
});
