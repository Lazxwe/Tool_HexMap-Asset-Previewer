import { describe, it, expect } from "vitest";
import { SeededRandomSource } from "../../src/selection/SeededRandomSource";

describe("SeededRandomSource", () => {
  it("should generate the exact same sequence for identical seeds", () => {
    const rngA = new SeededRandomSource(4242);
    const rngB = new SeededRandomSource(4242);

    for (let i = 0; i < 1000; i++) {
      expect(rngA.next()).toBe(rngB.next());
    }
  });

  it("should generate different sequences for different seeds", () => {
    const rng1 = new SeededRandomSource(100);
    const rng2 = new SeededRandomSource(200);

    let differences = 0;
    for (let i = 0; i < 100; i++) {
      if (rng1.next() !== rng2.next()) {
        differences++;
      }
    }

    expect(differences).toBeGreaterThan(90);
  });

  it("should always generate floats strictly within [0, 1)", () => {
    const rng = new SeededRandomSource(123456);

    for (let i = 0; i < 50000; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0.0);
      expect(val).toBeLessThan(1.0);
    }
  });

  it("should reject invalid seeds (NaN, Infinity, non-number)", () => {
    expect(() => new SeededRandomSource(NaN)).toThrow();
    expect(() => new SeededRandomSource(Infinity)).toThrow();
    expect(() => new SeededRandomSource(-Infinity)).toThrow();
    // @ts-expect-error - testing runtime type defense
    expect(() => new SeededRandomSource("42")).toThrow();
  });

  it("should maintain isolated state across multiple instances", () => {
    const rng1 = new SeededRandomSource(777);
    const rng2 = new SeededRandomSource(777);

    // Advance rng1 by 5 steps
    for (let i = 0; i < 5; i++) {
      rng1.next();
    }

    // rng2 should still produce the first 5 steps that rng1 produced earlier
    const rng3 = new SeededRandomSource(777);
    for (let i = 0; i < 5; i++) {
      expect(rng2.next()).toBe(rng3.next());
    }
  });
});
