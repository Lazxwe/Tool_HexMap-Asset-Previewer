import { HexCoordinate } from "../hex/HexCoordinate";
import { TerrainId } from "./TerrainId";

export interface TerrainCellEntry {
  readonly coord: HexCoordinate;
  readonly terrainId: TerrainId;
}

/**
 * TerrainMap
 * Represents spatial assignments of TerrainId to HexCoordinates.
 *
 * Stores references to TerrainId rather than TerrainDefinition objects,
 * maintaining strict separation between terrain metadata and map cell data.
 */
export class TerrainMap {
  private readonly cells: Map<string, { coord: HexCoordinate; terrainId: TerrainId }> = new Map();

  /**
   * Assigns a TerrainId to the specified HexCoordinate.
   */
  public set(coord: HexCoordinate, terrainId: TerrainId | string): void {
    if (!(coord instanceof HexCoordinate)) {
      throw new Error("coord must be an instance of HexCoordinate.");
    }
    const tid = terrainId instanceof TerrainId ? terrainId : new TerrainId(terrainId);
    this.cells.set(coord.toKey(), { coord, terrainId: tid });
  }

  /**
   * Retrieves the TerrainId assigned to a HexCoordinate.
   * Returns undefined if the hex cell is unassigned (empty state).
   */
  public get(coord: HexCoordinate): TerrainId | undefined {
    if (!(coord instanceof HexCoordinate)) {
      return undefined;
    }
    const entry = this.cells.get(coord.toKey());
    return entry ? entry.terrainId : undefined;
  }

  /**
   * Checks whether a terrain has been assigned to the HexCoordinate.
   */
  public has(coord: HexCoordinate): boolean {
    if (!(coord instanceof HexCoordinate)) {
      return false;
    }
    return this.cells.has(coord.toKey());
  }

  /**
   * Removes the terrain assignment at the specified HexCoordinate.
   * Returns true if an assignment was removed, false otherwise.
   */
  public delete(coord: HexCoordinate): boolean {
    if (!(coord instanceof HexCoordinate)) {
      return false;
    }
    return this.cells.delete(coord.toKey());
  }

  /**
   * Clears all terrain assignments across the map.
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
   * Returns a deterministic list of assigned cells, sorted by (col, row) order.
   */
  public entries(): TerrainCellEntry[] {
    return Array.from(this.cells.values())
      .map((entry) => ({ coord: entry.coord, terrainId: entry.terrainId }))
      .sort((a, b) => {
        if (a.coord.col !== b.coord.col) {
          return a.coord.col - b.coord.col;
        }
        return a.coord.row - b.coord.row;
      });
  }

  /**
   * Creates a deep snapshot copy of the current terrain map assignments.
   */
  public clone(): TerrainMap {
    const cloned = new TerrainMap();
    for (const entry of this.cells.values()) {
      cloned.set(entry.coord, entry.terrainId);
    }
    return cloned;
  }
}
