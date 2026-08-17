import { TerrainId } from "../terrain/TerrainId";
import { AssetId } from "./AssetId";
import { TerrainAsset } from "./TerrainAsset";

/**
 * TerrainAssetRegistry
 * Manages the catalog of available visual stamp assets and their associations with terrain categories.
 *
 * Enforces unique AssetIds, deterministic listing, terrain-based queries, and defensive encapsulation.
 */
export class TerrainAssetRegistry {
  private readonly assetsById: Map<string, TerrainAsset> = new Map();

  /**
   * Registers a new visual stamp asset.
   * Throws if an asset with the same AssetId is already registered.
   */
  public register(asset: TerrainAsset): void {
    if (!(asset instanceof TerrainAsset)) {
      throw new Error("Can only register instances of TerrainAsset.");
    }
    const key = asset.id.value;
    if (this.assetsById.has(key)) {
      throw new Error(`TerrainAsset with id '${key}' is already registered.`);
    }
    this.assetsById.set(key, asset);
  }

  /**
   * Retrieves an asset by its unique AssetId.
   */
  public get(id: AssetId | string): TerrainAsset | undefined {
    const key = typeof id === "string" ? id.trim() : id.value;
    return this.assetsById.get(key);
  }

  /**
   * Checks whether an asset exists in the registry.
   */
  public has(id: AssetId | string): boolean {
    const key = typeof id === "string" ? id.trim() : id.value;
    return this.assetsById.has(key);
  }

  /**
   * Removes an asset by its AssetId.
   * Returns true if removed, false if not found.
   */
  public remove(id: AssetId | string): boolean {
    const key = typeof id === "string" ? id.trim() : id.value;
    return this.assetsById.delete(key);
  }

  /**
   * Returns all registered assets in deterministic registration order (defensive copy).
   */
  public list(): TerrainAsset[] {
    return Array.from(this.assetsById.values());
  }

  /**
   * Returns all assets associated with the specified TerrainId (deterministic registration order, defensive copy).
   */
  public getByTerrain(terrainId: TerrainId | string): TerrainAsset[] {
    const targetTerrain = typeof terrainId === "string" ? terrainId.trim() : terrainId.value;
    const result: TerrainAsset[] = [];

    for (const asset of this.assetsById.values()) {
      if (asset.terrainId.value === targetTerrain) {
        result.push(asset);
      }
    }

    return result;
  }

  /**
   * Updates the selection weight of an existing registered asset.
   * Throws if the asset is not found or if the weight is invalid (negative, NaN, non-finite).
   */
  public updateWeight(id: AssetId | string, weight: number): void {
    const key = typeof id === "string" ? id.trim() : id.value;
    const existing = this.assetsById.get(key);
    if (!existing) {
      throw new Error(`Cannot update weight: Asset with id '${key}' not found in registry.`);
    }

    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error(
        `Invalid weight: ${weight}. Weight must be a non-negative finite number (>= 0).`
      );
    }

    const updated = existing.withWeight(weight);
    this.assetsById.set(key, updated);
  }

  /**
   * Total number of registered assets.
   */
  public get size(): number {
    return this.assetsById.size;
  }

  /**
   * Clears all registered assets.
   */
  public clear(): void {
    this.assetsById.clear();
  }
}
