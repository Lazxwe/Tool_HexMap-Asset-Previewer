/**
 * RandomSource
 * Abstract interface for pseudorandom number generators.
 * Invariant: Returns a float strictly in the half-open interval [0, 1).
 */
export interface RandomSource {
  next(): number;
}
