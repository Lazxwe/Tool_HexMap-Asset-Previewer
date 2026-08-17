import { HexCoordinate } from "../domain/hex/HexCoordinate";
import { HexGeometry, Point2D } from "../domain/hex/HexGeometry";
import { HexStampEntry } from "./terrain/TerrainStampTypes";

export type { Point2D };

export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
}

export interface ViewportLimits {
  minZoom: number;
  maxZoom: number;
}

export interface HexFallbackEntry {
  readonly coord: HexCoordinate;
  readonly terrainId: string;
  readonly label?: string;
  readonly fillColor?: string;
}

export interface GridRenderOptions {
  cols: number;
  rows: number;
  hexGeometry: HexGeometry;
  showLabels?: boolean;
  strokeColor?: string;
  fillColorEven?: string;
  fillColorOdd?: string;
  labelColor?: string;
  highlightedHex?: HexCoordinate | null;
  stamps?: Iterable<HexStampEntry>;
  fallbacks?: Iterable<HexFallbackEntry>;
}

export interface CanvasDimensions {
  width: number;
  height: number;
  devicePixelRatio: number;
}

