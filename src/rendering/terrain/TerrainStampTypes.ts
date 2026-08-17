import { HexCoordinate } from "../../domain/hex/HexCoordinate";
import { LoadedAsset } from "../../infrastructure/asset/AssetTypes";

export type StampScalingStrategy = "cover" | "contain";

export interface TerrainStampRenderOptions {
  scalingStrategy?: StampScalingStrategy;
  opacity?: number;
}

export interface HexStampEntry {
  readonly coord: HexCoordinate;
  readonly asset: LoadedAsset;
}
