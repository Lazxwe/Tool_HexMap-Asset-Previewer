import { HexCoordinate } from "./HexCoordinate";

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface HexDimensions {
  readonly hexWidth: number;
  readonly hexHeight: number;
}

/**
 * HexGeometry
 * Pure geometry operations for Flat-top hexagonal grid with independent width & height.
 *
 * Coordinate Convention: odd-q (Odd columns are shifted downwards by 0.5 * hexHeight).
 *
 * All functions are deterministic, geometrically consistent with getHexPolygon(),
 * and purely mathematical with zero dependencies on Canvas/DOM/browser APIs.
 */
export class HexGeometry {
  public readonly hexWidth: number;
  public readonly hexHeight: number;

  constructor(hexWidth: number, hexHeight: number) {
    HexGeometry.validateDimensions(hexWidth, hexHeight);
    this.hexWidth = hexWidth;
    this.hexHeight = hexHeight;
  }

  /**
   * Validate that hex dimensions are positive finite numbers
   */
  public static validateDimensions(hexWidth: number, hexHeight: number): void {
    if (!Number.isFinite(hexWidth) || hexWidth <= 0) {
      throw new Error(`Invalid hexWidth: ${hexWidth}. Width must be a positive finite number.`);
    }
    if (!Number.isFinite(hexHeight) || hexHeight <= 0) {
      throw new Error(`Invalid hexHeight: ${hexHeight}. Height must be a positive finite number.`);
    }
  }

  /**
   * Converts a HexCoordinate to pixel-space center point.
   *
   * Formula for Flat-top (odd-q):
   *   centerX = (col * 0.75 + 0.5) * hexWidth
   *   centerY = (row + 0.5 + (isOdd(col) ? 0.5 : 0)) * hexHeight
   */
  public hexToPixel(coord: HexCoordinate): Point2D {
    const isOdd = ((coord.col % 2) + 2) % 2 === 1;
    const x = (coord.col * 0.75 + 0.5) * this.hexWidth;
    const y = (coord.row + 0.5 + (isOdd ? 0.5 : 0)) * this.hexHeight;
    return { x, y };
  }

  /**
   * Converts a pixel position to the corresponding HexCoordinate using exact polygon-consistent geometry.
   *
   * Geometric Invariant:
   * A point (px, py) lies inside a flat-top hex centered at (cx, cy) with dimensions (W, H)
   * if and only if:
   *   |2 * (px - cx) / W| + |(py - cy) / H| <= 1  AND  2 * |(py - cy) / H| <= 1
   * Defining the normalized distance metric:
   *   M = max( 2 * |u| + |v|, 2 * |v| ), where u = (px - cx) / W, v = (py - cy) / H.
   *
   * - A point strictly inside the polygon has M < 1.
   * - A point on the polygon boundary has M = 1.
   *
   * Deterministic Boundary Rule:
   * When a point lies on a shared boundary between multiple hexes (M_a == M_b == 1),
   * tie-breaking deterministically selects the candidate with the smallest column (`col`),
   * and if columns are equal, the smallest row (`row`).
   */
  public pixelToHex(pixel: Point2D): HexCoordinate {
    if (!Number.isFinite(pixel.x) || !Number.isFinite(pixel.y)) {
      throw new Error(`Invalid pixel coordinates: (${pixel.x}, ${pixel.y})`);
    }

    const W = this.hexWidth;
    const H = this.hexHeight;

    // Approximate the primary candidate column
    const approxCol = Math.round((pixel.x / W - 0.5) / 0.75);

    let bestCoord: HexCoordinate | null = null;
    let minMetric = Infinity;
    const EPSILON = 1e-11;

    // Test a local window of candidate columns [approxCol - 1, approxCol, approxCol + 1]
    for (let c = approxCol - 1; c <= approxCol + 1; c++) {
      const isOdd = ((c % 2) + 2) % 2 === 1;
      const colYOffset = (0.5 + (isOdd ? 0.5 : 0)) * H;
      const approxRow = Math.round((pixel.y - colYOffset) / H);

      // Test candidate rows [approxRow - 1, approxRow, approxRow + 1]
      for (let r = approxRow - 1; r <= approxRow + 1; r++) {
        const cx = (c * 0.75 + 0.5) * W;
        const cy = (r + 0.5 + (isOdd ? 0.5 : 0)) * H;

        const u = (pixel.x - cx) / W;
        const v = (pixel.y - cy) / H;

        const absU = Math.abs(u);
        const absV = Math.abs(v);

        // Normalized distance metric derived from exact polygon half-planes
        const metric = Math.max(2 * absU + absV, 2 * absV);

        if (bestCoord === null) {
          bestCoord = new HexCoordinate(c, r);
          minMetric = metric;
        } else {
          const diff = metric - minMetric;
          if (diff < -EPSILON) {
            // Strictly better (closer to center / strictly inside)
            bestCoord = new HexCoordinate(c, r);
            minMetric = metric;
          } else if (Math.abs(diff) <= EPSILON) {
            // Deterministic tie-break: smallest col, then smallest row
            if (c < bestCoord.col || (c === bestCoord.col && r < bestCoord.row)) {
              bestCoord = new HexCoordinate(c, r);
              minMetric = metric;
            }
          }
        }
      }
    }

    if (!bestCoord) {
      throw new Error(`Failed to resolve pixel (${pixel.x}, ${pixel.y}) to a HexCoordinate`);
    }

    return bestCoord;
  }

  /**
   * Returns the 6 polygon vertices of the hex in pixel coordinates.
   *
   * Vertices are ordered clockwise starting from East (Right) tip:
   * 0: East (cx + W/2, cy)
   * 1: Southeast (cx + W/4, cy + H/2)
   * 2: Southwest (cx - W/4, cy + H/2)
   * 3: West (cx - W/2, cy)
   * 4: Northwest (cx - W/4, cy - H/2)
   * 5: Northeast (cx + W/4, cy - H/2)
   *
   * Top and Bottom edges are strictly horizontal:
   * - Top edge: between V4 and V5 with y = cy - H/2
   * - Bottom edge: between V2 and V1 with y = cy + H/2
   */
  public getHexPolygon(coord: HexCoordinate): Point2D[] {
    const { x: cx, y: cy } = this.hexToPixel(coord);
    const halfW = this.hexWidth / 2;
    const quarterW = this.hexWidth / 4;
    const halfH = this.hexHeight / 2;

    return [
      { x: cx + halfW, y: cy },
      { x: cx + quarterW, y: cy + halfH },
      { x: cx - quarterW, y: cy + halfH },
      { x: cx - halfW, y: cy },
      { x: cx - quarterW, y: cy - halfH },
      { x: cx + quarterW, y: cy - halfH },
    ];
  }

  /**
   * Returns the 6 neighboring HexCoordinates for a given hex in odd-q flat-top layout.
   *
   * Order of returned neighbors is deterministic (Clockwise starting from Northeast):
   * 0: Northeast (Top-Right)
   * 1: Southeast (Bottom-Right)
   * 2: South (Bottom)
   * 3: Southwest (Bottom-Left)
   * 4: Northwest (Top-Left)
   * 5: North (Top)
   */
  public getHexNeighbors(coord: HexCoordinate): HexCoordinate[] {
    const isOdd = ((coord.col % 2) + 2) % 2 === 1;

    if (isOdd) {
      return [
        new HexCoordinate(coord.col + 1, coord.row),     // 0: Northeast
        new HexCoordinate(coord.col + 1, coord.row + 1), // 1: Southeast
        new HexCoordinate(coord.col, coord.row + 1),     // 2: South
        new HexCoordinate(coord.col - 1, coord.row + 1), // 3: Southwest
        new HexCoordinate(coord.col - 1, coord.row),     // 4: Northwest
        new HexCoordinate(coord.col, coord.row - 1),     // 5: North
      ];
    } else {
      return [
        new HexCoordinate(coord.col + 1, coord.row - 1), // 0: Northeast
        new HexCoordinate(coord.col + 1, coord.row),     // 1: Southeast
        new HexCoordinate(coord.col, coord.row + 1),     // 2: South
        new HexCoordinate(coord.col - 1, coord.row),     // 3: Southwest
        new HexCoordinate(coord.col - 1, coord.row - 1), // 4: Northwest
        new HexCoordinate(coord.col, coord.row - 1),     // 5: North
      ];
    }
  }
}
