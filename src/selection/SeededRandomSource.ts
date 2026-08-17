import { RandomSource } from "./RandomTypes";

/**
 * SeededRandomSource
 * Deterministic pseudorandom number generator based on the Mulberry32 algorithm.
 *
 * Guarantees:
 * - Output values strictly in the half-open interval [0, 1)
 * - 100% reproducible sequence given the same seed
 * - Independent instance state (no shared global RNG)
 * - Zero dependency on Math.random() or Date.now()
 */
export class SeededRandomSource implements RandomSource {
  public readonly seed: number;
  private state: number;

  constructor(seed: number) {
    if (typeof seed !== "number" || !Number.isFinite(seed)) {
      throw new Error(`Invalid seed: ${seed}. Seed must be a finite number.`);
    }

    this.seed = seed;
    // Map integer or floating-point seed into a 32-bit internal state
    this.state =
      (Math.floor(seed) ^ Math.imul(Math.floor(seed * 1000000), 0x85ebca6b)) | 0;
  }

  /**
   * Generates the next pseudorandom float in [0, 1).
   */
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const u32 = (t ^ (t >>> 14)) >>> 0;
    // Divide by 2^32 to guarantee strictly [0, 1)
    return u32 / 4294967296.0;
  }
}
