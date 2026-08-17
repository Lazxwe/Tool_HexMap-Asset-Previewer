import { describe, it, expect } from "vitest";
import { HexCoordinate } from "../../../src/domain/hex/HexCoordinate";

describe("HexCoordinate", () => {
  it("should construct with column and row", () => {
    const coord = new HexCoordinate(3, 5);
    expect(coord.col).toBe(3);
    expect(coord.column).toBe(3);
    expect(coord.row).toBe(5);
  });

  it("should reject non-integer coordinates", () => {
    expect(() => new HexCoordinate(1.5, 2)).toThrow();
    expect(() => new HexCoordinate(1, 2.7)).toThrow();
    expect(() => new HexCoordinate(NaN, 0)).toThrow();
  });

  it("should be immutable", () => {
    const coord = new HexCoordinate(2, 4);
    expect(Object.isFrozen(coord)).toBe(true);
    // @ts-expect-error - testing runtime immutability
    expect(() => { coord.col = 10; }).toThrow();
  });

  it("should verify value equality across different instances", () => {
    const a = new HexCoordinate(4, 8);
    const b = new HexCoordinate(4, 8);
    const c = new HexCoordinate(4, 9);
    const d = new HexCoordinate(5, 8);

    expect(a.equals(b)).toBe(true);
    expect(b.equals(a)).toBe(true);
    expect(a.equals(c)).toBe(false);
    expect(a.equals(d)).toBe(false);
    expect(a.equals(null)).toBe(false);
    expect(a.equals(undefined)).toBe(false);

    expect(HexCoordinate.equals(a, b)).toBe(true);
    expect(HexCoordinate.equals(a, c)).toBe(false);
    expect(HexCoordinate.equals(null, null)).toBe(true);
    expect(HexCoordinate.equals(a, null)).toBe(false);
  });

  it("should generate stable unique string keys", () => {
    const coord1 = new HexCoordinate(10, -5);
    const coord2 = new HexCoordinate(10, -5);
    expect(coord1.toKey()).toBe("10,-5");
    expect(coord1.toKey()).toBe(coord2.toKey());
    expect(coord1.toString()).toBe("HexCoordinate(10, -5)");
  });
});
