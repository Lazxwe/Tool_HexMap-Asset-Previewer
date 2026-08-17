import { HexCoordinate } from "../domain/hex/HexCoordinate";
import { GridRenderOptions } from "./RenderTypes";
import { TerrainStampRenderer } from "./terrain/TerrainStampRenderer";
import { Viewport } from "./Viewport";

export interface CanvasRendererOptions {
  backgroundColor?: string;
  stampRenderer?: TerrainStampRenderer;
}

export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly backgroundColor: string;
  public readonly stampRenderer: TerrainStampRenderer;

  constructor(ctx: CanvasRenderingContext2D, options: CanvasRendererOptions = {}) {
    this.ctx = ctx;
    this.backgroundColor = options.backgroundColor ?? "#0d0f14";
    this.stampRenderer = options.stampRenderer ?? new TerrainStampRenderer();
  }

  /**
   * Clears the entire canvas viewport using backing-store physical dimensions.
   */
  public clear(width: number, height: number, dpr: number = 1): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, width * dpr, height * dpr);
    this.ctx.restore();
  }

  /**
   * Main render orchestration method:
   * 1. Clears canvas background
   * 2. Sets High-DPI scaling
   * 3. Applies Viewport pan & zoom transform
   * 4. Renders Terrain Stamp layer (clipped to Hex polygons)
   * 5. Renders Hex Grid outlines (subtle fill if unassigned, stroke)
   * 6. Renders Hover / selection indicator
   * 7. Renders Debug coordinate labels
   * 8. Restores canvas transform state
   */
  public render(
    viewport: Viewport,
    gridOptions: GridRenderOptions,
    screenWidth: number,
    screenHeight: number,
    dpr: number = 1
  ): void {
    // 1. Clear background
    this.clear(screenWidth, screenHeight, dpr);

    const { ctx } = this;
    ctx.save();

    // 2. High-DPI transformation: maps CSS pixels to canvas backing store
    ctx.scale(dpr, dpr);

    // 3. Viewport transformation: maps World space to Screen space
    ctx.translate(viewport.panX, viewport.panY);
    ctx.scale(viewport.zoom, viewport.zoom);

    // 4. Render Terrain Stamp Layer (Clipped Images)
    if (gridOptions.stamps) {
      this.stampRenderer.renderStamps(ctx, gridOptions.stamps, gridOptions.hexGeometry);
    }

    // 5. Render Hex Grid outlines & debug overlays
    this.renderHexGrid(gridOptions, viewport.zoom);

    // 6. Restore canvas transformation
    ctx.restore();
  }

  /**
   * Renders the Flat-top Hex Grid outlines and debug labels in World coordinates.
   */
  private renderHexGrid(gridOptions: GridRenderOptions, currentZoom: number): void {
    const {
      cols,
      rows,
      hexGeometry,
      showLabels = true,
      strokeColor = "rgba(70, 95, 135, 0.6)",
      fillColorEven = "rgba(22, 28, 42, 0.5)",
      fillColorOdd = "rgba(17, 22, 33, 0.5)",
      labelColor = "rgba(160, 185, 220, 0.8)",
      highlightedHex = null,
      stamps,
      fallbacks,
    } = gridOptions;

    const { ctx } = this;
    const lineWidth = Math.max(0.5, 1 / currentZoom);

    // Build quick lookup for coordinates with stamps
    const stampedKeys = new Set<string>();
    if (stamps) {
      for (const s of stamps) {
        stampedKeys.add(s.coord.toKey());
      }
    }

    // Build quick lookup for fallback cells
    const fallbackMap = new Map<string, { terrainId: string; label?: string; fillColor?: string }>();
    if (fallbacks) {
      for (const fb of fallbacks) {
        fallbackMap.set(fb.coord.toKey(), fb);
      }
    }

    const defaultFallbackColors: Record<string, string> = {
      water: "rgba(37, 99, 235, 0.65)",
      sand: "rgba(217, 119, 6, 0.65)",
      forest: "rgba(22, 101, 52, 0.65)",
      mountain: "rgba(71, 85, 105, 0.65)",
      grass: "rgba(34, 197, 94, 0.65)",
      snow: "rgba(241, 245, 249, 0.65)",
      plains: "rgba(132, 204, 22, 0.65)",
    };

    // Render Hex Polygons & Outlines
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const coord = new HexCoordinate(c, r);
        const polygon = hexGeometry.getHexPolygon(coord);

        if (polygon.length < 6) continue;

        ctx.beginPath();
        ctx.moveTo(polygon[0].x, polygon[0].y);
        for (let i = 1; i < 6; i++) {
          ctx.lineTo(polygon[i].x, polygon[i].y);
        }
        ctx.closePath();

        const isHighlighted = highlightedHex && highlightedHex.equals(coord);
        const hasStamp = stampedKeys.has(coord.toKey());
        const fallback = fallbackMap.get(coord.toKey());

        // Hex fill
        if (isHighlighted) {
          ctx.fillStyle = "rgba(59, 130, 246, 0.35)";
          ctx.fill();
        } else if (fallback) {
          ctx.fillStyle =
            fallback.fillColor ||
            defaultFallbackColors[fallback.terrainId.toLowerCase()] ||
            "rgba(71, 85, 105, 0.65)";
          ctx.fill();
        } else if (!hasStamp) {
          ctx.fillStyle = (c + r) % 2 === 0 ? fillColorEven : fillColorOdd;
          ctx.fill();
        }

        // Hex outline stroke (always rendered above stamps)
        ctx.strokeStyle = isHighlighted ? "rgba(96, 165, 250, 0.9)" : strokeColor;
        ctx.lineWidth = isHighlighted ? lineWidth * 1.5 : lineWidth;
        ctx.stroke();
      }
    }

    // Render Coordinate / Fallback Labels
    if (showLabels) {
      const fallbackFontSize = Math.max(6, Math.min(8, Math.round(hexGeometry.hexHeight * 0.09)));
      ctx.font = `600 ${fallbackFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = labelColor;

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const coord = new HexCoordinate(c, r);
          const center = hexGeometry.hexToPixel(coord);
          const fallback = fallbackMap.get(coord.toKey());

          if (fallback) {
            ctx.fillStyle = "rgba(240, 245, 255, 0.9)";
            ctx.fillText(fallback.label || fallback.terrainId, center.x, center.y);
          } else if (!stampedKeys.has(coord.toKey())) {
            // Unassigned empty grid label
            ctx.fillStyle = labelColor;
            ctx.fillText(`${c},${r}`, center.x, center.y);
          }
        }
      }
    }
  }
}
