import { describe, it, expect } from "vitest";
import { TerrainId } from "../../src/domain/terrain/TerrainId";
import {
  createClassifierFromWeights,
  TerrainClassifier,
  TerrainThreshold,
} from "../../src/generation/TerrainClassification";

describe("TerrainClassifier", () => {
  const waterId = new TerrainId("water");
  const grassId = new TerrainId("grass");
  const forestId = new TerrainId("forest");
  const mountainId = new TerrainId("mountain");

  const standardThresholds: TerrainThreshold[] = [
    { terrainId: waterId, max: 0.25 },
    { terrainId: grassId, max: 0.5 },
    { terrainId: forestId, max: 0.75 },
    { terrainId: mountainId, max: 1.0 },
  ];

  it("should construct with valid increasing thresholds covering [0, 1]", () => {
    const classifier = new TerrainClassifier(standardThresholds);
    expect(classifier.getThresholds()).toHaveLength(4);
    expect(Object.isFrozen(classifier)).toBe(true);
  });

  it("should reject empty or invalid threshold configurations", () => {
    expect(() => new TerrainClassifier([])).toThrow();
    // @ts-expect-error - testing null defense
    expect(() => new TerrainClassifier(null)).toThrow();

    // Non-increasing max
    expect(
      () =>
        new TerrainClassifier([
          { terrainId: waterId, max: 0.5 },
          { terrainId: grassId, max: 0.3 },
          { terrainId: mountainId, max: 1.0 },
        ])
    ).toThrow();

    // Out of range max (< 0 or > 1)
    expect(
      () =>
        new TerrainClassifier([
          { terrainId: waterId, max: -0.1 },
          { terrainId: mountainId, max: 1.0 },
        ])
    ).toThrow();

    // Incomplete coverage (last threshold max < 1.0)
    expect(
      () =>
        new TerrainClassifier([
          { terrainId: waterId, max: 0.25 },
          { terrainId: grassId, max: 0.8 },
        ])
    ).toThrow(/must cover the entire \[0, 1\] range/);
  });

  it("should classify values according to exact <= boundary semantics", () => {
    const classifier = new TerrainClassifier(standardThresholds);

    // [0.00, 0.25] -> water
    expect(classifier.classify(0.0)).toBe(waterId);
    expect(classifier.classify(0.1)).toBe(waterId);
    expect(classifier.classify(0.25)).toBe(waterId);

    // (0.25, 0.50] -> grass
    expect(classifier.classify(0.250001)).toBe(grassId);
    expect(classifier.classify(0.4)).toBe(grassId);
    expect(classifier.classify(0.5)).toBe(grassId);

    // (0.50, 0.75] -> forest
    expect(classifier.classify(0.500001)).toBe(forestId);
    expect(classifier.classify(0.65)).toBe(forestId);
    expect(classifier.classify(0.75)).toBe(forestId);

    // (0.75, 1.00] -> mountain
    expect(classifier.classify(0.750001)).toBe(mountainId);
    expect(classifier.classify(0.99)).toBe(mountainId);
    expect(classifier.classify(1.0)).toBe(mountainId);
  });

  it("should reject invalid classification input values (< 0, > 1, NaN, Infinity)", () => {
    const classifier = new TerrainClassifier(standardThresholds);

    expect(() => classifier.classify(-0.01)).toThrow();
    expect(() => classifier.classify(1.01)).toThrow();
    expect(() => classifier.classify(NaN)).toThrow();
    expect(() => classifier.classify(Infinity)).toThrow();
  });
});

describe("createClassifierFromWeights", () => {
  const forestId = new TerrainId("forest");
  const mountainId = new TerrainId("mountain");
  const waterId = new TerrainId("water");

  it("should generate proportionally partitioned thresholds for given weights", () => {
    // 2:1 weight ratio -> 66.67% and 100%
    const classifier = createClassifierFromWeights([
      { terrainId: forestId, weight: 2 },
      { terrainId: mountainId, weight: 1 },
    ]);

    const thresholds = classifier.getThresholds();
    expect(thresholds).toHaveLength(2);
    expect(thresholds[0].terrainId.value).toBe("forest");
    expect(thresholds[0].max).toBeCloseTo(2 / 3, 5);
    expect(thresholds[1].terrainId.value).toBe("mountain");
    expect(thresholds[1].max).toBe(1.0);

    expect(classifier.classify(0.1)).toEqual(forestId);
    expect(classifier.classify(0.66)).toEqual(forestId);
    expect(classifier.classify(0.67)).toEqual(mountainId);
    expect(classifier.classify(1.0)).toEqual(mountainId);
  });

  it("should ignore terrains with 0 or negative weight", () => {
    const classifier = createClassifierFromWeights([
      { terrainId: forestId, weight: 1 },
      { terrainId: waterId, weight: 0 },
      { terrainId: mountainId, weight: 1 },
    ]);

    const thresholds = classifier.getThresholds();
    expect(thresholds).toHaveLength(2);
    expect(thresholds[0].terrainId.value).toBe("forest");
    expect(thresholds[0].max).toBe(0.5);
    expect(thresholds[1].terrainId.value).toBe("mountain");
    expect(thresholds[1].max).toBe(1.0);
  });

  it("should reject empty list or list without any positive weights", () => {
    expect(() => createClassifierFromWeights([])).toThrow();
    expect(() =>
      createClassifierFromWeights([
        { terrainId: forestId, weight: 0 },
        { terrainId: mountainId, weight: -1 },
      ])
    ).toThrow(/positive weight/);
  });
});
