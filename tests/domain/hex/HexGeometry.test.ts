import { describe, it, expect } from "vitest";
import { HexCoordinate } from "../../../src/domain/hex/HexCoordinate";
import { HexGeometry, Point2D } from "../../../src/domain/hex/HexGeometry";

// Helper: independent Point-In-Polygon test via winding number/cross-product for convex flat-top hex
function isPointStrictlyInsidePolygon(p: Point2D, vertices: Point2D[]): boolean {
  for (let i = 0; i < vertices.length; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % vertices.length];
    // Cross product (v2 - v1) x (p - v1)
    const cross = (v2.x - v1.x) * (p.y - v1.y) - (v2.y - v1.y) * (p.x - v1.x);
    // Since vertices are ordered clockwise, interior points must have cross >= 0 (or strictly > 0)
    if (cross <= 1e-9) {
      return false;
    }
  }
  return true;
}

describe("HexGeometry Consistency & Boundary Validation", () => {
  const aspectRatios = [
    { w: 100, h: 100, name: "100x100 (Square)" },
    { w: 160, h: 80, name: "160x80 (Wide 2:1)" },
    { w: 80, h: 160, name: "80x160 (Tall 1:2)" },
    { w: 200, h: 60, name: "200x60 (Ultra-Wide)" },
    { w: 60, h: 200, name: "60x200 (Ultra-Tall)" },
  ];

  const sampleCoordinates = [
    new HexCoordinate(0, 0),
    new HexCoordinate(1, 0),
    new HexCoordinate(0, 1),
    new HexCoordinate(1, 1),
    new HexCoordinate(5, 7),
    new HexCoordinate(20, 35),
    new HexCoordinate(-1, 0),
    new HexCoordinate(0, -1),
    new HexCoordinate(-1, -1),
    new HexCoordinate(-4, 6),
    new HexCoordinate(8, -12),
    new HexCoordinate(-15, -25),
  ];

  describe("1. Interior Points Classification", () => {
    aspectRatios.forEach(({ w, h, name }) => {
      it(`should correctly classify interior points for aspect ratio ${name}`, () => {
        const geo = new HexGeometry(w, h);

        for (const coord of sampleCoordinates) {
          const center = geo.hexToPixel(coord);
          const vertices = geo.getHexPolygon(coord);

          // Center point must map to coord
          expect(geo.pixelToHex(center).equals(coord)).toBe(true);

          // Generate interior points via convex combination of vertices
          // P = sum(w_i * V_i) where sum(w_i) = 1, w_i > 0
          const interiorWeights = [
            [0.2, 0.2, 0.2, 0.2, 0.1, 0.1],
            [0.4, 0.1, 0.1, 0.2, 0.1, 0.1],
            [0.05, 0.5, 0.05, 0.2, 0.1, 0.1],
            [0.1, 0.1, 0.4, 0.1, 0.1, 0.2],
            [0.15, 0.15, 0.15, 0.15, 0.2, 0.2],
          ];

          for (const weights of interiorWeights) {
            let px = 0;
            let py = 0;
            for (let i = 0; i < 6; i++) {
              px += weights[i] * vertices[i].x;
              py += weights[i] * vertices[i].y;
            }
            const point = { x: px, y: py };
            expect(isPointStrictlyInsidePolygon(point, vertices)).toBe(true);
            const picked = geo.pixelToHex(point);
            expect(picked.equals(coord)).toBe(true);
          }

          // Random interior points towards vertices: Center + 0.8 * (V_i - Center)
          for (let i = 0; i < 6; i++) {
            for (const t of [0.1, 0.3, 0.5, 0.7, 0.9, 0.95]) {
              const px = center.x + t * (vertices[i].x - center.x);
              const py = center.y + t * (vertices[i].y - center.y);
              const point = { x: px, y: py };
              expect(isPointStrictlyInsidePolygon(point, vertices)).toBe(true);
              const picked = geo.pixelToHex(point);
              expect(picked.equals(coord)).toBe(true);
            }
          }
        }
      });
    });
  });

  describe("2. Near-Edge Points Classification", () => {
    aspectRatios.forEach(({ w, h, name }) => {
      it(`should classify points near all 6 edges from the inside for ${name}`, () => {
        const geo = new HexGeometry(w, h);

        for (const coord of sampleCoordinates) {
          const center = geo.hexToPixel(coord);
          const vertices = geo.getHexPolygon(coord);

          // For each edge (V_i -> V_{i+1}):
          for (let i = 0; i < 6; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % 6];
            const edgeMidX = (v1.x + v2.x) / 2;
            const edgeMidY = (v1.y + v2.y) / 2;

            // Point slightly inside (shifted 1% and 0.1% towards center from edge midpoint)
            for (const eps of [0.01, 0.001]) {
              const nearEdgePoint: Point2D = {
                x: edgeMidX + eps * (center.x - edgeMidX),
                y: edgeMidY + eps * (center.y - edgeMidY),
              };

              expect(isPointStrictlyInsidePolygon(nearEdgePoint, vertices)).toBe(true);
              const picked = geo.pixelToHex(nearEdgePoint);
              expect(picked.equals(coord)).toBe(true);
            }
          }
        }
      });
    });
  });

  describe("3. Near-Corner Points Classification", () => {
    aspectRatios.forEach(({ w, h, name }) => {
      it(`should classify points near all 6 vertices from the inside for ${name}`, () => {
        const geo = new HexGeometry(w, h);

        for (const coord of sampleCoordinates) {
          const center = geo.hexToPixel(coord);
          const vertices = geo.getHexPolygon(coord);

          // For each of the 6 vertices:
          for (let i = 0; i < 6; i++) {
            const v = vertices[i];

            // Point slightly inside (shifted 1% and 0.1% towards center from vertex)
            for (const eps of [0.01, 0.001]) {
              const nearCornerPoint: Point2D = {
                x: v.x + eps * (center.x - v.x),
                y: v.y + eps * (center.y - v.y),
              };

              expect(isPointStrictlyInsidePolygon(nearCornerPoint, vertices)).toBe(true);
              const picked = geo.pixelToHex(nearCornerPoint);
              expect(picked.equals(coord)).toBe(true);
            }
          }
        }
      });
    });
  });

  describe("4. Neighbor Boundary Crossing Tests", () => {
    aspectRatios.forEach(({ w, h, name }) => {
      it(`should distinguish points on both sides of shared boundaries for ${name}`, () => {
        const geo = new HexGeometry(w, h);

        for (const coord of sampleCoordinates) {
          const centerA = geo.hexToPixel(coord);
          const neighbors = geo.getHexNeighbors(coord);

          for (const neighbor of neighbors) {
            const centerB = geo.hexToPixel(neighbor);

            // Midpoint between centerA and centerB lies exactly on the shared boundary segment
            const midX = (centerA.x + centerB.x) / 2;
            const midY = (centerA.y + centerB.y) / 2;

            // Point on A's side (shifted 0.5% towards centerA)
            const pointInA: Point2D = {
              x: midX + 0.005 * (centerA.x - midX),
              y: midY + 0.005 * (centerA.y - midY),
            };

            // Point on B's side (shifted 0.5% towards centerB)
            const pointInB: Point2D = {
              x: midX + 0.005 * (centerB.x - midX),
              y: midY + 0.005 * (centerB.y - midY),
            };

            expect(geo.pixelToHex(pointInA).equals(coord)).toBe(true);
            expect(geo.pixelToHex(pointInB).equals(neighbor)).toBe(true);
          }
        }
      });
    });
  });

  describe("5. Boundary Determinism & Tie-Breaking", () => {
    aspectRatios.forEach(({ w, h, name }) => {
      it(`should deterministically break ties for points exactly on boundary for ${name}`, () => {
        const geo = new HexGeometry(w, h);

        for (const coord of sampleCoordinates) {
          const centerA = geo.hexToPixel(coord);
          const neighbors = geo.getHexNeighbors(coord);

          for (const neighbor of neighbors) {
            const centerB = geo.hexToPixel(neighbor);

            // Exactly on the shared boundary
            const exactMid: Point2D = {
              x: (centerA.x + centerB.x) / 2,
              y: (centerA.y + centerB.y) / 2,
            };

            const picked1 = geo.pixelToHex(exactMid);
            const picked2 = geo.pixelToHex(exactMid);

            // Deterministic stability
            expect(picked1.equals(picked2)).toBe(true);

            // Must be one of the two sharing hexes
            const isAOrB = picked1.equals(coord) || picked1.equals(neighbor);
            expect(isAOrB).toBe(true);

            // Tie-break rule: smallest col, then smallest row
            const expectedWinner =
              coord.col < neighbor.col || (coord.col === neighbor.col && coord.row < neighbor.row)
                ? coord
                : neighbor;

            expect(picked1.equals(expectedWinner)).toBe(true);
          }
        }
      });
    });
  });

  describe("6. Polygon Geometric Properties", () => {
    it("should strictly maintain Flat-top horizontal top/bottom edges", () => {
      const geo = new HexGeometry(150, 90);
      const polygon = geo.getHexPolygon(new HexCoordinate(2, 3));

      // V4 and V5 are top edge: Y values must be identical
      expect(polygon[4].y).toBeCloseTo(polygon[5].y, 10);
      // V2 and V1 are bottom edge: Y values must be identical
      expect(polygon[1].y).toBeCloseTo(polygon[2].y, 10);

      // Top edge length = 0.5 * hexWidth
      expect(polygon[5].x - polygon[4].x).toBeCloseTo(75, 10);
      // Bottom edge length = 0.5 * hexWidth
      expect(polygon[1].x - polygon[2].x).toBeCloseTo(75, 10);
    });
  });
});
