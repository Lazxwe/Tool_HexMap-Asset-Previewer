import { describe, it, expect } from "vitest";
import { HexCoordinate } from "../../src/domain/hex/HexCoordinate";
import { TerrainDefinition } from "../../src/domain/terrain/TerrainDefinition";
import { TerrainId } from "../../src/domain/terrain/TerrainId";
import { TerrainMap } from "../../src/domain/terrain/TerrainMap";
import { TerrainRegistry } from "../../src/domain/terrain/TerrainRegistry";
import { ProjectDeserializer } from "../../src/persistence/ProjectDeserializer";
import { ProjectSerializer } from "../../src/persistence/ProjectSerializer";
import { PersistableMapState } from "../../src/persistence/ProjectTypes";

describe("ProjectDeserializer", () => {
  const serializer = new ProjectSerializer();
  const deserializer = new ProjectDeserializer();

  it("A. should parse valid JSON string and deserialize into PersistableMapState", () => {
    const json = JSON.stringify({
      formatVersion: 1,
      metadata: { name: "Sample Map" },
      bounds: { minCol: 0, maxCol: 4, minRow: 0, maxRow: 4 },
      terrainMap: [
        { col: 0, row: 0, terrainId: "water" },
        { col: 1, row: 2, terrainId: "forest" },
      ],
      generation: {
        seed: 45678,
        scale: 250,
      },
    });

    const state = deserializer.parse(json);

    expect(state.name).toBe("Sample Map");
    expect(state.bounds).toEqual({ minCol: 0, maxCol: 4, minRow: 0, maxRow: 4 });
    expect(state.generation?.seed).toBe(45678);
    expect(state.generation?.scale).toBe(250);

    expect(state.terrainMap.size).toBe(2);
    expect(state.terrainMap.get(new HexCoordinate(0, 0))?.value).toBe("water");
    expect(state.terrainMap.get(new HexCoordinate(1, 2))?.value).toBe("forest");
  });

  it("B. should parse minimalist JSON with only terrainMap and infer bounds", () => {
    const json = JSON.stringify({
      formatVersion: 1,
      terrainMap: [
        { col: 2, row: 3, terrainId: "sand" },
        { col: 7, row: 8, terrainId: "mountain" },
      ],
    });

    const state = deserializer.parse(json);
    expect(state.bounds).toEqual({ minCol: 2, maxCol: 7, minRow: 3, maxRow: 8 });
    expect(state.terrainMap.size).toBe(2);
  });

  it("E. should achieve exact round-trip preservation (serialize -> stringify -> parse -> deserialize)", () => {
    const originalTerrainMap = new TerrainMap();
    originalTerrainMap.set(new HexCoordinate(-3, -1), new TerrainId("mountain"));
    originalTerrainMap.set(new HexCoordinate(0, 0), new TerrainId("sand"));
    originalTerrainMap.set(new HexCoordinate(4, 8), new TerrainId("forest"));

    const originalState: PersistableMapState = {
      bounds: { minCol: -5, maxCol: 10, minRow: -5, maxRow: 10 },
      terrainMap: originalTerrainMap,
      name: "Roundtrip Map",
      generation: { seed: 88888, scale: 120 },
    };

    // 1. Serialize and stringify
    const json = serializer.stringify(originalState);

    // 2. Parse and deserialize
    const restoredState = deserializer.parse(json);

    // 3. Verify semantic equality
    expect(restoredState.bounds).toEqual(originalState.bounds);
    expect(restoredState.name).toBe(originalState.name);
    expect(restoredState.generation).toEqual(originalState.generation);

    expect(restoredState.terrainMap.size).toBe(originalState.terrainMap.size);
    for (const entry of originalState.terrainMap.entries()) {
      expect(restoredState.terrainMap.get(entry.coord)?.value).toBe(entry.terrainId.value);
    }
  });

  it("G. should safely reject malformed JSON strings", () => {
    expect(() => deserializer.parse("")).toThrow(/Input string is empty/);
    expect(() => deserializer.parse("   ")).toThrow(/Input string is empty/);
    expect(() => deserializer.parse("{")).toThrow(/Failed to parse project JSON/);
    expect(() => deserializer.parse("not json")).toThrow(/Failed to parse project JSON/);
    expect(() => deserializer.parse("[]")).toThrow(/Expected a JSON object/);
    expect(() => deserializer.parse("null")).toThrow(/Expected a JSON object/);
  });

  it("K. should deserialize empty project state cleanly", () => {
    const json = JSON.stringify({
      formatVersion: 1,
      bounds: { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 },
      terrainMap: [],
    });

    const state = deserializer.parse(json);
    expect(state.terrainMap.size).toBe(0);
    expect(state.bounds).toEqual({ minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 });
  });

  it("L. should safely parse empty terrainMap with omitted bounds using canonical empty bounds", () => {
    const json = JSON.stringify({
      formatVersion: 1,
      terrainMap: [],
    });

    const state = deserializer.parse(json);
    expect(state.terrainMap.size).toBe(0);
    expect(state.bounds).toEqual({ minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 });
  });

  it("M. should safely ignore legacy assetMap and viewport without restoring them", () => {
    const json = JSON.stringify({
      formatVersion: 1,
      bounds: { minCol: 0, maxCol: 1, minRow: 0, maxRow: 1 },
      terrainMap: [{ col: 0, row: 0, terrainId: "grass" }],
      assetMap: [{ col: 0, row: 0, assetId: "grass_01" }],
      viewport: { zoom: 2.5, panX: 100, panY: -50 },
    });

    const state = deserializer.parse(json);
    expect(state.terrainMap.size).toBe(1);
    expect(state.terrainMap.get(new HexCoordinate(0, 0))?.value).toBe("grass");

    const rawKeys = Object.keys(state);
    expect(rawKeys).not.toContain("assetMap");
    expect(rawKeys).not.toContain("viewport");
  });

  it("N. should validate terrainId against TerrainRegistry during deserialization", () => {
    const registry = new TerrainRegistry();
    registry.register(new TerrainDefinition({ id: "water", displayName: "Water" }));
    registry.register(new TerrainDefinition({ id: "forest", displayName: "Forest" }));

    // Valid terrainId succeeds
    const validJson = JSON.stringify({
      formatVersion: 1,
      terrainMap: [{ col: 0, row: 0, terrainId: "water" }],
    });
    const parsedValid = deserializer.parse(validJson, registry);
    expect(parsedValid.terrainMap.size).toBe(1);

    // Unknown terrainId throws validation error
    const unknownJson = JSON.stringify({
      formatVersion: 1,
      terrainMap: [{ col: 0, row: 0, terrainId: "lava" }],
    });
    expect(() => deserializer.parse(unknownJson, registry)).toThrow('Unknown terrainId: "lava"');
  });
});
