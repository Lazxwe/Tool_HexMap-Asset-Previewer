import { describe, it, expect, beforeEach, vi } from "vitest";
import { TerrainAsset } from "../../src/domain/asset/TerrainAsset";
import { TerrainAssetRegistry } from "../../src/domain/asset/TerrainAssetRegistry";
import { HexCoordinate } from "../../src/domain/hex/HexCoordinate";
import { HexGeometry } from "../../src/domain/hex/HexGeometry";
import { TerrainDefinition } from "../../src/domain/terrain/TerrainDefinition";
import { TerrainId } from "../../src/domain/terrain/TerrainId";
import { TerrainRegistry } from "../../src/domain/terrain/TerrainRegistry";
import { deriveAssetSeed, EditorCore } from "../../src/editor/EditorCore";
import { SeededNoiseField } from "../../src/generation/SeededNoiseField";
import { TerrainClassifier } from "../../src/generation/TerrainClassification";
import { TerrainGenerator } from "../../src/generation/TerrainGenerator";
import { AssetLoader } from "../../src/infrastructure/asset/AssetLoader";
import { Viewport } from "../../src/rendering/Viewport";
import { MockImageDecoder } from "../infrastructure/asset/MockImageDecoder";

describe("EditorCore", () => {
  let terrainRegistry: TerrainRegistry;
  let assetRegistry: TerrainAssetRegistry;
  let hexGeometry: HexGeometry;
  let classifier: TerrainClassifier;
  let noise: SeededNoiseField;
  let generator: TerrainGenerator;
  let mockDecoder: MockImageDecoder;
  let assetLoader: AssetLoader;
  let viewport: Viewport;
  let editor: EditorCore;

  beforeEach(() => {
    // 1. Terrain Domain
    terrainRegistry = new TerrainRegistry();
    terrainRegistry.register(new TerrainDefinition({ id: "water", displayName: "Water" }));
    terrainRegistry.register(new TerrainDefinition({ id: "sand", displayName: "Sand" }));
    terrainRegistry.register(new TerrainDefinition({ id: "forest", displayName: "Forest" }));
    terrainRegistry.register(new TerrainDefinition({ id: "mountain", displayName: "Mountain" }));

    // 2. Asset Domain
    assetRegistry = new TerrainAssetRegistry();
    assetRegistry.register(new TerrainAsset({ id: "water_01", terrainId: "water", name: "Water 1", source: "assets/water_01.png", weight: 10 }));
    assetRegistry.register(new TerrainAsset({ id: "water_02", terrainId: "water", name: "Water 2", source: "assets/water_02.png", weight: 5 }));
    assetRegistry.register(new TerrainAsset({ id: "sand_01", terrainId: "sand", name: "Sand 1", source: "assets/sand_01.png", weight: 10 }));
    assetRegistry.register(new TerrainAsset({ id: "forest_01", terrainId: "forest", name: "Forest 1", source: "assets/forest_01.png", weight: 10 }));
    assetRegistry.register(new TerrainAsset({ id: "forest_02", terrainId: "forest", name: "Forest 2", source: "assets/forest_02.png", weight: 5 }));
    assetRegistry.register(new TerrainAsset({ id: "mountain_01", terrainId: "mountain", name: "Mountain 1", source: "assets/mountain_01.png", weight: 10 }));

    // 3. Geometry & Classifier
    hexGeometry = new HexGeometry(120, 70);
    classifier = new TerrainClassifier([
      { terrainId: new TerrainId("water"), max: 0.35 },
      { terrainId: new TerrainId("sand"), max: 0.52 },
      { terrainId: new TerrainId("forest"), max: 0.78 },
      { terrainId: new TerrainId("mountain"), max: 1.0 },
    ]);

    noise = new SeededNoiseField(12345);
    generator = new TerrainGenerator(noise, hexGeometry, classifier);

    // 4. Infrastructure & Viewport
    mockDecoder = new MockImageDecoder();
    assetLoader = new AssetLoader(mockDecoder);
    viewport = new Viewport({ zoom: 1.0, panX: 0, panY: 0 });

    // 5. EditorCore instance
    editor = new EditorCore(
      {
        generator,
        assetRegistry,
        terrainRegistry,
        assetLoader,
        geometry: hexGeometry,
        viewport,
      },
      {
        initialSeed: 12345,
        initialScale: 180,
        initialBounds: { minCol: 0, maxCol: 4, minRow: 0, maxRow: 4 },
      }
    );
  });

  describe("A. State Management & Initial Defaults", () => {
    it("should initialize with expected default state", () => {
      const state = editor.getState();
      expect(state.seed).toBe(12345);
      expect(state.scale).toBe(180);
      expect(state.bounds).toEqual({ minCol: 0, maxCol: 4, minRow: 0, maxRow: 4 });
      expect(state.status).toBe("idle");
      expect(state.hoveredHex).toBeNull();
      expect(state.zoom).toBe(1.0);
      expect(state.panX).toBe(0);
      expect(state.panY).toBe(0);
      expect(state.terrainMap.size).toBe(0);
      expect(state.assetMap.size).toBe(0);
    });

    it("should update seed and notify listeners", () => {
      const listener = vi.fn();
      const unsubscribe = editor.subscribe(listener);

      editor.setSeed(99999);

      expect(editor.getState().seed).toBe(99999);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(editor.getState());

      unsubscribe();
      editor.setSeed(88888);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should update scale and validate positive bounds", () => {
      editor.setScale(250);
      expect(editor.getState().scale).toBe(250);

      expect(() => editor.setScale(0)).toThrow(/Invalid scale/);
      expect(() => editor.setScale(-50)).toThrow(/Invalid scale/);
    });

    it("should update hoveredHex and deduplicate redundant updates", () => {
      const listener = vi.fn();
      editor.subscribe(listener);

      const hex1 = new HexCoordinate(1, 2);
      editor.setHoveredHex(hex1);
      expect(editor.getState().hoveredHex?.toKey()).toBe("1,2");
      expect(listener).toHaveBeenCalledTimes(1);

      // Redundant set with equal coordinate should not re-notify
      editor.setHoveredHex(new HexCoordinate(1, 2));
      expect(listener).toHaveBeenCalledTimes(1);

      editor.setHoveredHex(null);
      expect(editor.getState().hoveredHex).toBeNull();
      expect(listener).toHaveBeenCalledTimes(2);

      // Redundant null should not re-notify
      editor.setHoveredHex(null);
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe("B. Generation Pipeline Assembly", () => {
    it("should coordinate generator -> selector -> loader -> render stamps", async () => {
      const statusTransitions: string[] = [];
      editor.subscribe((state) => {
        statusTransitions.push(state.status);
      });

      await editor.generate();

      const state = editor.getState();
      expect(state.status).toBe("ready");
      expect(state.terrainMap.size).toBe(25); // 5x5 grid
      expect(state.assetMap.size).toBe(25);

      const stamps = editor.getRenderStamps();
      expect(stamps.length).toBe(25);

      // Verify status transitions: generating -> loading-assets -> ready
      expect(statusTransitions).toContain("generating");
      expect(statusTransitions).toContain("loading-assets");
      expect(statusTransitions).toContain("ready");
    });
  });

  describe("C. Deterministic Regeneration", () => {
    it("should produce identical TerrainMap and HexAssetMap when given the same seed and scale", async () => {
      await editor.generate();
      const firstTerrainMap = editor.getState().terrainMap;
      const firstAssetMap = editor.getState().assetMap;

      // Re-run generation with same seed
      await editor.regenerate();
      const secondTerrainMap = editor.getState().terrainMap;
      const secondAssetMap = editor.getState().assetMap;

      expect(secondTerrainMap.size).toBe(firstTerrainMap.size);
      for (const entry of firstTerrainMap.entries()) {
        expect(secondTerrainMap.get(entry.coord)?.value).toBe(entry.terrainId.value);
      }

      expect(secondAssetMap.size).toBe(firstAssetMap.size);
      for (const entry of firstAssetMap.entries()) {
        expect(secondAssetMap.get(entry.coord)?.value).toBe(entry.assetId.value);
      }
    });

    it("should produce different map distributions for different seeds", async () => {
      await editor.regenerate(11111);
      const firstTerrainEntries = Array.from(editor.getState().terrainMap.entries()).map(
        (e) => `${e.coord.toKey()}:${e.terrainId.value}`
      );

      await editor.regenerate(99999);
      const secondTerrainEntries = Array.from(editor.getState().terrainMap.entries()).map(
        (e) => `${e.coord.toKey()}:${e.terrainId.value}`
      );

      expect(firstTerrainEntries).not.toEqual(secondTerrainEntries);
    });

    it("should derive deterministic independent asset seeds", () => {
      const seed1 = 12345;
      const seed2 = 12345;
      const seed3 = 54321;

      expect(deriveAssetSeed(seed1)).toBe(deriveAssetSeed(seed2));
      expect(deriveAssetSeed(seed1)).not.toBe(deriveAssetSeed(seed3));
    });
  });

  describe("D. Asset Loading Deduplication", () => {
    it("should decode each unique visual asset only once despite multiple hex assignments", async () => {
      expect(mockDecoder.decodeCount).toBe(0);

      await editor.generate();

      // In a 5x5 map with 4 terrain categories and 6 registered assets,
      // decodeCount should be <= 6 (number of unique assets registered), not 25.
      expect(mockDecoder.decodeCount).toBeLessThanOrEqual(6);
      expect(mockDecoder.decodeCount).toBeGreaterThanOrEqual(1);

      const decodeCountAfterFirstRun = mockDecoder.decodeCount;

      // Re-generating with identical or similar map reuses in-memory cache
      await editor.regenerate();
      expect(mockDecoder.decodeCount).toBe(decodeCountAfterFirstRun);
    });
  });

  describe("E. Error Handling & Transactional State Commit", () => {
    it("should preserve previous valid state and set status to error when TerrainGenerator fails", async () => {
      // 1. Establish valid first state
      await editor.generate();
      const validTerrainMap = editor.getState().terrainMap;
      const validAssetMap = editor.getState().assetMap;
      expect(editor.getState().status).toBe("ready");

      // 2. Mock generator failure
      const genSpy = vi.spyOn(TerrainGenerator.prototype, "generate").mockImplementationOnce(() => {
        throw new Error("Simulated generator crash");
      });

      // 3. Attempt generation
      await editor.generate();
      genSpy.mockRestore();

      // 4. Verify state integrity: error recorded, previous map retained
      const state = editor.getState();
      expect(state.status).toBe("error");
      expect(state.errorMessage).toBe("Simulated generator crash");
      expect(state.terrainMap).toBe(validTerrainMap);
      expect(state.assetMap).toBe(validAssetMap);
      expect(state.terrainMap.size).toBe(25);
    });

    it("should preserve previous valid state when AssetLoader fails", async () => {
      await editor.generate();
      const validTerrainMap = editor.getState().terrainMap;
      const validAssetMap = editor.getState().assetMap;
      const validStamps = editor.getRenderStamps();

      mockDecoder.shouldFail = true;
      mockDecoder.failureMessage = "Network timeout";

      // Clear asset loader cache to force reload attempt
      assetLoader.clear();

      await editor.generate();

      const state = editor.getState();
      expect(state.status).toBe("error");
      expect(state.errorMessage).toContain("Network timeout");
      expect(state.terrainMap).toBe(validTerrainMap);
      expect(state.assetMap).toBe(validAssetMap);
      expect(editor.getRenderStamps()).toBe(validStamps);
      expect(editor.getRenderStamps().length).toBe(25);
    });

    it("should prevent async race condition (latest-wins) when an older generation resolves after a newer one", async () => {
      let unblockA: () => void = () => {};
      const blockPromise = new Promise<void>((resolve) => {
        unblockA = resolve;
      });

      // Clear loader cache so decoding is triggered
      assetLoader.clear();

      let callCount = 0;
      const originalDecode = mockDecoder.decodeFromUrl.bind(mockDecoder);
      const decodeSpy = vi.spyOn(mockDecoder, "decodeFromUrl").mockImplementation(async (url: string) => {
        callCount++;
        if (callCount === 1) {
          // Block the first decode call belonging to Generation A
          await blockPromise;
        }
        return originalDecode(url);
      });

      // Launch Generation A (its decode will wait for unblockA)
      editor.setSeed(10001);
      const promiseA = editor.generate();

      // Microtask tick to ensure Generation A enters decodeFromUrl and pauses on blockPromise
      await new Promise((r) => setTimeout(r, 10));

      // Launch Generation B immediately with new seed
      editor.setSeed(20002);
      const promiseB = editor.generate();

      // Unblock Generation A while Generation B is active
      unblockA();

      // Await both promises to complete
      await Promise.all([promiseA, promiseB]);
      decodeSpy.mockRestore();

      // State must be committed for Generation B, and NOT overwritten by Generation A
      const finalState = editor.getState();
      expect(finalState.seed).toBe(20002);
      expect(finalState.status).toBe("ready");
    });
  });

  describe("F. Viewport Interaction Integration", () => {
    it("should handle panBy delta updates and sync with EditorState", () => {
      editor.panBy(100, -50);

      expect(editor.viewport.panX).toBe(100);
      expect(editor.viewport.panY).toBe(-50);
      expect(editor.getState().panX).toBe(100);
      expect(editor.getState().panY).toBe(-50);
    });

    it("should handle zoomAt around cursor anchor without drifting", () => {
      const anchor = { x: 300, y: 200 };
      const worldBefore = editor.viewport.screenToWorld(anchor);

      editor.zoomAt(anchor.x, anchor.y, 1.5);

      expect(editor.getState().zoom).toBe(1.5);
      const worldAfter = editor.viewport.screenToWorld(anchor);

      expect(worldAfter.x).toBeCloseTo(worldBefore.x, 5);
      expect(worldAfter.y).toBeCloseTo(worldBefore.y, 5);
    });

    it("should center viewport on map grid bounds", () => {
      editor.centerOnGrid({ x: 800, y: 600 }, 1.0);

      expect(editor.getState().zoom).toBe(1.0);
      // World center of (2, 2) is at (120 * (2 * 0.75 + 0.5), 70 * (2 + 0.5 + 0)) = (240, 175)
      // Pan should center this at (400, 300)
      expect(editor.getState().panX).toBeCloseTo(400 - 240, 1);
      expect(editor.getState().panY).toBeCloseTo(300 - 175, 1);
    });
  });

  describe("G. Seed & PRNG Isolation Across Interleaved Instances", () => {
    it("should produce identical maps when two independent EditorCore instances are interleaved", async () => {
      const editorA = new EditorCore(
        {
          generator: new TerrainGenerator(noise, hexGeometry, classifier),
          assetRegistry,
          terrainRegistry,
          assetLoader: new AssetLoader(new MockImageDecoder()),
          geometry: hexGeometry,
        },
        { initialSeed: 77777, initialScale: 150, initialBounds: { minCol: 0, maxCol: 3, minRow: 0, maxRow: 3 } }
      );

      const editorB = new EditorCore(
        {
          generator: new TerrainGenerator(noise, hexGeometry, classifier),
          assetRegistry,
          terrainRegistry,
          assetLoader: new AssetLoader(new MockImageDecoder()),
          geometry: hexGeometry,
        },
        { initialSeed: 77777, initialScale: 150, initialBounds: { minCol: 0, maxCol: 3, minRow: 0, maxRow: 3 } }
      );

      // Interleaved operations
      editorA.panBy(50, 50);
      editorB.zoomAt(100, 100, 1.2);
      editorA.setHoveredHex(new HexCoordinate(1, 1));

      await Promise.all([editorA.generate(), editorB.generate()]);

      const stateA = editorA.getState();
      const stateB = editorB.getState();

      expect(stateA.terrainMap.size).toBe(stateB.terrainMap.size);
      for (const entry of stateA.terrainMap.entries()) {
        expect(stateB.terrainMap.get(entry.coord)?.value).toBe(entry.terrainId.value);
      }

      expect(stateA.assetMap.size).toBe(stateB.assetMap.size);
      for (const entry of stateA.assetMap.entries()) {
        expect(stateB.assetMap.get(entry.coord)?.value).toBe(entry.assetId.value);
      }
    });

    it("should maintain snapshot isolation and never mutate previously returned EditorState", async () => {
      await editor.generate();
      const snapshot1 = editor.getState();
      const terrainCount1 = snapshot1.terrainMap.size;
      const assetCount1 = snapshot1.assetMap.size;

      // Regenerate with different seed
      await editor.regenerate(88888);
      const snapshot2 = editor.getState();

      expect(snapshot1).not.toBe(snapshot2);
      expect(snapshot1.seed).toBe(12345);
      expect(snapshot2.seed).toBe(88888);
      expect(snapshot1.terrainMap.size).toBe(terrainCount1);
      expect(snapshot1.assetMap.size).toBe(assetCount1);
    });

    it("should export clean PersistableMapState containing domain map data and bounds", async () => {
      await editor.generate();
      const persistable = editor.exportPersistenceState();

      expect(persistable.bounds).toEqual({ minCol: 0, maxCol: 4, minRow: 0, maxRow: 4 });
      expect(persistable.terrainMap.size).toBe(25);
      expect(persistable.generation?.seed).toBe(12345);
      expect(persistable.generation?.scale).toBe(180);

      // Verify it does not contain runtime fields or assetMap
      const rawKeys = Object.keys(persistable);
      expect(rawKeys).not.toContain("assetMap");
      expect(rawKeys).not.toContain("status");
      expect(rawKeys).not.toContain("hoveredHex");
      expect(rawKeys).not.toContain("errorMessage");
    });
  });

  describe("H. Dual Input Sources & Missing Asset Fallback (Task 012)", () => {
    it("should load map from JSON source without invoking TerrainGenerator", async () => {
      const generateSpy = vi.spyOn(TerrainGenerator.prototype, "generate");

      const mapJson = JSON.stringify({
        formatVersion: 1,
        metadata: { name: "Custom JSON Map" },
        bounds: { minCol: 0, maxCol: 1, minRow: 0, maxRow: 1 },
        terrainMap: [
          { col: 0, row: 0, terrainId: "water" },
          { col: 0, row: 1, terrainId: "forest" },
          { col: 1, row: 0, terrainId: "sand" },
          { col: 1, row: 1, terrainId: "mountain" },
        ],
      });

      await editor.loadJson(mapJson, "custom.json");

      expect(generateSpy).not.toHaveBeenCalled();
      const state = editor.getState();
      expect(state.status).toBe("ready");
      expect(state.mapSource.kind).toBe("json");
      expect(state.terrainMap.size).toBe(4);
      expect(state.assetMap.size).toBe(4);
      expect(editor.getRenderStamps().length).toBe(4);

      generateSpy.mockRestore();
    });

    it("should gracefully handle terrain categories without registered assets via fallback rendering", async () => {
      // Register a new terrain category "volcano" with NO registered visual assets
      terrainRegistry.register(new TerrainDefinition({ id: "volcano", displayName: "Active Volcano" }));

      const mapJson = JSON.stringify({
        formatVersion: 1,
        bounds: { minCol: 0, maxCol: 1, minRow: 0, maxRow: 0 },
        terrainMap: [
          { col: 0, row: 0, terrainId: "forest" },
          { col: 1, row: 0, terrainId: "volcano" },
        ],
      });

      await editor.loadJson(mapJson, "volcano_map.json");

      const state = editor.getState();
      // Must NOT fail or enter error state!
      expect(state.status).toBe("ready");
      expect(state.errorMessage).toBeUndefined();

      // Forest has stamp, volcano has fallback
      expect(state.terrainMap.size).toBe(2);
      expect(state.assetMap.size).toBe(1);
      expect(state.assetMap.has(new HexCoordinate(0, 0))).toBe(true);
      expect(state.assetMap.has(new HexCoordinate(1, 0))).toBe(false);

      expect(editor.getRenderStamps().length).toBe(1);
      const fallbacks = editor.getRenderFallbacks();
      expect(fallbacks.length).toBe(1);
      expect(fallbacks[0].coord.equals(new HexCoordinate(1, 0))).toBe(true);
      expect(fallbacks[0].terrainId).toBe("volcano");
      expect(fallbacks[0].label).toBe("Active Volcano");
    });

    it("should produce 100% deterministic assetMap for identical JSON and previewAssetSeed", async () => {
      // water has water_01 (weight 10) and water_02 (weight 5)
      const mapJson = JSON.stringify({
        formatVersion: 1,
        bounds: { minCol: 0, maxCol: 5, minRow: 0, maxRow: 5 },
        terrainMap: Array.from({ length: 36 }, (_, i) => ({
          col: i % 6,
          row: Math.floor(i / 6),
          terrainId: "water",
        })),
      });

      // Pass 1
      await editor.loadJson(mapJson, "water.json", 9999);
      const assetMap1 = editor.getState().assetMap;
      const snapshot1 = Array.from(assetMap1.entries()).map((e) => ({
        coord: `${e.coord.col},${e.coord.row}`,
        asset: e.assetId.value,
      }));

      // Pass 2 with same seed
      await editor.loadJson(mapJson, "water.json", 9999);
      const assetMap2 = editor.getState().assetMap;
      const snapshot2 = Array.from(assetMap2.entries()).map((e) => ({
        coord: `${e.coord.col},${e.coord.row}`,
        asset: e.assetId.value,
      }));

      expect(snapshot1).toEqual(snapshot2);

      // Pass 3 with different seed
      await editor.loadJson(mapJson, "water.json", 1111);
      const assetMap3 = editor.getState().assetMap;
      const snapshot3 = Array.from(assetMap3.entries()).map((e) => ({
        coord: `${e.coord.col},${e.coord.row}`,
        asset: e.assetId.value,
      }));

      expect(snapshot3).not.toEqual(snapshot1);
    });

    it("should allow rerolling assets without mutating TerrainMap", async () => {
      const mapJson = JSON.stringify({
        formatVersion: 1,
        bounds: { minCol: 0, maxCol: 3, minRow: 0, maxRow: 3 },
        terrainMap: Array.from({ length: 16 }, (_, i) => ({
          col: i % 4,
          row: Math.floor(i / 4),
          terrainId: "water",
        })),
      });

      await editor.loadJson(mapJson, "water.json", 123);
      const initialTerrainMap = editor.getState().terrainMap;
      const initialAssetMap = editor.getState().assetMap;

      await editor.rerollAssets(456);
      const updatedTerrainMap = editor.getState().terrainMap;
      const updatedAssetMap = editor.getState().assetMap;

      expect(updatedTerrainMap).toBe(initialTerrainMap); // Same reference & unchanged
      expect(updatedAssetMap).not.toBe(initialAssetMap);
      expect(editor.getState().previewAssetSeed).toBe(456);
    });

    it("should not pollute Built-in generation determinism when interleaved with JSON loading", async () => {
      const fixedBounds = { minCol: 0, maxCol: 4, minRow: 0, maxRow: 4 };

      // 1. Built-in run 1
      await editor.loadSource({ kind: "builtin", seed: 77777, scale: 180, bounds: fixedBounds });
      const builtinMap1 = Array.from(editor.getState().terrainMap.entries()).map((e) => e.terrainId.value);
      const builtinAssets1 = Array.from(editor.getState().assetMap.entries()).map((e) => e.assetId.value);

      // 2. Interleaved JSON run
      const mapJson = JSON.stringify({
        formatVersion: 1,
        terrainMap: [{ col: 0, row: 0, terrainId: "forest" }],
      });
      await editor.loadJson(mapJson, "interleaved.json", 333);

      // 3. Built-in run 2 with same seed & bounds
      await editor.loadSource({ kind: "builtin", seed: 77777, scale: 180, bounds: fixedBounds });
      const builtinMap2 = Array.from(editor.getState().terrainMap.entries()).map((e) => e.terrainId.value);
      const builtinAssets2 = Array.from(editor.getState().assetMap.entries()).map((e) => e.assetId.value);

      expect(builtinMap1).toEqual(builtinMap2);
      expect(builtinAssets1).toEqual(builtinAssets2);
    });

    it("should reject unknown terrainId during loadJson and transactionally preserve previous valid map", async () => {
      // 1. Establish valid map A
      await editor.loadSource({ kind: "builtin", seed: 12345, scale: 180 });
      const initialMapSize = editor.getState().terrainMap.size;
      const initialAssetMapSize = editor.getState().assetMap.size;
      const initialStamps = editor.getRenderStamps();

      // 2. Load JSON with unknown terrainId "lava"
      const invalidJson = JSON.stringify({
        formatVersion: 1,
        terrainMap: [
          { col: 0, row: 0, terrainId: "water" },
          { col: 0, row: 1, terrainId: "lava" },
        ],
      });

      await editor.loadJson(invalidJson, "invalid_lava.json");

      // 3. Status must be "error", error message must mention "Unknown terrainId", and map A must remain intact!
      const state = editor.getState();
      expect(state.status).toBe("error");
      expect(state.errorMessage).toContain('Unknown terrainId: "lava"');
      expect(state.terrainMap.size).toBe(initialMapSize);
      expect(state.assetMap.size).toBe(initialAssetMapSize);
      expect(editor.getRenderStamps()).toBe(initialStamps);
    });

    it("should transactionally preserve previous map when loading malformed JSON syntax", async () => {
      await editor.loadSource({ kind: "builtin", seed: 12345, scale: 180 });
      const previousTerrainMap = editor.getState().terrainMap;

      await editor.loadJson("{ malformed json", "broken.json");

      const state = editor.getState();
      expect(state.status).toBe("error");
      expect(state.errorMessage).toContain("Failed to parse project JSON");
      expect(state.terrainMap).toBe(previousTerrainMap);
    });

    it("should update previewAssetSeed via setPreviewAssetSeed and recompute assets", async () => {
      await editor.generate();
      const initialTerrainMap = editor.getState().terrainMap;
      const initialAssetSeed = editor.getState().previewAssetSeed;

      await editor.setPreviewAssetSeed(initialAssetSeed + 100);

      expect(editor.getState().terrainMap).toBe(initialTerrainMap);
      expect(editor.getState().previewAssetSeed).toBe(initialAssetSeed + 100);
      expect(editor.getState().status).toBe("ready");
    });

    it("should register valid asset, re-select assets, and keep TerrainMap and previewAssetSeed unchanged", async () => {
      // 1. Initial generation
      await editor.generate();
      const initialTerrainMap = editor.getState().terrainMap;
      const initialAssetSeed = editor.getState().previewAssetSeed;
      const initialAssetMap = editor.getState().assetMap;

      // 2. Register new high-weight forest asset
      const newForestAsset = new TerrainAsset({
        id: "forest_heavy_01",
        terrainId: "forest",
        name: "Heavy Forest",
        source: "assets/forest_heavy_01.png",
        weight: 1000,
      });

      await editor.registerAsset(newForestAsset);

      // 3. Verify invariants
      expect(editor.assetRegistry.has("forest_heavy_01")).toBe(true);
      expect(editor.getState().terrainMap).toBe(initialTerrainMap); // Strict identity
      expect(editor.getState().previewAssetSeed).toBe(initialAssetSeed); // Strict equality
      expect(editor.getState().assetMap).not.toBe(initialAssetMap);
      expect(editor.getState().status).toBe("ready");

      // Verify new asset was selected for forest hexes
      const newAssetMap = editor.getState().assetMap;
      const hasHeavy = Array.from(newAssetMap.entries()).some(
        (e) => e.assetId.value === "forest_heavy_01"
      );
      expect(hasHeavy).toBe(true);
    });

    it("should reject registering asset with unknown terrainId", async () => {
      const invalidAsset = new TerrainAsset({
        id: "lava_01",
        terrainId: "lava",
        name: "Lava Pool",
        source: "assets/lava_01.png",
      });

      await expect(editor.registerAsset(invalidAsset)).rejects.toThrow(
        "Cannot register asset 'Lava Pool': Unknown terrainId 'lava'."
      );
      expect(editor.assetRegistry.has("lava_01")).toBe(false);
    });

    it("should allow registering asset with weight = 0 without error", async () => {
      const zeroWeightAsset = new TerrainAsset({
        id: "forest_dormant",
        terrainId: "forest",
        name: "Dormant Forest",
        source: "assets/forest_dormant.png",
        weight: 0,
      });

      await editor.registerAsset(zeroWeightAsset);
      expect(editor.assetRegistry.has("forest_dormant")).toBe(true);

      // Excluded from selection
      const assetMap = editor.getState().assetMap;
      const hasDormant = Array.from(assetMap.entries()).some(
        (e) => e.assetId.value === "forest_dormant"
      );
      expect(hasDormant).toBe(false);
    });

    it("should rollback newly registered asset from registry if loading fails", async () => {
      await editor.generate();
      const initialStamps = editor.getRenderStamps();

      // Mock loader error for a failing asset
      vi.spyOn(editor.assetLoader, "load").mockImplementation(async (asset) => {
        if (asset.id.value === "failing_asset") {
          throw new Error("Simulated network/decoding failure");
        }
        return {
          assetId: asset.id,
          source: asset.source,
          image: { width: 100, height: 100, nativeSource: {} as any },
          loadedAt: Date.now(),
        };
      });

      const failingAsset = new TerrainAsset({
        id: "failing_asset",
        terrainId: "water",
        name: "Broken Water",
        source: "broken.png",
        weight: 10000,
      });

      await editor.registerAsset(failingAsset);

      // 1. Registry must be rolled back
      expect(editor.assetRegistry.has("failing_asset")).toBe(false);
      // 2. Status should be error
      expect(editor.getState().status).toBe("error");
      expect(editor.getState().errorMessage).toContain("Simulated network/decoding failure");
      // 3. Previous stamps retained
      expect(editor.getRenderStamps()).toBe(initialStamps);
    });

    it("should update asset weight, recalculate HexAssetMap, and preserve TerrainMap and previewAssetSeed", async () => {
      await editor.generate();
      const initialTerrainMap = editor.getState().terrainMap;
      const initialAssetSeed = editor.getState().previewAssetSeed;
      const generateSpy = vi.spyOn(TerrainGenerator.prototype, "generate");

      // Set forest_01 weight to 0, and forest_02 weight to 100
      await editor.updateAssetWeight("forest_01", 0);
      await editor.updateAssetWeight("forest_02", 100);

      // Verify domain registry updated
      expect(editor.assetRegistry.get("forest_01")!.weight).toBe(0);
      expect(editor.assetRegistry.get("forest_02")!.weight).toBe(100);

      // Verify TerrainMap and seed invariants
      expect(editor.getState().terrainMap).toBe(initialTerrainMap);
      expect(editor.getState().previewAssetSeed).toBe(initialAssetSeed);
      expect(generateSpy).not.toHaveBeenCalled();

      // All forest hexes must now be assigned to forest_02 (since forest_01 weight = 0)
      for (const { coord, terrainId } of editor.getState().terrainMap.entries()) {
        if (terrainId.value === "forest") {
          const assignedAsset = editor.getState().assetMap.get(coord);
          expect(assignedAsset?.value).toBe("forest_02");
        }
      }

      generateSpy.mockRestore();
    });

    it("should reject updateAssetWeight for unknown assetId", async () => {
      await expect(editor.updateAssetWeight("unknown_asset", 5)).rejects.toThrow(
        /Asset with id 'unknown_asset' not found/
      );
    });
  });
});


