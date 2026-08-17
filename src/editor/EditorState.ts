import { HexCoordinate } from "../domain/hex/HexCoordinate";
import { TerrainMap } from "../domain/terrain/TerrainMap";
import { HexBounds } from "../generation/NoiseTypes";
import { HexAssetMap } from "../selection/HexAssetMap";

export type EditorStatus =
  | "idle"
  | "generating"
  | "loading-assets"
  | "ready"
  | "error";

export interface BuiltInGenerationSource {
  readonly kind: "builtin";
  readonly seed: number;
  readonly scale: number;
  readonly bounds?: HexBounds;
}

export interface JsonMapSource {
  readonly kind: "json";
  readonly document: string;
  readonly name?: string;
  readonly previewAssetSeed?: number;
}

export type MapSource = BuiltInGenerationSource | JsonMapSource;

/**
 * Deterministically derives an independent seed for asset selection from the terrain generation seed.
 */
export function deriveAssetSeed(seed: number): number {
  let h = (seed ^ 0x9e3779b9) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * EditorState
 * Single immutable state snapshot of the Map Previewer.
 *
 * Invariants:
 * - Pure data model containing zero DOM, Canvas, Image, or binary references.
 * - Map data is encapsulated via Domain TerrainMap and Selection HexAssetMap.
 * - Generation Seed is decoupled from Preview Asset Seed.
 */
export interface EditorState {
  readonly mapSource: MapSource;
  readonly seed: number; // generation seed for builtin
  readonly previewAssetSeed: number; // asset selection seed
  readonly scale: number;
  readonly bounds: HexBounds;
  readonly terrainMap: TerrainMap;
  readonly assetMap: HexAssetMap;
  readonly hoveredHex: HexCoordinate | null;
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
  readonly status: EditorStatus;
  readonly errorMessage?: string;
}

export interface EditorConfig {
  readonly initialSource?: MapSource;
  readonly initialSeed?: number;
  readonly initialPreviewAssetSeed?: number;
  readonly initialScale?: number;
  readonly initialBounds?: HexBounds;
  readonly initialZoom?: number;
  readonly initialPanX?: number;
  readonly initialPanY?: number;
}

export function createInitialEditorState(config: EditorConfig = {}): EditorState {
  const seed = config.initialSeed ?? 12345;
  const previewAssetSeed = config.initialPreviewAssetSeed ?? deriveAssetSeed(seed);
  const scale = config.initialScale ?? 180;
  const bounds: HexBounds = config.initialBounds ?? {
    minCol: 0,
    maxCol: 9,
    minRow: 0,
    maxRow: 9,
  };

  const mapSource: MapSource = config.initialSource ?? {
    kind: "builtin",
    seed,
    scale,
  };

  return {
    mapSource,
    seed,
    previewAssetSeed,
    scale,
    bounds,
    terrainMap: new TerrainMap(),
    assetMap: new HexAssetMap(),
    hoveredHex: null,
    zoom: config.initialZoom ?? 1.0,
    panX: config.initialPanX ?? 0,
    panY: config.initialPanY ?? 0,
    status: "idle",
  };
}
