import { describe, it, expect, vi } from "vitest";
import { AssetId } from "../../../src/domain/asset/AssetId";
import { HexCoordinate } from "../../../src/domain/hex/HexCoordinate";
import { HexGeometry } from "../../../src/domain/hex/HexGeometry";
import { LoadedAsset, RenderableImage } from "../../../src/infrastructure/asset/AssetTypes";
import { TerrainStampRenderer } from "../../../src/rendering/terrain/TerrainStampRenderer";
import { HexStampEntry } from "../../../src/rendering/terrain/TerrainStampTypes";

function createMockImage(width: number, height: number, id: string = "mock"): LoadedAsset {
  const dummyCanvasSource = {
    width,
    height,
    id,
  } as unknown as CanvasImageSource;

  const renderable: RenderableImage = {
    width,
    height,
    nativeSource: dummyCanvasSource,
  };

  return {
    assetId: new AssetId(id),
    source: `assets/${id}.png`,
    image: renderable,
  };
}

function createMockContext() {
  const calls: string[] = [];
  const ctx = {
    calls,
    save: vi.fn(() => calls.push("save")),
    restore: vi.fn(() => calls.push("restore")),
    beginPath: vi.fn(() => calls.push("beginPath")),
    closePath: vi.fn(() => calls.push("closePath")),
    moveTo: vi.fn((x: number, y: number) => calls.push(`moveTo(${x},${y})`)),
    lineTo: vi.fn((x: number, y: number) => calls.push(`lineTo(${x},${y})`)),
    clip: vi.fn(() => calls.push("clip")),
    drawImage: vi.fn(
      (_img: CanvasImageSource, dx: number, dy: number, dw: number, dh: number) =>
        calls.push(`drawImage(${dx},${dy},${dw},${dh})`)
    ),
    globalAlpha: 1.0,
  } as unknown as CanvasRenderingContext2D & { calls: string[] };

  return ctx;
}

describe("TerrainStampRenderer", () => {
  const geometry = new HexGeometry(120, 70);
  const renderer = new TerrainStampRenderer();

  describe("A. Basic Rendering & Placement", () => {
    it("should draw an image centered at the hex center", () => {
      const ctx = createMockContext();
      const coord = new HexCoordinate(0, 0); // Center is (60, 35)
      const asset = createMockImage(120, 70, "test_asset");

      renderer.renderStamp(ctx, coord, asset, geometry);

      // (0,0) center: cx = 60, cy = 35. For 120x70 img on 120x70 hex, scale = 1.0, dx = 0, dy = 0, dw = 120, dh = 70
      expect(ctx.drawImage).toHaveBeenCalledWith(asset.image.nativeSource, 0, 0, 120, 70);
    });
  });

  describe("B. Aspect Ratio & Cover Scaling Strategy", () => {
    it("should apply cover scaling on square image (256x256) without distortion", () => {
      const ctx = createMockContext();
      const coord = new HexCoordinate(0, 0); // Center is (60, 35)
      const asset = createMockImage(256, 256, "square_asset");

      renderer.renderStamp(ctx, coord, asset, geometry, { scalingStrategy: "cover" });

      // Hex is 120x70. Scale = max(120/256, 70/256) = 120/256 = 0.46875
      // drawW = 256 * (120/256) = 120, drawH = 256 * (120/256) = 120
      // drawX = 60 - 60 = 0, drawY = 35 - 60 = -25
      expect(ctx.drawImage).toHaveBeenCalledWith(asset.image.nativeSource, 0, -25, 120, 120);
    });

    it("should apply cover scaling on wide image (400x200)", () => {
      const ctx = createMockContext();
      const coord = new HexCoordinate(0, 0); // Center is (60, 35)
      const asset = createMockImage(400, 200, "wide_asset");

      renderer.renderStamp(ctx, coord, asset, geometry, { scalingStrategy: "cover" });

      // Hex 120x70. Scale = max(120/400, 70/200) = max(0.3, 0.35) = 0.35
      // drawW = 400 * 0.35 = 140, drawH = 200 * 0.35 = 70
      // drawX = 60 - 70 = -10, drawY = 35 - 35 = 0
      expect(ctx.drawImage).toHaveBeenCalledWith(asset.image.nativeSource, -10, 0, 140, 70);
    });

    it("should apply cover scaling on tall image (200x400)", () => {
      const ctx = createMockContext();
      const coord = new HexCoordinate(0, 0); // Center is (60, 35)
      const asset = createMockImage(200, 400, "tall_asset");

      renderer.renderStamp(ctx, coord, asset, geometry, { scalingStrategy: "cover" });

      // Hex 120x70. Scale = max(120/200, 70/400) = max(0.6, 0.175) = 0.6
      // drawW = 200 * 0.6 = 120, drawH = 400 * 0.6 = 240
      // drawX = 60 - 60 = 0, drawY = 35 - 120 = -85
      expect(ctx.drawImage).toHaveBeenCalledWith(asset.image.nativeSource, 0, -85, 120, 240);
    });
  });

  describe("C. Hex Polygon Clipping & Sequence", () => {
    it("should clip using hex polygon in exact save -> clip -> drawImage -> restore sequence", () => {
      const ctx = createMockContext();
      const coord = new HexCoordinate(1, 0);
      const asset = createMockImage(100, 100, "clip_test");

      renderer.renderStamp(ctx, coord, asset, geometry);

      expect(ctx.calls[0]).toBe("save");
      expect(ctx.calls[1]).toBe("beginPath");
      // Polygon vertices (moveTo and lineTos)
      expect(ctx.calls).toContain("closePath");
      expect(ctx.calls).toContain("clip");

      const clipIndex = ctx.calls.indexOf("clip");
      const drawIndex = ctx.calls.findIndex((c) => c.startsWith("drawImage"));
      const restoreIndex = ctx.calls.lastIndexOf("restore");

      expect(clipIndex).toBeLessThan(drawIndex);
      expect(drawIndex).toBeLessThan(restoreIndex);
    });
  });

  describe("D. Context Isolation & Error Defense", () => {
    it("should restore context even if drawing throws", () => {
      const ctx = createMockContext();
      ctx.drawImage = vi.fn(() => {
        throw new Error("Simulated canvas render error");
      });

      const coord = new HexCoordinate(0, 0);
      const asset = createMockImage(100, 100, "err_test");

      expect(() => renderer.renderStamp(ctx, coord, asset, geometry)).not.toThrow();
      expect(ctx.restore).toHaveBeenCalled();
    });
  });

  describe("E. Missing / Invalid Asset Handling", () => {
    it("should gracefully ignore null or undefined assets", () => {
      const ctx = createMockContext();
      const coord = new HexCoordinate(0, 0);

      renderer.renderStamp(ctx, coord, null, geometry);
      renderer.renderStamp(ctx, coord, undefined, geometry);

      expect(ctx.save).not.toHaveBeenCalled();
      expect(ctx.drawImage).not.toHaveBeenCalled();
    });

    it("should gracefully ignore assets with zero or negative dimensions", () => {
      const ctx = createMockContext();
      const coord = new HexCoordinate(0, 0);
      const zeroAsset = createMockImage(0, 100, "zero_asset");

      renderer.renderStamp(ctx, coord, zeroAsset, geometry);
      expect(ctx.save).not.toHaveBeenCalled();
      expect(ctx.drawImage).not.toHaveBeenCalled();
    });
  });

  describe("F. Batch Multiple Hexes", () => {
    it("should render multiple stamps across 3x3 hex grid entries", () => {
      const ctx = createMockContext();
      const entries: HexStampEntry[] = [];

      for (let c = 0; c < 3; c++) {
        for (let r = 0; r < 3; r++) {
          entries.push({
            coord: new HexCoordinate(c, r),
            asset: createMockImage(100, 100, `stamp_${c}_${r}`),
          });
        }
      }

      renderer.renderStamps(ctx, entries, geometry);

      expect(ctx.drawImage).toHaveBeenCalledTimes(9);
      expect(ctx.save).toHaveBeenCalledTimes(9);
      expect(ctx.restore).toHaveBeenCalledTimes(9);
    });
  });

  describe("G. Negative Coordinates Handling", () => {
    it("should correctly render stamps at negative coordinates (-1, 0), (0, -1), (-3, -2)", () => {
      const ctx = createMockContext();
      const negCoords = [
        new HexCoordinate(-1, 0),
        new HexCoordinate(0, -1),
        new HexCoordinate(-3, -2),
      ];

      for (const coord of negCoords) {
        const asset = createMockImage(120, 70, `neg_${coord.toKey()}`);
        renderer.renderStamp(ctx, coord, asset, geometry);
      }

      expect(ctx.drawImage).toHaveBeenCalledTimes(3);
    });
  });
});
