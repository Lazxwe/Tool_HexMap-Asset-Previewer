import { TerrainMap } from "../domain/terrain/TerrainMap";
import { HexBounds } from "../generation/NoiseTypes";

export const CURRENT_PROJECT_FORMAT_VERSION = 1;

/**
 * Metadata descriptor for project files.
 */
export interface ProjectMetadataDocument {
  readonly name?: string;
}

/**
 * Bounding box DTO for map files.
 */
export interface MapBoundsDocument {
  readonly minCol: number;
  readonly maxCol: number;
  readonly minRow: number;
  readonly maxRow: number;
}

/**
 * Procedural generation metadata DTO (optional, only when generated).
 */
export interface GenerationMetadataDocument {
  readonly algorithm?: string;
  readonly seed?: number;
  readonly scale?: number;
  readonly bounds?: MapBoundsDocument;
}

/**
 * Single spatial terrain classification entry DTO.
 */
export interface TerrainEntryDocument {
  readonly col: number;
  readonly row: number;
  readonly terrainId: string;
}

/**
 * Single visual asset stamp assignment entry DTO (optional for legacy backward compatibility).
 */
export interface AssetEntryDocument {
  readonly col: number;
  readonly row: number;
  readonly assetId: string;
}

/**
 * Viewport camera configuration DTO (optional UI state).
 */
export interface ViewportDocument {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

/**
 * ProjectDocument / MapDocument
 * JSON-serializable, versioned document schema representing a map.
 *
 * Invariants:
 * - Pure data interchange format with zero DOM, Canvas, Image, or binary references.
 * - TerrainMap entries are sorted deterministically by (col ASC, row ASC).
 * - assetMap is NOT canonical persistent data; visual assets are derived at preview-time.
 */
export interface ProjectDocument {
  readonly formatVersion: number;
  readonly metadata?: ProjectMetadataDocument;
  readonly bounds?: MapBoundsDocument;
  readonly terrainMap: readonly TerrainEntryDocument[];
  readonly generation?: GenerationMetadataDocument;
  readonly assetMap?: readonly AssetEntryDocument[];
  readonly viewport?: ViewportDocument;
}

/**
 * PersistableMapState
 * Runtime representation of persistent map data.
 */
export interface PersistableMapState {
  readonly bounds: HexBounds;
  readonly terrainMap: TerrainMap;
  readonly name?: string;
  readonly generation?: {
    readonly seed?: number;
    readonly scale?: number;
  };
}

/**
 * Alias for backward compatibility
 */
export type PersistableProjectState = PersistableMapState;
