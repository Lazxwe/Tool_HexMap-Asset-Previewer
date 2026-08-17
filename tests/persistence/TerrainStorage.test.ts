import { describe, it, expect, beforeEach } from "vitest";
import { TerrainStorage } from "../../src/persistence/TerrainStorage";
import { TerrainConfigItem } from "../../src/domain/terrain/TerrainConfigTypes";

class MockStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("TerrainStorage", () => {
  let mockStorage: MockStorage;
  let terrainStorage: TerrainStorage;

  const sampleConfigs: TerrainConfigItem[] = [
    {
      id: "forest",
      displayName: "綠色森林",
      fallbackColor: "#15803d",
      generationWeight: 2.0,
      isEnabled: true,
    },
    {
      id: "mountain",
      displayName: "岩石高山",
      fallbackColor: "#475569",
      generationWeight: 1.0,
      isEnabled: false,
    },
  ];

  beforeEach(() => {
    mockStorage = new MockStorage();
    terrainStorage = new TerrainStorage(mockStorage);
  });

  it("should save and load configurations cleanly", () => {
    expect(terrainStorage.load()).toBeNull();

    terrainStorage.save(sampleConfigs);
    const loaded = terrainStorage.load();

    expect(loaded).toHaveLength(2);
    expect(loaded![0]).toEqual(sampleConfigs[0]);
    expect(loaded![1]).toEqual(sampleConfigs[1]);
  });

  it("should clear saved configurations", () => {
    terrainStorage.save(sampleConfigs);
    expect(terrainStorage.load()).not.toBeNull();

    terrainStorage.clear();
    expect(terrainStorage.load()).toBeNull();
  });

  it("should export to valid JSON and import back", () => {
    const jsonStr = terrainStorage.exportToJson(sampleConfigs);
    expect(jsonStr).toContain('"version": "1.0"');
    expect(jsonStr).toContain('"id": "forest"');

    const imported = terrainStorage.importFromJson(jsonStr);
    expect(imported).toHaveLength(2);
    expect(imported[0].id).toBe("forest");
    expect(imported[0].displayName).toBe("綠色森林");
    expect(imported[0].fallbackColor).toBe("#15803d");
    expect(imported[0].generationWeight).toBe(2.0);
    expect(imported[0].isEnabled).toBe(true);
  });

  it("should sanitize malformed or incomplete imported items", () => {
    const dirtyJson = JSON.stringify({
      terrains: [
        { id: "snow", displayName: "雪原", fallbackColor: "#fff" }, // missing weight & isEnabled
        { id: "lava", fallbackColor: "invalid-color", generationWeight: -5 }, // missing name, bad color & weight
        { id: "", displayName: "Empty ID" }, // invalid id
        null,
      ],
    });

    const imported = terrainStorage.importFromJson(dirtyJson);
    expect(imported).toHaveLength(2);

    expect(imported[0].id).toBe("snow");
    expect(imported[0].generationWeight).toBe(1.0);
    expect(imported[0].isEnabled).toBe(true);

    expect(imported[1].id).toBe("lava");
    expect(imported[1].displayName).toBe("lava");
    expect(imported[1].fallbackColor).toBe("#475569"); // defaulted
    expect(imported[1].generationWeight).toBe(1.0); // defaulted
  });

  it("should throw error on invalid JSON string or empty list", () => {
    expect(() => terrainStorage.importFromJson("not json")).toThrow(/JSON 格式解析失敗/);
    expect(() => terrainStorage.importFromJson(JSON.stringify({ terrains: [] }))).toThrow(/沒有有效的地形定義/);
  });
});
