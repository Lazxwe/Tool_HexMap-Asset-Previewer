import { describe, expect, it } from "vitest";
import { HexCoordinate } from "../../../src/domain/hex/HexCoordinate";
import { HexGeometry } from "../../../src/domain/hex/HexGeometry";

describe("HexGeometry Regular Dimensions", () => {
  it("should calculate exact regular width from height", () => {
    // For regular flat-top hex: W = (2 / sqrt(3)) * H ≈ 1.1547005 * H
    const height = 70;
    const width = HexGeometry.calculateRegularWidth(height);
    expect(width).toBeCloseTo(80.829, 3);

    const height100 = 100;
    expect(HexGeometry.calculateRegularWidth(height100)).toBeCloseTo(115.47, 2);
  });

  it("should calculate exact regular height from width", () => {
    // For regular flat-top hex: H = (sqrt(3) / 2) * W ≈ 0.8660254 * W
    const width = 120;
    const height = HexGeometry.calculateRegularHeight(width);
    expect(height).toBeCloseTo(103.923, 3);
  });

  it("should throw for non-positive or invalid dimensions in static calculation", () => {
    expect(() => HexGeometry.calculateRegularWidth(0)).toThrow();
    expect(() => HexGeometry.calculateRegularWidth(-10)).toThrow();
    expect(() => HexGeometry.calculateRegularWidth(NaN)).toThrow();

    expect(() => HexGeometry.calculateRegularHeight(0)).toThrow();
    expect(() => HexGeometry.calculateRegularHeight(-10)).toThrow();
    expect(() => HexGeometry.calculateRegularHeight(Infinity)).toThrow();
  });

  it("should create HexGeometry with regular proportions and satisfy polygon geometry", () => {
    const height = 70;
    const regularWidth = HexGeometry.calculateRegularWidth(height);
    const geometry = new HexGeometry(regularWidth, height);

    expect(geometry.hexWidth).toBe(regularWidth);
    expect(geometry.hexHeight).toBe(height);

    const coord = new HexCoordinate(0, 0);
    const center = geometry.hexToPixel(coord);
    const polygon = geometry.getHexPolygon(coord);
    expect(polygon.length).toBe(6);

    // In a regular flat-top hexagon, distance from center to all 6 vertices is equal to halfW
    const expectedRadius = regularWidth / 2;
    for (const pt of polygon) {
      const dist = Math.hypot(pt.x - center.x, pt.y - center.y);
      expect(dist).toBeCloseTo(expectedRadius, 5);
    }
  });
});
