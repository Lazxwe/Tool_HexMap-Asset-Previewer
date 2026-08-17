import { AssetId } from "../../domain/asset/AssetId";
import { TerrainAsset } from "../../domain/asset/TerrainAsset";
import {
  IAssetLoader,
  ImageDecoder,
  LoadedAsset,
  RenderableImage,
} from "./AssetTypes";
import { BrowserImageDecoder } from "./BrowserImageDecoder";

/**
 * AssetLoader
 * Infrastructure service responsible for loading, decoding, and caching visual stamp assets.
 *
 * Resolves TerrainAsset.source (URI reference) into a RenderableImage.
 * Uses an injected ImageDecoder strategy, allowing seamless test mocking or platform-specific decoders.
 */
export class AssetLoader implements IAssetLoader {
  private readonly decoder: ImageDecoder;
  private readonly cache: Map<string, LoadedAsset> = new Map();
  private readonly inFlightLoads: Map<string, Promise<LoadedAsset>> = new Map();

  constructor(decoder?: ImageDecoder) {
    this.decoder = decoder ?? new BrowserImageDecoder();
  }

  /**
   * Loads a TerrainAsset, decoding its source into a RenderableImage and caching the result.
   */
  public async load(asset: TerrainAsset): Promise<LoadedAsset> {
    if (!(asset instanceof TerrainAsset)) {
      throw new Error("Can only load instances of TerrainAsset.");
    }
    return this.loadBySource(asset.id, asset.source);
  }

  /**
   * Loads an asset resource by explicit AssetId and source reference.
   */
  public async loadBySource(assetId: AssetId, source: string): Promise<LoadedAsset> {
    const key = assetId.value;

    // 1. Check in-memory cache
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    // 2. Deduplicate concurrent requests for the same asset
    const inFlight = this.inFlightLoads.get(key);
    if (inFlight) {
      return inFlight;
    }

    // 3. Initiate loading and decoding
    const loadPromise = (async () => {
      try {
        const image: RenderableImage = await this.decoder.decodeFromUrl(source);
        const loaded: LoadedAsset = {
          assetId,
          source,
          image,
        };

        this.cache.set(key, loaded);
        return loaded;
      } finally {
        this.inFlightLoads.delete(key);
      }
    })();

    this.inFlightLoads.set(key, loadPromise);
    return loadPromise;
  }

  /**
   * Retrieves a loaded asset from the cache by AssetId.
   */
  public get(assetId: AssetId | string): LoadedAsset | undefined {
    const key = typeof assetId === "string" ? assetId.trim() : assetId.value;
    return this.cache.get(key);
  }

  /**
   * Checks whether an asset is already loaded and cached.
   */
  public has(assetId: AssetId | string): boolean {
    const key = typeof assetId === "string" ? assetId.trim() : assetId.value;
    return this.cache.has(key);
  }

  /**
   * Total number of cached loaded assets.
   */
  public get size(): number {
    return this.cache.size;
  }

  /**
   * Clears the loaded asset cache and cancels tracking.
   */
  public clear(): void {
    this.cache.clear();
    this.inFlightLoads.clear();
  }
}
