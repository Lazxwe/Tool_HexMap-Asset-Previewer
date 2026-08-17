import { describe, it, expect, beforeEach } from "vitest";
import { AssetId } from "../../src/domain/asset/AssetId";
import { TerrainAsset } from "../../src/domain/asset/TerrainAsset";
import { TerrainAssetRegistry } from "../../src/domain/asset/TerrainAssetRegistry";
import { HexGeometry } from "../../src/domain/hex/HexGeometry";
import { TerrainDefinition } from "../../src/domain/terrain/TerrainDefinition";
import { TerrainId } from "../../src/domain/terrain/TerrainId";
import { TerrainRegistry } from "../../src/domain/terrain/TerrainRegistry";
import { EditorCore } from "../../src/editor/EditorCore";
import { SeededNoiseField } from "../../src/generation/SeededNoiseField";
import { TerrainClassifier } from "../../src/generation/TerrainClassification";
import { TerrainGenerator } from "../../src/generation/TerrainGenerator";
import { AssetLoader } from "../../src/infrastructure/asset/AssetLoader";
import { Viewport } from "../../src/rendering/Viewport";
import { MockImageDecoder } from "../infrastructure/asset/MockImageDecoder";
import { TerrainStorage } from "../../src/persistence/TerrainStorage";

class MemoryStorage implements Storage {
  private store: Map<string, string> = new Map();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, value); }
}

describe("EditorCore - Dynamic Terrain Management", () => {
  let editor: EditorCore;
  let terrainRegistry: TerrainRegistry;
  let assetRegistry: TerrainAssetRegistry;
  let generator: TerrainGenerator;
  let storage: TerrainStorage;

  beforeEach(() => {
    terrainRegistry = new TerrainRegistry();
    terrainRegistry.register(new TerrainDefinition({ id: "forest", displayName: "森林", fallbackColor: "#15803d" }));
    terrainRegistry.register(new TerrainDefinition({ id: "mountain", displayName: "山脈", fallbackColor: "#475569" }));

    assetRegistry = new TerrainAssetRegistry();
    assetRegistry.register(
      new TerrainAsset({
        id: new AssetId("forest_01"),
        terrainId: new TerrainId("forest"),
        name: "森林 1",
        source: "assets/forest_01.png",
        weight: 10,
      })
    );

    const hexGeometry = new HexGeometry(120, 70);
    const classifier = new TerrainClassifier([
      { terrainId: new TerrainId("forest"), max: 0.5 },
      { terrainId: new TerrainId("mountain"), max: 1.0 },
    ]);
    const noise = new SeededNoiseField(12345);
    generator = new TerrainGenerator(noise, hexGeometry, classifier);

    const assetLoader = new AssetLoader(new MockImageDecoder());
    const viewport = new Viewport({ zoom: 1.0 });
    storage = new TerrainStorage(new MemoryStorage());

    editor = new EditorCore(
      {
        generator,
        assetRegistry,
        terrainRegistry,
        assetLoader,
        geometry: hexGeometry,
        viewport,
        terrainStorage: storage,
      },
      {
        initialSeed: 12345,
        initialScale: 180,
        initialBounds: { minCol: 0, maxCol: 4, minRow: 0, maxRow: 4 },
      }
    );
  });

  it("should initialize terrain configs from registry", () => {
    const configs = editor.getTerrainConfigs();
    expect(configs).toHaveLength(2);
    expect(configs[0].id).toBe("forest");
    expect(configs[1].id).toBe("mountain");
  });

  it("should dynamically add a new terrain and update registry & fallbacks", async () => {
    await editor.addTerrain("snow", "積雪冰原", "#38bdf8");

    const configs = editor.getTerrainConfigs();
    expect(configs).toHaveLength(3);
    expect(configs.find((c) => c.id === "snow")).toBeDefined();

    expect(editor.terrainRegistry.has("snow")).toBe(true);
    const snowDef = editor.terrainRegistry.get("snow");
    expect(snowDef?.displayName).toBe("積雪冰原");
    expect(snowDef?.fallbackColor).toBe("#38bdf8");
  });

  it("should update terrain fallback color and preserve it", async () => {
    await editor.updateTerrainColor("forest", "#22c55e");

    const def = editor.terrainRegistry.get("forest");
    expect(def?.fallbackColor).toBe("#22c55e");
  });

  it("should toggle terrain generation and dynamically update classifier", async () => {
    await editor.toggleTerrainGeneration("mountain", false);

    const configs = editor.getTerrainConfigs();
    expect(configs.find((c) => c.id === "mountain")?.isEnabled).toBe(false);

    // Generation should now strictly produce forest for all cells
    const state = editor.getState();
    for (const entry of state.terrainMap.entries()) {
      expect(entry.terrainId.value).toBe("forest");
    }
  });

  it("should update generation weight and dynamically recalculate noise thresholds", async () => {
    await editor.updateTerrainGenerationWeight("forest", 3.0);
    await editor.updateTerrainGenerationWeight("mountain", 1.0);

    const thresholds = editor.generator.classifier.getThresholds();
    expect(thresholds[0].terrainId.value).toBe("forest");
    expect(thresholds[0].max).toBeCloseTo(0.75, 4);
    expect(thresholds[1].terrainId.value).toBe("mountain");
    expect(thresholds[1].max).toBe(1.0);
  });

  it("should remove terrain and clean up associated visual assets", async () => {
    expect(editor.assetRegistry.has("forest_01")).toBe(true);

    await editor.removeTerrain("forest");

    expect(editor.getTerrainConfigs()).toHaveLength(1);
    expect(editor.terrainRegistry.has("forest")).toBe(false);
    expect(editor.assetRegistry.has("forest_01")).toBe(false);
  });

  it("should prevent removing the last remaining terrain", async () => {
    await editor.removeTerrain("forest");
    await expect(editor.removeTerrain("mountain")).rejects.toThrow(/不能刪除最後一個地形/);
  });

  it("should export and import terrain configs as JSON", async () => {
    const jsonStr = editor.exportTerrainConfigJson();
    expect(jsonStr).toContain('"terrains"');

    const customJson = JSON.stringify({
      version: "1.0",
      terrains: [
        { id: "lava", displayName: "熾熱熔岩", fallbackColor: "#ef4444", generationWeight: 2, isEnabled: true },
        { id: "swamp", displayName: "毒霧沼澤", fallbackColor: "#84cc16", generationWeight: 1, isEnabled: true },
      ],
    });

    await editor.importTerrainConfigJson(customJson);

    expect(editor.getTerrainConfigs()).toHaveLength(2);
    expect(editor.terrainRegistry.has("lava")).toBe(true);
    expect(editor.terrainRegistry.has("swamp")).toBe(true);
  });

  it("should reset terrain config to default 4 biomes", async () => {
    await editor.resetTerrainConfigToDefaults();

    const configs = editor.getTerrainConfigs();
    expect(configs).toHaveLength(4);
    expect(configs.map((c) => c.id)).toEqual(["water", "sand", "forest", "mountain"]);
  });
});
