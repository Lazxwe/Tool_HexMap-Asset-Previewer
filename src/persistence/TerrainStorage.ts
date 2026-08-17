import {
  TerrainConfigFile,
  TerrainConfigItem,
} from "../domain/terrain/TerrainConfigTypes";

const STORAGE_KEY = "hex_terrain_preview_terrain_configs_v1";

export class TerrainStorage {
  private readonly storage: Storage | null;

  constructor(customStorage?: Storage) {
    if (customStorage) {
      this.storage = customStorage;
    } else if (typeof window !== "undefined" && window.localStorage) {
      this.storage = window.localStorage;
    } else {
      this.storage = null;
    }
  }

  /**
   * Saves terrain configurations to LocalStorage.
   */
  public save(configs: readonly TerrainConfigItem[]): void {
    if (!this.storage) return;
    try {
      const data = JSON.stringify(configs);
      this.storage.setItem(STORAGE_KEY, data);
    } catch (e) {
      console.warn("Failed to save terrain configs to LocalStorage:", e);
    }
  }

  /**
   * Loads terrain configurations from LocalStorage. Returns null if none or corrupted.
   */
  public load(): TerrainConfigItem[] | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return this.sanitizeItems(parsed);
    } catch (e) {
      console.warn("Failed to load terrain configs from LocalStorage:", e);
      return null;
    }
  }

  /**
   * Clears saved terrain configurations from LocalStorage.
   */
  public clear(): void {
    if (!this.storage) return;
    try {
      this.storage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn("Failed to clear terrain configs from LocalStorage:", e);
    }
  }

  /**
   * Serializes configurations to formatted JSON file content.
   */
  public exportToJson(configs: readonly TerrainConfigItem[]): string {
    const file: TerrainConfigFile = {
      version: "1.0",
      name: "自訂地形配置",
      terrains: [...configs],
    };
    return JSON.stringify(file, null, 2);
  }

  /**
   * Parses and validates JSON string into TerrainConfigItem array.
   */
  public importFromJson(jsonStr: string): TerrainConfigItem[] {
    if (!jsonStr || typeof jsonStr !== "string") {
      throw new Error("匯入內容必須為非空的 JSON 字串。");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error(`JSON 格式解析失敗: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("JSON 設定檔必須為物件或陣列。");
    }

    let itemsRaw: unknown;
    if (Array.isArray(parsed)) {
      itemsRaw = parsed;
    } else if ("terrains" in parsed && Array.isArray((parsed as Record<string, unknown>).terrains)) {
      itemsRaw = (parsed as Record<string, unknown>).terrains;
    } else {
      throw new Error("無效的地形設定檔：必須包含 'terrains' 陣列。");
    }

    const items = this.sanitizeItems(itemsRaw);
    if (items.length === 0) {
      throw new Error("地形設定檔中沒有有效的地形定義。");
    }
    return items;
  }

  /**
   * Sanitizes and validates array of terrain items.
   */
  private sanitizeItems(rawList: unknown): TerrainConfigItem[] {
    if (!Array.isArray(rawList)) return [];

    const result: TerrainConfigItem[] = [];
    const seenIds = new Set<string>();

    for (const item of rawList) {
      if (!item || typeof item !== "object") continue;

      const record = item as Record<string, unknown>;
      const rawId = typeof record.id === "string" ? record.id.trim() : "";
      if (!rawId || seenIds.has(rawId)) continue;

      const displayName =
        typeof record.displayName === "string" && record.displayName.trim().length > 0
          ? record.displayName.trim()
          : rawId;

      const fallbackColor =
        typeof record.fallbackColor === "string" && /^#[0-9a-fA-F]{3,8}$/.test(record.fallbackColor.trim())
          ? record.fallbackColor.trim()
          : "#475569";

      const weightNum = Number(record.generationWeight);
      const generationWeight = Number.isFinite(weightNum) && weightNum >= 0 ? weightNum : 1.0;

      const isEnabled = typeof record.isEnabled === "boolean" ? record.isEnabled : true;

      seenIds.add(rawId);
      result.push({
        id: rawId,
        displayName,
        fallbackColor,
        generationWeight,
        isEnabled,
      });
    }

    return result;
  }
}
