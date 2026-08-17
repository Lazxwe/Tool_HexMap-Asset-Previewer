import { HexCoordinate } from "../domain/hex/HexCoordinate";
import { HexGeometry } from "../domain/hex/HexGeometry";
import { TerrainMap } from "../domain/terrain/TerrainMap";
import { HexBounds, NoiseField, TerrainGenerationOptions } from "./NoiseTypes";
import { SeededNoiseField } from "./SeededNoiseField";
import { TerrainClassifier } from "./TerrainClassification";

/**
 * TerrainGenerator
 * Procedural terrain map generator orchestrating seeded noise fields, continuous spatial geometry, and classification.
 *
 * Pipeline per Hex:
 * 1. HexCoordinate (col, row)
 * 2. Continuous World Coordinates: (x, y) = HexGeometry.hexToPixel(coord)
 * 3. Spatial Scaling: (sampleX, sampleY) = (x / scale, y / scale)
 * 4. Continuous Noise: value = NoiseField.sample(sampleX, sampleY) -> [0, 1]
 * 5. Classification: terrainId = TerrainClassifier.classify(value)
 * 6. Assignment: TerrainMap.set(coord, terrainId)
 */
export class TerrainGenerator {
  public readonly noise: NoiseField;
  public readonly geometry: HexGeometry;
  public readonly classifier: TerrainClassifier;

  constructor(noise: NoiseField, geometry: HexGeometry, classifier: TerrainClassifier) {
    if (!noise || typeof noise.sample !== "function") {
      throw new Error("TerrainGenerator requires a valid NoiseField instance.");
    }
    if (!geometry || !(geometry instanceof HexGeometry)) {
      throw new Error("TerrainGenerator requires a valid HexGeometry instance.");
    }
    if (!classifier || !(classifier instanceof TerrainClassifier)) {
      throw new Error("TerrainGenerator requires a valid TerrainClassifier instance.");
    }

    this.noise = noise;
    this.geometry = geometry;
    this.classifier = classifier;
    Object.freeze(this);
  }

  /**
   * Generates a populated TerrainMap within the specified inclusive HexBounds.
   */
  public generate(bounds: HexBounds, options: TerrainGenerationOptions): TerrainMap {
    this.validateBounds(bounds);
    this.validateOptions(options);

    // Resolve noise field (use seeded instance if seed is provided, otherwise injected noise)
    const activeNoise: NoiseField =
      options.seed !== undefined
        ? new SeededNoiseField(options.seed)
        : this.noise;

    const terrainMap = new TerrainMap();
    const { minCol, maxCol, minRow, maxRow } = bounds;
    const frequency = 1 / options.scale;

    for (let c = minCol; c <= maxCol; c++) {
      for (let r = minRow; r <= maxRow; r++) {
        const coord = new HexCoordinate(c, r);
        const { x, y } = this.geometry.hexToPixel(coord);

        const noiseVal = activeNoise.sample(x * frequency, y * frequency);

        // Strict invariant check: NoiseField output must be in [0, 1]
        if (typeof noiseVal !== "number" || !Number.isFinite(noiseVal) || noiseVal < 0 || noiseVal > 1) {
          throw new Error(
            `NoiseField returned invalid value ${noiseVal} at sample position (${x * frequency}, ${y * frequency}). Expected finite number in [0, 1].`
          );
        }

        const terrainId = this.classifier.classify(noiseVal);
        terrainMap.set(coord, terrainId);
      }
    }

    return terrainMap;
  }

  private validateBounds(bounds: HexBounds): void {
    if (!bounds) {
      throw new Error("HexBounds are required.");
    }
    const { minCol, maxCol, minRow, maxRow } = bounds;

    if (
      !Number.isInteger(minCol) ||
      !Number.isInteger(maxCol) ||
      !Number.isInteger(minRow) ||
      !Number.isInteger(maxRow)
    ) {
      throw new Error("HexBounds coordinates must be integers.");
    }

    if (minCol > maxCol) {
      throw new Error(`Invalid bounds: minCol (${minCol}) cannot be greater than maxCol (${maxCol}).`);
    }

    if (minRow > maxRow) {
      throw new Error(`Invalid bounds: minRow (${minRow}) cannot be greater than maxRow (${maxRow}).`);
    }
  }

  private validateOptions(options: TerrainGenerationOptions): void {
    if (!options) {
      throw new Error("TerrainGenerationOptions are required.");
    }

    const { scale, seed } = options;

    if (typeof scale !== "number" || !Number.isFinite(scale) || scale <= 0) {
      throw new Error(`Invalid scale: ${scale}. Scale must be a positive finite number (> 0).`);
    }

    if (seed !== undefined && (typeof seed !== "number" || !Number.isFinite(seed))) {
      throw new Error(`Invalid seed: ${seed}. Seed must be a finite number.`);
    }
  }
}
