import { describe, it, expect } from "vitest";
import { HexCoordinate } from "../../src/domain/hex/HexCoordinate";
import { HexGeometry } from "../../src/domain/hex/HexGeometry";
import { TerrainId } from "../../src/domain/terrain/TerrainId";
import { NoiseField } from "../../src/generation/NoiseTypes";
import { SeededNoiseField } from "../../src/generation/SeededNoiseField";
import { TerrainClassifier } from "../../src/generation/TerrainClassification";
import { TerrainGenerator } from "../../src/generation/TerrainGenerator";

class ConstantNoiseField implements NoiseField {
  constructor(public value: number) {}
  sample(): number {
    return this.value;
  }
}

describe("TerrainGenerator", () => {
  const geometry = new HexGeometry(120, 70);
  const water = new TerrainId("water");
  const grass = new TerrainId("grass");
  const forest = new TerrainId("forest");
  const mountain = new TerrainId("mountain");

  const classifier = new TerrainClassifier([
    { terrainId: water, max: 0.25 },
    { terrainId: grass, max: 0.5 },
    { terrainId: forest, max: 0.75 },
    { terrainId: mountain, max: 1.0 },
  ]);

  it("A. should generate a TerrainMap for basic 3x3 bounds (9 entries)", () => {
    const noise = new SeededNoiseField(42);
    const generator = new TerrainGenerator(noise, geometry, classifier);

    const bounds = { minCol: 0, maxCol: 2, minRow: 0, maxRow: 2 };
    const map = generator.generate(bounds, { seed: 42, scale: 100 });

    expect(map.size).toBe(9);
    for (let c = 0; c <= 2; c++) {
      for (let r = 0; r <= 2; r++) {
        expect(map.has(new HexCoordinate(c, r))).toBe(true);
        expect(map.get(new HexCoordinate(c, r))).toBeInstanceOf(TerrainId);
      }
    }
  });

  it("B. should generate single cell bounds (min=max -> 1 entry)", () => {
    const noise = new SeededNoiseField(42);
    const generator = new TerrainGenerator(noise, geometry, classifier);

    const bounds = { minCol: 5, maxCol: 5, minRow: 8, maxRow: 8 };
    const map = generator.generate(bounds, { seed: 42, scale: 100 });

    expect(map.size).toBe(1);
    expect(map.has(new HexCoordinate(5, 8))).toBe(true);
  });

  it("C. should generate across negative coordinate bounds", () => {
    const noise = new SeededNoiseField(42);
    const generator = new TerrainGenerator(noise, geometry, classifier);

    // minCol: -2, maxCol: 1 (4 cols: -2, -1, 0, 1)
    // minRow: -1, maxRow: 1 (3 rows: -1, 0, 1)
    // Total = 4 * 3 = 12 entries
    const bounds = { minCol: -2, maxCol: 1, minRow: -1, maxRow: 1 };
    const map = generator.generate(bounds, { seed: 42, scale: 100 });

    expect(map.size).toBe(12);
    expect(map.has(new HexCoordinate(-2, -1))).toBe(true);
    expect(map.has(new HexCoordinate(1, 1))).toBe(true);
  });

  it("D. should be 100% deterministic with identical seed and options", () => {
    const noise = new SeededNoiseField(999);
    const generator = new TerrainGenerator(noise, geometry, classifier);

    const bounds = { minCol: 0, maxCol: 10, minRow: 0, maxRow: 10 };
    const map1 = generator.generate(bounds, { seed: 999, scale: 150 });
    const map2 = generator.generate(bounds, { seed: 999, scale: 150 });

    expect(map1.size).toBe(map2.size);
    for (const entry of map1.entries()) {
      const match = map2.get(entry.coord);
      expect(match?.value).toBe(entry.terrainId.value);
    }
  });

  it("E. should produce different terrain distributions for different seeds", () => {
    const noise = new SeededNoiseField(111);
    const generator = new TerrainGenerator(noise, geometry, classifier);

    const bounds = { minCol: 0, maxCol: 15, minRow: 0, maxRow: 15 };
    const mapA = generator.generate(bounds, { seed: 111, scale: 100 });
    const mapB = generator.generate(bounds, { seed: 888, scale: 100 });

    let diffCount = 0;
    for (const entry of mapA.entries()) {
      const other = mapB.get(entry.coord);
      if (other?.value !== entry.terrainId.value) {
        diffCount++;
      }
    }

    expect(diffCount).toBeGreaterThan(50); // Substantial differences across 256 cells
  });

  it("F. should support dependency injection with mock/fake NoiseField", () => {
    const fakeNoise = new ConstantNoiseField(0.1); // maps to water
    const generator = new TerrainGenerator(fakeNoise, geometry, classifier);

    const bounds = { minCol: 0, maxCol: 1, minRow: 0, maxRow: 1 };
    const mapWater = generator.generate(bounds, { scale: 50 });

    for (const entry of mapWater.entries()) {
      expect(entry.terrainId.value).toBe("water");
    }

    // Change fake noise to 0.65 (maps to forest)
    fakeNoise.value = 0.65;
    const mapForest = generator.generate(bounds, { scale: 50 });
    for (const entry of mapForest.entries()) {
      expect(entry.terrainId.value).toBe("forest");
    }
  });

  it("G. should reject invalid bounds configurations", () => {
    const noise = new SeededNoiseField(42);
    const generator = new TerrainGenerator(noise, geometry, classifier);

    expect(() =>
      generator.generate({ minCol: 5, maxCol: 2, minRow: 0, maxRow: 0 }, { scale: 100 })
    ).toThrow(/minCol/);

    expect(() =>
      generator.generate({ minCol: 0, maxCol: 2, minRow: 5, maxRow: 1 }, { scale: 100 })
    ).toThrow(/minRow/);
  });

  it("H. should reject invalid options (scale <= 0, NaN, Infinity)", () => {
    const noise = new SeededNoiseField(42);
    const generator = new TerrainGenerator(noise, geometry, classifier);
    const bounds = { minCol: 0, maxCol: 1, minRow: 0, maxRow: 1 };

    expect(() => generator.generate(bounds, { scale: 0 })).toThrow(/Invalid scale/);
    expect(() => generator.generate(bounds, { scale: -10 })).toThrow(/Invalid scale/);
    expect(() => generator.generate(bounds, { scale: NaN })).toThrow(/Invalid scale/);
    expect(() => generator.generate(bounds, { scale: Infinity })).toThrow(/Invalid scale/);
  });

  it("I. should strictly throw when a NoiseField violates the [0, 1] invariant", () => {
    const invalidNoise = new ConstantNoiseField(1.5); // Invalid out-of-range value
    const generator = new TerrainGenerator(invalidNoise, geometry, classifier);
    const bounds = { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 };

    expect(() => generator.generate(bounds, { scale: 100 })).toThrow(/NoiseField returned invalid value/);
  });
});
