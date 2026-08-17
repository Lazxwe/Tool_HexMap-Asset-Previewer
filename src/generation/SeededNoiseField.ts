import { NoiseField } from "./NoiseTypes";

/**
 * SeededNoiseField
 * Deterministic, smooth 2D value noise field with quintic interpolation.
 *
 * Guaranteed properties:
 * - Normalized scalar output strictly within [0, 1]
 * - C^2 continuous (no sharp lattice seams or sudden discontinuous jumps)
 * - 100% deterministic based on integer/floating-point seed
 * - Pure algorithm with zero global state, Math.random(), or DOM dependencies
 */
export class SeededNoiseField implements NoiseField {
  public readonly seed: number;
  private readonly intSeed: number;

  constructor(seed: number) {
    if (typeof seed !== "number" || !Number.isFinite(seed)) {
      throw new Error(`Invalid seed: ${seed}. Seed must be a finite number.`);
    }
    this.seed = seed;
    // Map floating-point or integer seed into a 32-bit integer
    this.intSeed = (Math.floor(seed) ^ Math.imul(Math.floor(seed * 1000000), 0x85ebca6b)) | 0;
    Object.freeze(this);
  }

  /**
   * Samples the continuous 2D noise field at world position (x, y).
   * Returns a normalized scalar value strictly in [0, 1].
   */
  public sample(x: number, y: number): number {
    if (typeof x !== "number" || !Number.isFinite(x) || typeof y !== "number" || !Number.isFinite(y)) {
      throw new Error(`Invalid coordinates: (${x}, ${y}). Coordinates must be finite numbers.`);
    }

    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const fx = x - x0;
    const fy = y - y0;

    // Quintic Hermite interpolation curve: 6t^5 - 15t^4 + 10t^3
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);

    // Sample pseudorandom lattice corner values in [0, 1]
    const v00 = this.hash2D(x0, y0);
    const v10 = this.hash2D(x1, y0);
    const v01 = this.hash2D(x0, y1);
    const v11 = this.hash2D(x1, y1);

    // Bilinear interpolation
    const top = v00 + u * (v10 - v00);
    const bottom = v01 + u * (v11 - v01);
    const result = top + v * (bottom - top);

    // Ensure output strictly in [0, 1]
    return Math.max(0, Math.min(1, result));
  }

  /**
   * Deterministic 32-bit integer hash mixer.
   * Maps 2D integer grid lattice vertices to a uniform float in [0, 1].
   */
  private hash2D(ix: number, iy: number): number {
    let h = this.intSeed ^ Math.imul(ix | 0, 0x165667b1) ^ Math.imul(iy | 0, 0xd3a2646c);
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967295.0;
  }
}
