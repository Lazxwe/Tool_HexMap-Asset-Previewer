import { describe, it, expect } from "vitest";
import { HexCoordinate } from "../../src/domain/hex/HexCoordinate";
import { TerrainId } from "../../src/domain/terrain/TerrainId";
import { TerrainMap } from "../../src/domain/terrain/TerrainMap";
import { ProjectSerializer } from "../../src/persistence/ProjectSerializer";
import { CURRENT_PROJECT_FORMAT_VERSION, PersistableMapState } from "../../src/persistence/ProjectTypes";

describe("ProjectSerializer", () => {
  const serializer = new ProjectSerializer();

  it("A. should correctly serialize map state into ProjectDocument without assetMap", () => {
    const terrainMap = new TerrainMap();
    terrainMap.set(new HexCoordinate(0, 0), new TerrainId("water"));
    terrainMap.set(new HexCoordinate(1, 0), new TerrainId("forest"));

    const state: PersistableMapState = {
      bounds: { minCol: 0, maxCol: 5, minRow: 0, maxRow: 5 },
      terrainMap,
      name: "My Map Project",
      generation: { seed: 12345, scale: 180 },
    };

    const doc = serializer.serialize(state);

    expect(doc.formatVersion).toBe(CURRENT_PROJECT_FORMAT_VERSION);
    expect(doc.metadata?.name).toBe("My Map Project");
    expect(doc.bounds).toEqual({ minCol: 0, maxCol: 5, minRow: 0, maxRow: 5 });
    expect(doc.generation?.seed).toBe(12345);
    expect(doc.generation?.scale).toBe(180);
    expect(doc.terrainMap).toEqual([
      { col: 0, row: 0, terrainId: "water" },
      { col: 1, row: 0, terrainId: "forest" },
    ]);
    expect(doc.assetMap).toBeUndefined();
  });

  it("B. should serialize to formatted JSON string", () => {
    const state: PersistableMapState = {
      bounds: { minCol: -1, maxCol: 1, minRow: -1, maxRow: 1 },
      terrainMap: new TerrainMap(),
      generation: { seed: 999, scale: 200 },
    };

    const json = serializer.stringify(state, 2);
    expect(typeof json).toBe("string");

    const parsed = JSON.parse(json);
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.bounds).toEqual({ minCol: -1, maxCol: 1, minRow: -1, maxRow: 1 });
    expect(parsed.generation.seed).toBe(999);
  });

  it("C. should serialize spatial maps with negative, zero, and positive coordinates", () => {
    const terrainMap = new TerrainMap();
    terrainMap.set(new HexCoordinate(-2, -3), new TerrainId("mountain"));
    terrainMap.set(new HexCoordinate(0, 0), new TerrainId("plains"));
    terrainMap.set(new HexCoordinate(5, 7), new TerrainId("water"));

    const state: PersistableMapState = {
      bounds: { minCol: -5, maxCol: 10, minRow: -5, maxRow: 10 },
      terrainMap,
    };

    const doc = serializer.serialize(state);
    expect(doc.terrainMap).toEqual([
      { col: -2, row: -3, terrainId: "mountain" },
      { col: 0, row: 0, terrainId: "plains" },
      { col: 5, row: 7, terrainId: "water" },
    ]);
  });

  it("D. should serialize entries in deterministic (col ASC, row ASC) order regardless of insertion sequence", () => {
    // Map A: inserted in random order
    const terrainMapA = new TerrainMap();
    terrainMapA.set(new HexCoordinate(2, 1), new TerrainId("t1"));
    terrainMapA.set(new HexCoordinate(-1, 0), new TerrainId("t2"));
    terrainMapA.set(new HexCoordinate(0, 5), new TerrainId("t3"));
    terrainMapA.set(new HexCoordinate(-1, -2), new TerrainId("t4"));
    terrainMapA.set(new HexCoordinate(0, -1), new TerrainId("t5"));

    // Map B: inserted in different reverse order
    const terrainMapB = new TerrainMap();
    terrainMapB.set(new HexCoordinate(0, -1), new TerrainId("t5"));
    terrainMapB.set(new HexCoordinate(0, 5), new TerrainId("t3"));
    terrainMapB.set(new HexCoordinate(-1, -2), new TerrainId("t4"));
    terrainMapB.set(new HexCoordinate(2, 1), new TerrainId("t1"));
    terrainMapB.set(new HexCoordinate(-1, 0), new TerrainId("t2"));

    const stateA: PersistableMapState = {
      bounds: { minCol: -2, maxCol: 2, minRow: -2, maxRow: 5 },
      terrainMap: terrainMapA,
    };

    const stateB: PersistableMapState = {
      bounds: { minCol: -2, maxCol: 2, minRow: -2, maxRow: 5 },
      terrainMap: terrainMapB,
    };

    const jsonA = serializer.stringify(stateA);
    const jsonB = serializer.stringify(stateB);

    expect(jsonA).toBe(jsonB);
    const doc = serializer.serialize(stateA);
    expect(doc.terrainMap).toEqual([
      { col: -1, row: -2, terrainId: "t4" },
      { col: -1, row: 0, terrainId: "t2" },
      { col: 0, row: -1, terrainId: "t5" },
      { col: 0, row: 5, terrainId: "t3" },
      { col: 2, row: 1, terrainId: "t1" },
    ]);
  });

  it("J. should strictly exclude runtime transient properties, assetMap, and viewport from serialized document", () => {
    const state: PersistableMapState = {
      bounds: { minCol: 0, maxCol: 2, minRow: 0, maxRow: 2 },
      terrainMap: new TerrainMap(),
    };

    const doc = serializer.serialize(state);
    const rawKeys = Object.keys(doc);

    expect(rawKeys).not.toContain("assetMap");
    expect(rawKeys).not.toContain("viewport");
    expect(rawKeys).not.toContain("status");
    expect(rawKeys).not.toContain("hoveredHex");
    expect(rawKeys).not.toContain("errorMessage");
    expect(rawKeys).not.toContain("LoadedAsset");
    expect(rawKeys).not.toContain("image");
  });

  it("K. should serialize empty project state cleanly", () => {
    const state: PersistableMapState = {
      bounds: { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 },
      terrainMap: new TerrainMap(),
    };

    const doc = serializer.serialize(state);
    expect(doc.terrainMap).toEqual([]);
    expect(doc.assetMap).toBeUndefined();
  });
});
