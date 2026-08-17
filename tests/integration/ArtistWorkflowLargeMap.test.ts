import { describe, it, expect, beforeEach } from "vitest";
import { HexCoordinate } from "../../src/domain/hex/HexCoordinate";
import { HexGeometry } from "../../src/domain/hex/HexGeometry";
import { TerrainDefinition } from "../../src/domain/terrain/TerrainDefinition";
import { TerrainId } from "../../src/domain/terrain/TerrainId";
import { TerrainRegistry } from "../../src/domain/terrain/TerrainRegistry";
import { TerrainAsset } from "../../src/domain/asset/TerrainAsset";
import { TerrainAssetRegistry } from "../../src/domain/asset/TerrainAssetRegistry";
import { SeededNoiseField } from "../../src/generation/SeededNoiseField";
import { TerrainClassifier } from "../../src/generation/TerrainClassification";
import { TerrainGenerator } from "../../src/generation/TerrainGenerator";
import { AssetLoader } from "../../src/infrastructure/asset/AssetLoader";
import { MockImageDecoder } from "../infrastructure/asset/MockImageDecoder";
import { Viewport } from "../../src/rendering/Viewport";
import { EditorCore } from "../../src/editor/EditorCore";

describe("Task 019 Integration: Preview Quality & Artist Workflow", () => {
  let terrainRegistry: TerrainRegistry;
  let assetRegistry: TerrainAssetRegistry;
  let hexGeometry: HexGeometry;
  let classifier: TerrainClassifier;
  let noise: SeededNoiseField;
  let generator: TerrainGenerator;
  let assetLoader: AssetLoader;
  let viewport: Viewport;

  beforeEach(() => {
    // 1. Terrain Domain
    terrainRegistry = new TerrainRegistry();
    terrainRegistry.register(new TerrainDefinition({ id: "water", displayName: "Water" }));
    terrainRegistry.register(new TerrainDefinition({ id: "sand", displayName: "Sand" }));
    terrainRegistry.register(new TerrainDefinition({ id: "forest", displayName: "Forest" }));
    terrainRegistry.register(new TerrainDefinition({ id: "mountain", displayName: "Mountain" }));

    // 2. Asset Domain with multiple variants
    assetRegistry = new TerrainAssetRegistry();
    assetRegistry.register(new TerrainAsset({ id: "water_01", terrainId: "water", name: "Water 1", source: "assets/water_01.png", weight: 1.0 }));
    assetRegistry.register(new TerrainAsset({ id: "water_02", terrainId: "water", name: "Water 2", source: "assets/water_02.png", weight: 1.0 }));
    assetRegistry.register(new TerrainAsset({ id: "forest_01", terrainId: "forest", name: "Forest 1", source: "assets/forest_01.png", weight: 1.0 }));
    assetRegistry.register(new TerrainAsset({ id: "forest_02", terrainId: "forest", name: "Forest 2", source: "assets/forest_02.png", weight: 1.0 }));
    assetRegistry.register(new TerrainAsset({ id: "forest_03", terrainId: "forest", name: "Forest 3", source: "assets/forest_03.png", weight: 1.0 }));
    assetRegistry.register(new TerrainAsset({ id: "mountain_01", terrainId: "mountain", name: "Mountain 1", source: "assets/mountain_01.png", weight: 1.0 }));
    // Note: sand has NO registered assets (tests fallback)

    // 3. Geometry & Classifier
    hexGeometry = new HexGeometry(120, 70);
    classifier = new TerrainClassifier([
      { terrainId: new TerrainId("water"), max: 0.35 },
      { terrainId: new TerrainId("sand"), max: 0.52 },
      { terrainId: new TerrainId("forest"), max: 0.78 },
      { terrainId: new TerrainId("mountain"), max: 1.0 },
    ]);
    noise = new SeededNoiseField(424242);
    generator = new TerrainGenerator(noise, hexGeometry, classifier);

    // 4. Infrastructure & Viewport
    assetLoader = new AssetLoader(new MockImageDecoder());
    viewport = new Viewport({ zoom: 1.0, panX: 0, panY: 0 });
  });

  describe("Task 019-A & B: Large Map Generation & Biome Continuity", () => {
    it("should generate a 25x25 (625 hexes) map with spatially continuous biomes", async () => {
      const editor = new EditorCore(
        { generator, assetRegistry, terrainRegistry, assetLoader, geometry: hexGeometry, viewport },
        { initialSeed: 424242, initialScale: 180, initialBounds: { minCol: 0, maxCol: 24, minRow: 0, maxRow: 24 } }
      );

      const startTime = performance.now();
      await editor.generate();
      const elapsed = performance.now() - startTime;

      const state = editor.getState();
      expect(state.status).toBe("ready");
      expect(state.terrainMap.size).toBe(625);
      // AssetMap maps cells with assets; fallback cells make up the remainder
      expect(state.assetMap.size + editor.getRenderFallbacks().length).toBe(625);
      expect(elapsed).toBeLessThan(500); // Fast procedural generation under 500ms

      // Verify spatial continuity: neighboring hexes should frequently share the same terrain
      let sameTerrainNeighbors = 0;
      let totalNeighborPairs = 0;

      for (const { coord, terrainId } of state.terrainMap.entries()) {
        const neighbors = hexGeometry.getHexNeighbors(coord);
        for (const neighbor of neighbors) {
          const neighborTerrain = state.terrainMap.get(neighbor);
          if (neighborTerrain) {
            totalNeighborPairs++;
            if (neighborTerrain.value === terrainId.value) {
              sameTerrainNeighbors++;
            }
          }
        }
      }

      // Smooth noise should produce continuous clusters (ratio > 0.45)
      const continuityRatio = sameTerrainNeighbors / totalNeighborPairs;
      expect(continuityRatio).toBeGreaterThan(0.45);
    });

    it("should generate a 50x50 (2500 hexes) large map smoothly without performance bottlenecks", async () => {
      const editor = new EditorCore(
        { generator, assetRegistry, terrainRegistry, assetLoader, geometry: hexGeometry, viewport },
        { initialSeed: 99999, initialScale: 250, initialBounds: { minCol: 0, maxCol: 49, minRow: 0, maxRow: 49 } }
      );

      const startTime = performance.now();
      await editor.generate();
      const elapsed = performance.now() - startTime;

      const state = editor.getState();
      expect(state.status).toBe("ready");
      expect(state.terrainMap.size).toBe(2500);
      expect(state.assetMap.size + editor.getRenderFallbacks().length).toBe(2500);
      expect(elapsed).toBeLessThan(1000); // Under 1s for 2500 hexes
    });
  });

  describe("Task 019-C & G: Multi-Variant Distribution & Seed Isolation", () => {
    it("should naturally distribute 3 forest variants across a large map according to weights", async () => {
      const editor = new EditorCore(
        { generator, assetRegistry, terrainRegistry, assetLoader, geometry: hexGeometry, viewport },
        { initialSeed: 12345, initialScale: 180, initialBounds: { minCol: 0, maxCol: 29, minRow: 0, maxRow: 29 } }
      );

      await editor.generate();
      const state = editor.getState();

      const variantCounts: Record<string, number> = {
        forest_01: 0,
        forest_02: 0,
        forest_03: 0,
      };

      for (const { coord, terrainId } of state.terrainMap.entries()) {
        if (terrainId.value === "forest") {
          const assetId = state.assetMap.get(coord);
          if (assetId && variantCounts[assetId.value] !== undefined) {
            variantCounts[assetId.value]++;
          }
        }
      }

      // With equal weights (1, 1, 1), all 3 variants should appear significantly
      expect(variantCounts.forest_01).toBeGreaterThan(10);
      expect(variantCounts.forest_02).toBeGreaterThan(10);
      expect(variantCounts.forest_03).toBeGreaterThan(10);
    });

    it("should strictly exclude weight=0 variants and rebalance to remaining variants", async () => {
      const editor = new EditorCore(
        { generator, assetRegistry, terrainRegistry, assetLoader, geometry: hexGeometry, viewport },
        { initialSeed: 12345, initialScale: 180, initialBounds: { minCol: 0, maxCol: 19, minRow: 0, maxRow: 19 } }
      );

      await editor.generate();
      const initialTerrainMap = editor.getState().terrainMap;

      // Disable forest_01 and forest_02 by setting weight to 0
      await editor.updateAssetWeight("forest_01", 0);
      await editor.updateAssetWeight("forest_02", 0);

      const state = editor.getState();
      expect(state.terrainMap).toBe(initialTerrainMap); // Strict identity

      // All forest hexes must now be assigned exclusively to forest_03
      for (const { coord, terrainId } of state.terrainMap.entries()) {
        if (terrainId.value === "forest") {
          const assignedAsset = state.assetMap.get(coord);
          expect(assignedAsset?.value).toBe("forest_03");
        }
      }
    });

    it("should reroll visual stamps without modifying TerrainMap or generation seed", async () => {
      const editor = new EditorCore(
        { generator, assetRegistry, terrainRegistry, assetLoader, geometry: hexGeometry, viewport },
        { initialSeed: 55555, initialScale: 180, initialBounds: { minCol: 0, maxCol: 19, minRow: 0, maxRow: 19 } }
      );

      await editor.generate();
      const terrainMap1 = editor.getState().terrainMap;
      const assetMap1 = editor.getState().assetMap;
      const initialAssetSeed = editor.getState().previewAssetSeed;

      // Reroll assets with new seed
      await editor.rerollAssets(88888);

      const terrainMap2 = editor.getState().terrainMap;
      const assetMap2 = editor.getState().assetMap;
      const newAssetSeed = editor.getState().previewAssetSeed;

      expect(terrainMap2).toBe(terrainMap1); // Unchanged terrain map
      expect(newAssetSeed).toBe(88888);
      expect(newAssetSeed).not.toBe(initialAssetSeed);

      // Asset distribution should differ across the map
      let differences = 0;
      for (const { coord } of terrainMap1.entries()) {
        if (assetMap1.get(coord)?.value !== assetMap2.get(coord)?.value) {
          differences++;
        }
      }
      expect(differences).toBeGreaterThan(0);
    });
  });

  describe("Task 019-E: Missing Asset Fallback on Large Map", () => {
    it("should render fallback entries for Sand cells while preserving status=ready", async () => {
      const editor = new EditorCore(
        { generator, assetRegistry, terrainRegistry, assetLoader, geometry: hexGeometry, viewport },
        { initialSeed: 77777, initialScale: 180, initialBounds: { minCol: 0, maxCol: 14, minRow: 0, maxRow: 14 } }
      );

      await editor.generate();
      const state = editor.getState();

      expect(state.status).toBe("ready");
      const fallbacks = editor.getRenderFallbacks();
      expect(fallbacks.length).toBeGreaterThan(0);

      // Every fallback entry must correspond to sand terrain
      for (const fb of fallbacks) {
        expect(fb.terrainId).toBe("sand");
        expect(fb.label).toBe("Sand");
      }
    });
  });

  describe("Task 019-H: Viewport Navigation & Centering on Large Map", () => {
    it("should center viewport on 50x50 grid correctly without coordinate drift", () => {
      const editor = new EditorCore(
        { generator, assetRegistry, terrainRegistry, assetLoader, geometry: hexGeometry, viewport },
        { initialSeed: 99999, initialScale: 250, initialBounds: { minCol: 0, maxCol: 49, minRow: 0, maxRow: 49 } }
      );

      editor.centerOnGrid({ x: 1920, y: 1080 }, 0.5);
      const state = editor.getState();
      expect(state.zoom).toBe(0.5);

      // Verify world coordinates map back accurately around center
      const centerCoord = new HexCoordinate(25, 25);
      const centerWorld = hexGeometry.hexToPixel(centerCoord);
      const screenPoint = viewport.worldToScreen(centerWorld);
      const roundTripWorld = viewport.screenToWorld(screenPoint);

      expect(Math.round(roundTripWorld.x)).toBe(Math.round(centerWorld.x));
      expect(Math.round(roundTripWorld.y)).toBe(Math.round(centerWorld.y));
    });
  });
});
