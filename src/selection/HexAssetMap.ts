import { AssetId } from "../domain/asset/AssetId";
import { HexCoordinate } from "../domain/hex/HexCoordinate";

export interface HexAssetEntry {
  readonly coord: HexCoordinate;
  readonly assetId: AssetId;
}

/**
 * HexAssetMap
 * Spatial map tracking AssetId assignments per HexCoordinate.
 *
 * Stores pure AssetId references (never TerrainAsset objects or images), maintaining
 * clean separation between spatial assignment data and visual assets.
 */
export class HexAssetMap {
  private readonly cells: Map<string, { coord: HexCoordinate; assetId: AssetId }> = new Map();

  /**
   * Assigns an AssetId to the specified HexCoordinate.
   */
  public set(coord: HexCoordinate, assetId: AssetId | string): void {
    if (!(coord instanceof HexCoordinate)) {
      throw new Error("coord must be an instance of HexCoordinate.");
    }
    const aid = assetId instanceof AssetId ? assetId : new AssetId(assetId);
    this.cells.set(coord.toKey(), { coord, assetId: aid });
  }

  /**
   * Retrieves the AssetId assigned to a HexCoordinate.
   * Returns undefined if the cell is unassigned.
   */
  public get(coord: HexCoordinate): AssetId | undefined {
    if (!(coord instanceof HexCoordinate)) {
      return undefined;
    }
    const entry = this.cells.get(coord.toKey());
    return entry ? entry.assetId : undefined;
  }

  /**
   * Checks whether an asset is assigned to the HexCoordinate.
   */
  public has(coord: HexCoordinate): boolean {
    if (!(coord instanceof HexCoordinate)) {
      return false;
    }
    return this.cells.has(coord.toKey());
  }

  /**
   * Removes the asset assignment at the specified HexCoordinate.
   * Returns true if an assignment was removed, false otherwise.
   */
  public delete(coord: HexCoordinate): boolean {
    if (!(coord instanceof HexCoordinate)) {
      return false;
    }
    return this.cells.delete(coord.toKey());
  }

  /**
   * Clears all asset assignments.
   */
  public clear(): void {
    this.cells.clear();
  }

  /**
   * Total number of assigned hex cells.
   */
  public get size(): number {
    return this.cells.size;
  }

  /**
   * Returns a deterministic list of assigned cells, sorted in (col ascending, row ascending) order.
   */
  public entries(): HexAssetEntry[] {
    return Array.from(this.cells.values())
      .map((entry) => ({ coord: entry.coord, assetId: entry.assetId }))
      .sort((a, b) => {
        if (a.coord.col !== b.coord.col) {
          return a.coord.col - b.coord.col;
        }
        return a.coord.row - b.coord.row;
      });
  }

  /**
   * Creates a deep snapshot clone of the HexAssetMap.
   */
  public clone(): HexAssetMap {
    const cloned = new HexAssetMap();
    for (const entry of this.cells.values()) {
      cloned.set(entry.coord, entry.assetId);
    }
    return cloned;
  }
}
