import { describe, it, expect } from "vitest";
import { Viewport } from "../../src/rendering/Viewport";

describe("Viewport", () => {
  describe("Initialization & Limits", () => {
    it("should initialize with default state and limits", () => {
      const vp = new Viewport();
      expect(vp.panX).toBe(0);
      expect(vp.panY).toBe(0);
      expect(vp.zoom).toBe(1.0);
      expect(vp.limits.minZoom).toBe(0.1);
      expect(vp.limits.maxZoom).toBe(10.0);
    });

    it("should accept custom initial state within limits", () => {
      const vp = new Viewport({ panX: 150, panY: -80, zoom: 2.5 });
      expect(vp.panX).toBe(150);
      expect(vp.panY).toBe(-80);
      expect(vp.zoom).toBe(2.5);
    });

    it("should clamp initial zoom if outside limits", () => {
      const vpLow = new Viewport({ zoom: 0.01 });
      expect(vpLow.zoom).toBe(0.1);

      const vpHigh = new Viewport({ zoom: 50 });
      expect(vpHigh.zoom).toBe(10.0);
    });

    it("should reject invalid limit definitions", () => {
      expect(() => new Viewport({}, { minZoom: -1, maxZoom: 10 })).toThrow();
      expect(() => new Viewport({}, { minZoom: 5, maxZoom: 2 })).toThrow();
      expect(() => new Viewport({}, { minZoom: 0, maxZoom: 10 })).toThrow();
    });

    it("should reject non-positive or non-finite zoom values", () => {
      const vp = new Viewport();
      expect(() => vp.setZoom(-2)).toThrow();
      expect(() => vp.setZoom(0)).toThrow();
      expect(() => vp.setZoom(NaN)).toThrow();
      expect(() => vp.setZoom(Infinity)).toThrow();
    });
  });

  describe("World to Screen and Screen to World Transformations", () => {
    it("should perform identity mapping when pan=(0,0) and zoom=1.0", () => {
      const vp = new Viewport({ panX: 0, panY: 0, zoom: 1.0 });
      const worldPoint = { x: 120, y: 75 };
      const screenPoint = vp.worldToScreen(worldPoint);
      expect(screenPoint.x).toBe(120);
      expect(screenPoint.y).toBe(75);

      const recovered = vp.screenToWorld(screenPoint);
      expect(recovered.x).toBe(120);
      expect(recovered.y).toBe(75);
    });

    it("should round-trip world -> screen -> world with arbitrary pan and zoom", () => {
      const vp = new Viewport({ panX: 350, panY: -120, zoom: 2.4 });
      const testPoints = [
        { x: 0, y: 0 },
        { x: 100, y: 200 },
        { x: -50, y: -80 },
        { x: 1234.56, y: 789.01 },
      ];

      for (const wp of testPoints) {
        const sp = vp.worldToScreen(wp);
        const recovered = vp.screenToWorld(sp);
        expect(recovered.x).toBeCloseTo(wp.x, 8);
        expect(recovered.y).toBeCloseTo(wp.y, 8);
      }
    });

    it("should round-trip screen -> world -> screen", () => {
      const vp = new Viewport({ panX: -40, panY: 200, zoom: 0.75 });
      const testScreenPoints = [
        { x: 10, y: 10 },
        { x: 800, y: 600 },
        { x: 1920, y: 1080 },
      ];

      for (const sp of testScreenPoints) {
        const wp = vp.screenToWorld(sp);
        const recovered = vp.worldToScreen(wp);
        expect(recovered.x).toBeCloseTo(sp.x, 8);
        expect(recovered.y).toBeCloseTo(sp.y, 8);
      }
    });
  });

  describe("Panning", () => {
    it("should translate screen coordinates linearly via panBy", () => {
      const vp = new Viewport({ panX: 100, panY: 100, zoom: 1.5 });
      const wp = { x: 50, y: 50 };
      const sp1 = vp.worldToScreen(wp);

      vp.panBy(30, -50);
      expect(vp.panX).toBe(130);
      expect(vp.panY).toBe(50);

      const sp2 = vp.worldToScreen(wp);
      expect(sp2.x - sp1.x).toBe(30);
      expect(sp2.y - sp1.y).toBe(-50);
    });

    it("should set pan directly via setPan", () => {
      const vp = new Viewport();
      vp.setPan(500, 300);
      expect(vp.panX).toBe(500);
      expect(vp.panY).toBe(300);
    });
  });

  describe("Zooming Around Anchor (Cursor Anchor UX)", () => {
    it("should preserve the exact world coordinate under the screen anchor during zoom-in", () => {
      const vp = new Viewport({ panX: 50, panY: 80, zoom: 1.0 });
      const screenAnchor = { x: 400, y: 300 };

      // Record world point under cursor before zoom
      const worldPointBefore = vp.screenToWorld(screenAnchor);

      // Zoom in by 1.5x
      vp.zoomAroundAnchor(1.5, screenAnchor);
      expect(vp.zoom).toBeCloseTo(1.5, 6);

      // Verify that the same screen point maps to the exact same world point
      const worldPointAfter = vp.screenToWorld(screenAnchor);
      expect(worldPointAfter.x).toBeCloseTo(worldPointBefore.x, 8);
      expect(worldPointAfter.y).toBeCloseTo(worldPointBefore.y, 8);

      // Also verify worldToScreen of that world point returns the screen anchor
      const screenPointAfter = vp.worldToScreen(worldPointBefore);
      expect(screenPointAfter.x).toBeCloseTo(screenAnchor.x, 8);
      expect(screenPointAfter.y).toBeCloseTo(screenAnchor.y, 8);
    });

    it("should preserve the exact world coordinate under the screen anchor during zoom-out", () => {
      const vp = new Viewport({ panX: -200, panY: 150, zoom: 3.0 });
      const screenAnchor = { x: 640, y: 480 };

      const worldPointBefore = vp.screenToWorld(screenAnchor);

      // Zoom out by 0.5x
      vp.zoomAroundAnchor(0.5, screenAnchor);
      expect(vp.zoom).toBeCloseTo(1.5, 6);

      const worldPointAfter = vp.screenToWorld(screenAnchor);
      expect(worldPointAfter.x).toBeCloseTo(worldPointBefore.x, 8);
      expect(worldPointAfter.y).toBeCloseTo(worldPointBefore.y, 8);
    });

    it("should clamp zoom to minZoom and maxZoom during anchor zooming", () => {
      const vp = new Viewport({ zoom: 1.0 });
      const anchor = { x: 100, y: 100 };

      // Extreme zoom in (factor = 50)
      vp.zoomAroundAnchor(50, anchor);
      expect(vp.zoom).toBe(10.0);

      // Extreme zoom out (factor = 0.001)
      vp.zoomAroundAnchor(0.001, anchor);
      expect(vp.zoom).toBe(0.1);
    });
  });

  describe("Centering on World Point", () => {
    it("should center screen on the specified world coordinate", () => {
      const vp = new Viewport();
      const worldTarget = { x: 600, y: 350 };
      const screenSize = { x: 1200, y: 800 };

      vp.centerOnWorldPoint(worldTarget, screenSize, 2.0);
      expect(vp.zoom).toBe(2.0);

      // Screen center (600, 400) should map to worldTarget
      const screenCenter = { x: 600, y: 400 };
      const centerWorld = vp.screenToWorld(screenCenter);
      expect(centerWorld.x).toBeCloseTo(worldTarget.x, 8);
      expect(centerWorld.y).toBeCloseTo(worldTarget.y, 8);
    });
  });
});
