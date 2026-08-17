import { describe, it, expect } from "vitest";
import { SeededNoiseField } from "../../src/generation/SeededNoiseField";

describe("SeededNoiseField", () => {
  it("should be 100% deterministic for the same seed and coordinates", () => {
    const field1 = new SeededNoiseField(1337);
    const field2 = new SeededNoiseField(1337);

    for (let x = -10; x <= 10; x += 1.5) {
      for (let y = -10; y <= 10; y += 1.5) {
        expect(field1.sample(x, y)).toBe(field2.sample(x, y));
      }
    }
  });

  it("should produce different values for different seeds", () => {
    const fieldA = new SeededNoiseField(1111);
    const fieldB = new SeededNoiseField(9999);

    let differences = 0;
    const totalSamples = 50;

    for (let i = 0; i < totalSamples; i++) {
      const x = i * 2.3;
      const y = i * 1.7;
      if (fieldA.sample(x, y) !== fieldB.sample(x, y)) {
        differences++;
      }
    }

    expect(differences).toBeGreaterThan(45); // Almost all samples differ
  });

  it("should reject invalid seed values (NaN, Infinity, non-number)", () => {
    expect(() => new SeededNoiseField(NaN)).toThrow();
    expect(() => new SeededNoiseField(Infinity)).toThrow();
    expect(() => new SeededNoiseField(-Infinity)).toThrow();
    // @ts-expect-error - testing runtime type defense
    expect(() => new SeededNoiseField("123")).toThrow();
  });

  it("should reject invalid coordinates (NaN, Infinity)", () => {
    const field = new SeededNoiseField(42);
    expect(() => field.sample(NaN, 0)).toThrow();
    expect(() => field.sample(0, Infinity)).toThrow();
    expect(() => field.sample(-Infinity, 0)).toThrow();
  });

  it("should always produce sample values strictly within [0, 1]", () => {
    const field = new SeededNoiseField(42);

    for (let x = -50; x <= 50; x += 3.7) {
      for (let y = -50; y <= 50; y += 3.7) {
        const val = field.sample(x, y);
        expect(val).toBeGreaterThanOrEqual(0.0);
        expect(val).toBeLessThanOrEqual(1.0);
      }
    }
  });

  it("should demonstrate spatial continuity (smooth gradients without sudden jumps)", () => {
    const field = new SeededNoiseField(12345);
    const step = 0.05;
    let maxDelta = 0;
    let sumDelta = 0;
    let count = 0;

    // Sample across a 2D patch with step size 0.05
    for (let x = 0; x < 5; x += step) {
      for (let y = 0; y < 5; y += step) {
        const current = field.sample(x, y);
        const right = field.sample(x + step, y);
        const down = field.sample(x, y + step);

        const deltaX = Math.abs(right - current);
        const deltaY = Math.abs(down - current);

        maxDelta = Math.max(maxDelta, deltaX, deltaY);
        sumDelta += deltaX + deltaY;
        count += 2;
      }
    }

    const avgDelta = sumDelta / count;

    // A smoothly continuous noise field will have very small steps (avg << 0.1)
    expect(avgDelta).toBeLessThan(0.05);
    expect(maxDelta).toBeLessThan(0.15); // No sudden catastrophic discontinuities
  });
});
