import { AssetId } from "../../domain/asset/AssetId";
import { TerrainAsset } from "../../domain/asset/TerrainAsset";

/**
 * RenderableImage
 * Abstract interface representing a decoded visual image resource suitable for Canvas 2D rendering.
 */
export interface RenderableImage {
  readonly width: number;
  readonly height: number;
  readonly nativeSource: CanvasImageSource;
}

/**
 * LoadedAsset
 * Encapsulates a successfully loaded TerrainAsset with its decoded renderable image resource.
 */
export interface LoadedAsset {
  readonly assetId: AssetId;
  readonly source: string;
  readonly image: RenderableImage;
}

/**
 * ImageDecoder
 * Pluggable strategy interface for decoding raw image URLs, blobs, or buffers into RenderableImage.
 * Allows swapping between browser (createImageBitmap), Tauri native IPC, or unit test mocks.
 */
export interface ImageDecoder {
  decodeFromUrl(url: string): Promise<RenderableImage>;
  decodeFromBlob?(blob: Blob): Promise<RenderableImage>;
}

/**
 * IAssetLoader
 * Contract for asset loading, caching, and retrieval services.
 */
export interface IAssetLoader {
  load(asset: TerrainAsset): Promise<LoadedAsset>;
  loadBySource(assetId: AssetId, source: string): Promise<LoadedAsset>;
  get(assetId: AssetId | string): LoadedAsset | undefined;
  has(assetId: AssetId | string): boolean;
  clear(): void;
  readonly size: number;
}
