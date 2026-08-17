import { HexCoordinate } from "../../domain/hex/HexCoordinate";
import { HexGeometry } from "../../domain/hex/HexGeometry";
import { LoadedAsset } from "../../infrastructure/asset/AssetTypes";
import { HexStampEntry, TerrainStampRenderOptions } from "./TerrainStampTypes";

/**
 * TerrainStampRenderer
 * Pure rendering service responsible for drawing clipped, aspect-ratio-preserving visual stamps on Hex cells.
 *
 * Responsibilities:
 * - Computes Hex polygon clipping path using HexGeometry
 * - Computes centered, non-distorted image dimensions (default: "cover" strategy)
 * - Renders stamp via CanvasRenderingContext2D in World coordinates
 * - Guarantees zero context state leakage (save/restore isolation)
 * - Isolates failures from missing or invalid asset resources
 */
export class TerrainStampRenderer {
  /**
   * Renders a single terrain stamp clipped to the specified HexCoordinate.
   */
  public renderStamp(
    ctx: CanvasRenderingContext2D,
    coord: HexCoordinate,
    asset: LoadedAsset | null | undefined,
    geometry: HexGeometry,
    options: TerrainStampRenderOptions = {}
  ): void {
    if (!coord || !asset || !asset.image || !geometry) {
      return; // Gracefully skip missing / invalid inputs
    }

    const { image } = asset;
    if (!image.nativeSource || image.width <= 0 || image.height <= 0) {
      return; // Invalid image dimensions, skip safely
    }

    const strategy = options.scalingStrategy ?? "cover";
    const center = geometry.hexToPixel(coord);
    const hexW = geometry.hexWidth;
    const hexH = geometry.hexHeight;
    const imgW = image.width;
    const imgH = image.height;

    // Calculate aspect-ratio-preserving scaling factor
    const scale =
      strategy === "cover"
        ? Math.max(hexW / imgW, hexH / imgH)
        : Math.min(hexW / imgW, hexH / imgH);

    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const drawX = center.x - drawW / 2;
    const drawY = center.y - drawH / 2;

    const polygon = geometry.getHexPolygon(coord);
    if (polygon.length < 6) {
      return;
    }

    ctx.save();
    try {
      // 1. Build and apply Hex polygon clip path
      ctx.beginPath();
      ctx.moveTo(polygon[0].x, polygon[0].y);
      for (let i = 1; i < polygon.length; i++) {
        ctx.lineTo(polygon[i].x, polygon[i].y);
      }
      ctx.closePath();
      ctx.clip();

      // 2. Optional opacity adjustment
      if (options.opacity !== undefined && Number.isFinite(options.opacity)) {
        ctx.globalAlpha = Math.max(0, Math.min(1, options.opacity));
      }

      // 3. Draw centered image
      ctx.drawImage(image.nativeSource, drawX, drawY, drawW, drawH);
    } catch (err) {
      // Isolate render error to prevent breaking entire canvas pipeline
      console.warn(`Failed to render stamp for hex ${coord.toKey()}:`, err);
    } finally {
      ctx.restore();
    }
  }

  /**
   * Renders a collection of terrain stamps.
   */
  public renderStamps(
    ctx: CanvasRenderingContext2D,
    stamps: Iterable<HexStampEntry>,
    geometry: HexGeometry,
    options: TerrainStampRenderOptions = {}
  ): void {
    for (const entry of stamps) {
      this.renderStamp(ctx, entry.coord, entry.asset, geometry, options);
    }
  }
}
