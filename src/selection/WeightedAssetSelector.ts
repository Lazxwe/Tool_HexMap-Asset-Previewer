import { TerrainAsset } from "../domain/asset/TerrainAsset";
import { TerrainAssetRegistry } from "../domain/asset/TerrainAssetRegistry";
import { TerrainId } from "../domain/terrain/TerrainId";
import { TerrainMap } from "../domain/terrain/TerrainMap";
import { HexAssetMap } from "./HexAssetMap";
import { RandomSource } from "./RandomTypes";

/**
 * WeightedAssetSelector
 * Application service that performs deterministic weighted selection of visual stamp assets
 * based on TerrainId categories and individual asset weights.
 */
export class WeightedAssetSelector {
  public readonly registry: TerrainAssetRegistry;
  public readonly random: RandomSource;

  constructor(registry: TerrainAssetRegistry, random: RandomSource) {
    if (!registry || !(registry instanceof TerrainAssetRegistry)) {
      throw new Error("WeightedAssetSelector requires a valid TerrainAssetRegistry.");
    }
    if (!random || typeof random.next !== "function") {
      throw new Error("WeightedAssetSelector requires a valid RandomSource.");
    }

    this.registry = registry;
    this.random = random;
    Object.freeze(this);
  }

  /**
   * Selects a single TerrainAsset for the specified TerrainId using weighted random sampling.
   *
   * Invariants:
   * - Consumes exactly one random.next() call per invocation.
   * - Ignores assets with weight === 0.
   * - Throws if no assets are registered for the terrain or if all registered assets have weight <= 0.
   */
  public selectForTerrain(terrainId: TerrainId | string): TerrainAsset {
    const tid = terrainId instanceof TerrainId ? terrainId : new TerrainId(terrainId);
    const assets = this.registry.getByTerrain(tid);

    if (assets.length === 0) {
      throw new Error(`No assets registered for terrain category '${tid.value}'.`);
    }

    let totalWeight = 0;
    let nonZeroCount = 0;

    for (const asset of assets) {
      if (!Number.isFinite(asset.weight) || asset.weight < 0) {
        throw new Error(
          `Invalid asset weight ${asset.weight} encountered for asset '${asset.id.value}'.`
        );
      }
      if (asset.weight > 0) {
        totalWeight += asset.weight;
        nonZeroCount++;
      }
    }

    if (nonZeroCount === 0 || totalWeight <= 0 || !Number.isFinite(totalWeight)) {
      throw new Error(
        `All registered assets for terrain category '${tid.value}' have zero or invalid selection weight.`
      );
    }

    // Always consume exactly one RNG call per terrain selection
    const r = this.random.next();

    if (typeof r !== "number" || !Number.isFinite(r) || r < 0 || r >= 1) {
      throw new Error(
        `RandomSource returned invalid value: ${r}. Expected finite number in half-open interval [0, 1).`
      );
    }

    const target = r * totalWeight;
    let cumulative = 0;

    for (const asset of assets) {
      if (asset.weight <= 0) continue;
      cumulative += asset.weight;
      if (target < cumulative) {
        return asset;
      }
    }

    // Defensive fallback to the last eligible non-zero asset (floating-point precision edge case)
    for (let i = assets.length - 1; i >= 0; i--) {
      if (assets[i].weight > 0) {
        return assets[i];
      }
    }

    throw new Error(`Failed to resolve weighted asset for terrain category '${tid.value}'.`);
  }

  /**
   * Attempts to select a single TerrainAsset for the specified TerrainId.
   * Returns undefined if no assets are registered or all assets have weight <= 0.
   */
  public trySelectForTerrain(terrainId: TerrainId | string): TerrainAsset | undefined {
    const tid = terrainId instanceof TerrainId ? terrainId : new TerrainId(terrainId);
    const assets = this.registry.getByTerrain(tid);

    if (assets.length === 0) {
      return undefined;
    }

    let totalWeight = 0;
    let nonZeroCount = 0;

    for (const asset of assets) {
      if (asset.weight > 0 && Number.isFinite(asset.weight)) {
        totalWeight += asset.weight;
        nonZeroCount++;
      }
    }

    if (nonZeroCount === 0 || totalWeight <= 0) {
      return undefined;
    }

    return this.selectForTerrain(tid);
  }

  /**
   * Selects visual stamp assets for assigned hexes in a TerrainMap.
   * Hexes without available stamp assets in the registry are omitted from HexAssetMap.
   *
   * Iterates through cells in deterministic (col, row) order, generating a HexAssetMap.
   */
  public selectForMap(terrainMap: TerrainMap): HexAssetMap {
    if (!terrainMap || !(terrainMap instanceof TerrainMap)) {
      throw new Error("WeightedAssetSelector.selectForMap requires a valid TerrainMap.");
    }

    const hexAssetMap = new HexAssetMap();
    if (terrainMap.size === 0) {
      return hexAssetMap;
    }

    // Process entries in deterministic sorted order
    for (const entry of terrainMap.entries()) {
      const selected = this.trySelectForTerrain(entry.terrainId);
      if (selected) {
        hexAssetMap.set(entry.coord, selected.id);
      }
    }

    return hexAssetMap;
  }
}
