import { describe, it, expect, vi } from "vitest";
import { HexGeometry } from "../../src/domain/hex/HexGeometry";
import { CanvasRenderer } from "../../src/rendering/CanvasRenderer";
import { Viewport } from "../../src/rendering/Viewport";

function createMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "top",
  } as unknown as CanvasRenderingContext2D;
}

describe("CanvasRenderer", () => {
  it("should clear the background with physical pixel dimensions", () => {
    const ctx = createMockContext();
    const renderer = new CanvasRenderer(ctx, { backgroundColor: "#112233" });

    renderer.clear(800, 600, 2);

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
    expect(ctx.fillStyle).toBe("#112233");
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1600, 1200);
    expect(ctx.restore).toHaveBeenCalled();
  });

  it("should apply DPR scaling, Viewport transform, and render 10x10 hex grid", () => {
    const ctx = createMockContext();
    const renderer = new CanvasRenderer(ctx);
    const viewport = new Viewport({ panX: 120, panY: 60, zoom: 1.5 });
    const hexGeometry = new HexGeometry(100, 80);

    renderer.render(
      viewport,
      { cols: 10, rows: 10, hexGeometry, showLabels: true },
      1280,
      720,
      2.0 // DPR = 2.0
    );

    // Verify High-DPI transform
    expect(ctx.scale).toHaveBeenCalledWith(2.0, 2.0);

    // Verify Viewport transform
    expect(ctx.translate).toHaveBeenCalledWith(120, 60);
    expect(ctx.scale).toHaveBeenCalledWith(1.5, 1.5);

    // Verify 10x10 = 100 hexes rendered
    expect(ctx.beginPath).toHaveBeenCalledTimes(100);
    expect(ctx.fill).toHaveBeenCalledTimes(100);
    expect(ctx.stroke).toHaveBeenCalledTimes(100);
    expect(ctx.fillText).toHaveBeenCalledTimes(100);

    // Verify state was saved and restored
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it("should render stamps through the integrated TerrainStampRenderer", () => {
    const ctx = createMockContext();
    const renderer = new CanvasRenderer(ctx);
    const viewport = new Viewport();
    const hexGeometry = new HexGeometry(100, 80);

    const dummyCanvasSource = { width: 100, height: 100 } as unknown as CanvasImageSource;
    ctx.drawImage = vi.fn();
    ctx.clip = vi.fn();

    const stampEntry = {
      coord: { col: 0, row: 0, toKey: () => "0,0" } as any,
      asset: {
        assetId: { value: "tree_01" } as any,
        source: "assets/tree_01.png",
        image: {
          width: 100,
          height: 100,
          nativeSource: dummyCanvasSource,
        },
      },
    };

    renderer.render(
      viewport,
      { cols: 2, rows: 2, hexGeometry, stamps: [stampEntry] },
      800,
      600,
      1
    );

    expect(ctx.clip).toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalled();
  });
});
