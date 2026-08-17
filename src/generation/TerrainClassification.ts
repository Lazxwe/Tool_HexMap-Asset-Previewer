import { TerrainId } from "../domain/terrain/TerrainId";

export interface TerrainThreshold {
  readonly terrainId: TerrainId;
  readonly max: number;
}

/**
 * TerrainClassifier
 * Maps normalized continuous scalar values [0, 1] to discrete TerrainIds based on ordered thresholds.
 *
 * Boundary rule:
 * Value is mapped to the first threshold satisfying `value <= threshold.max`.
 */
export class TerrainClassifier {
  private readonly thresholds: readonly TerrainThreshold[];

  constructor(thresholds: readonly TerrainThreshold[]) {
    if (!thresholds || !Array.isArray(thresholds) || thresholds.length === 0) {
      throw new Error("TerrainClassifier requires a non-empty list of TerrainThresholds.");
    }

    let prevMax = -1;
    for (let i = 0; i < thresholds.length; i++) {
      const t = thresholds[i];
      if (!t || !(t.terrainId instanceof TerrainId)) {
        throw new Error(`Threshold at index ${i} must have a valid TerrainId instance.`);
      }
      if (typeof t.max !== "number" || !Number.isFinite(t.max) || t.max < 0 || t.max > 1) {
        throw new Error(
          `Invalid threshold max at index ${i}: ${t.max}. Must be a finite number in range [0, 1].`
        );
      }
      if (t.max <= prevMax) {
        throw new Error(
          `Threshold max values must be strictly increasing. Index ${i} (${t.max}) <= Index ${i - 1} (${prevMax}).`
        );
      }
      prevMax = t.max;
    }

    const last = thresholds[thresholds.length - 1];
    if (last.max < 1.0) {
      throw new Error(
        `Thresholds must cover the entire [0, 1] range. Last threshold max is ${last.max}, expected 1.0.`
      );
    }

    this.thresholds = thresholds.map((t) => ({
      terrainId: t.terrainId,
      max: t.max,
    }));
    Object.freeze(this.thresholds);
    Object.freeze(this);
  }

  /**
   * Classifies a normalized scalar value [0, 1] into a TerrainId.
   */
  public classify(value: number): TerrainId {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(
        `Invalid classification value: ${value}. Value must be a finite number in range [0, 1].`
      );
    }

    for (const threshold of this.thresholds) {
      if (value <= threshold.max) {
        return threshold.terrainId;
      }
    }

    // Fallback to the last threshold (handles floating-point edge cases at exactly 1.0)
    return this.thresholds[this.thresholds.length - 1].terrainId;
  }

  public getThresholds(): readonly TerrainThreshold[] {
    return this.thresholds;
  }
}
