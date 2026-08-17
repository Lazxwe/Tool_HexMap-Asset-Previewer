/**
 * NoiseField
 * Abstract interface representing a continuous scalar noise field.
 * Samples are deterministic and normalized to the range [0, 1].
 */
export interface NoiseField {
  sample(x: number, y: number): number;
}

/**
 * HexBounds
 * Inclusive bounding box for hex grid generation.
 */
export interface HexBounds {
  readonly minCol: number;
  readonly maxCol: number;
  readonly minRow: number;
  readonly maxRow: number;
}

/**
 * TerrainGenerationOptions
 * Configuration parameters for procedural terrain generation.
 */
export interface TerrainGenerationOptions {
  readonly seed?: number;
  readonly scale: number;
}
