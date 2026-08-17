import { describe, it, expect } from "vitest";
import { TerrainDefinition } from "../../src/domain/terrain/TerrainDefinition";
import { TerrainRegistry } from "../../src/domain/terrain/TerrainRegistry";
import { validateProjectDocument } from "../../src/persistence/ProjectValidation";

describe("ProjectValidation", () => {
  const createValidDoc = () => ({
    formatVersion: 1,
    metadata: { name: "Test Project" },
    bounds: { minCol: 0, maxCol: 5, minRow: 0, maxRow: 5 },
    terrainMap: [
      { col: 0, row: 0, terrainId: "water" },
      { col: 1, row: 0, terrainId: "forest" },
    ],
    generation: {
      seed: 12345,
      scale: 180,
    },
  });

  describe("A. Format Version Validation", () => {
    it("should accept formatVersion 1", () => {
      const doc = createValidDoc();
      const validated = validateProjectDocument(doc);
      expect(validated.formatVersion).toBe(1);
    });

    it("should reject missing formatVersion", () => {
      const doc = createValidDoc() as any;
      delete doc.formatVersion;
      expect(() => validateProjectDocument(doc)).toThrow(/Missing 'formatVersion'/);
    });

    it("should reject formatVersion 0, negative, or non-integer", () => {
      expect(() => validateProjectDocument({ ...createValidDoc(), formatVersion: 0 })).toThrow(
        /Must be >= 1/
      );
      expect(() => validateProjectDocument({ ...createValidDoc(), formatVersion: -1 })).toThrow(
        /Must be >= 1/
      );
      expect(() => validateProjectDocument({ ...createValidDoc(), formatVersion: 1.5 })).toThrow(
        /Expected integer/
      );
      expect(() => validateProjectDocument({ ...createValidDoc(), formatVersion: "1" as any })).toThrow(
        /Expected integer/
      );
    });

    it("should reject unsupported future formatVersion > 1", () => {
      expect(() => validateProjectDocument({ ...createValidDoc(), formatVersion: 2 })).toThrow(
        /Unsupported project format version: 2/
      );
      expect(() => validateProjectDocument({ ...createValidDoc(), formatVersion: 99 })).toThrow(
        /Unsupported project format version: 99/
      );
    });
  });

  describe("B. Root & Metadata Validation", () => {
    it("should reject non-object root documents", () => {
      expect(() => validateProjectDocument(null)).toThrow(/Expected a JSON object/);
      expect(() => validateProjectDocument([])).toThrow(/Expected a JSON object/);
      expect(() => validateProjectDocument("string")).toThrow(/Expected a JSON object/);
      expect(() => validateProjectDocument(123)).toThrow(/Expected a JSON object/);
      expect(() => validateProjectDocument(undefined)).toThrow(/Expected a JSON object/);
    });

    it("should validate optional metadata", () => {
      const docWithoutMetadata = createValidDoc() as any;
      delete docWithoutMetadata.metadata;
      expect(validateProjectDocument(docWithoutMetadata).metadata).toBeUndefined();

      expect(() =>
        validateProjectDocument({ ...createValidDoc(), metadata: "invalid" as any })
      ).toThrow(/Invalid metadata: Expected an object/);

      expect(() =>
        validateProjectDocument({ ...createValidDoc(), metadata: { name: 123 as any } })
      ).toThrow(/Invalid metadata name: Expected a string/);
    });
  });

  describe("C. Bounds and Inferred Bounds Validation", () => {
    it("should accept valid bounds", () => {
      const doc = createValidDoc();
      const validated = validateProjectDocument(doc);
      expect(validated.bounds).toEqual({ minCol: 0, maxCol: 5, minRow: 0, maxRow: 5 });
    });

    it("should infer bounds from terrainMap when bounds is omitted", () => {
      const doc = {
        formatVersion: 1,
        terrainMap: [
          { col: -2, row: -3, terrainId: "mountain" },
          { col: 4, row: 8, terrainId: "forest" },
        ],
      };
      const validated = validateProjectDocument(doc);
      expect(validated.bounds).toEqual({ minCol: -2, maxCol: 4, minRow: -3, maxRow: 8 });
    });

    it("should default bounds to 0,0,0,0 when terrainMap is empty and bounds omitted", () => {
      const doc = {
        formatVersion: 1,
        terrainMap: [],
      };
      const validated = validateProjectDocument(doc);
      expect(validated.bounds).toEqual({ minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 });
    });

    it("should reject invalid bounds where min > max or coords are not integers", () => {
      expect(() =>
        validateProjectDocument({
          ...createValidDoc(),
          bounds: { minCol: 5, maxCol: 2, minRow: 0, maxRow: 5 },
        })
      ).toThrow(/minCol \(5\) cannot be greater than maxCol \(2\)/);

      expect(() =>
        validateProjectDocument({
          ...createValidDoc(),
          bounds: { minCol: 0, maxCol: 5, minRow: 10, maxRow: 2 },
        })
      ).toThrow(/minRow \(10\) cannot be greater than maxRow \(2\)/);

      expect(() =>
        validateProjectDocument({
          ...createValidDoc(),
          bounds: { minCol: 0.5 as any, maxCol: 5, minRow: 0, maxRow: 5 },
        })
      ).toThrow(/must all be integers/);
    });
  });

  describe("D. Spatial Map Entries & Duplicate Validation", () => {
    it("should reject non-array terrainMap", () => {
      expect(() =>
        validateProjectDocument({ ...createValidDoc(), terrainMap: {} as any })
      ).toThrow(/Missing or invalid 'terrainMap' array/);
    });

    it("should reject fractional, NaN, or non-integer coordinates", () => {
      expect(() =>
        validateProjectDocument({
          ...createValidDoc(),
          terrainMap: [{ col: 0.5, row: 0, terrainId: "grass" }],
        })
      ).toThrow(/Coordinates must be integers/);

      expect(() =>
        validateProjectDocument({
          ...createValidDoc(),
          terrainMap: [{ col: 0, row: NaN, terrainId: "grass" }],
        })
      ).toThrow(/Coordinates must be integers/);
    });

    it("should reject empty or invalid terrainId", () => {
      expect(() =>
        validateProjectDocument({
          ...createValidDoc(),
          terrainMap: [{ col: 0, row: 0, terrainId: "" }],
        })
      ).toThrow(/Invalid terrainId/);

      expect(() =>
        validateProjectDocument({
          ...createValidDoc(),
          terrainMap: [{ col: 0, row: 0, terrainId: "   " }],
        })
      ).toThrow(/Invalid terrainId/);
    });

    it("should reject duplicate coordinates in terrainMap", () => {
      expect(() =>
        validateProjectDocument({
          ...createValidDoc(),
          terrainMap: [
            { col: 2, row: 3, terrainId: "water" },
            { col: 2, row: 3, terrainId: "forest" },
          ],
        })
      ).toThrow("Duplicate terrain coordinate: (2, 3)");
    });

    it("should validate terrainId against TerrainRegistry when provided", () => {
      const registry = new TerrainRegistry();
      registry.register(new TerrainDefinition({ id: "water", displayName: "Water" }));
      registry.register(new TerrainDefinition({ id: "forest", displayName: "Forest" }));

      // Known terrains pass
      const validDoc = createValidDoc();
      expect(() => validateProjectDocument(validDoc, registry)).not.toThrow();

      // Unknown terrain throws descriptive error
      const invalidDoc = {
        ...createValidDoc(),
        terrainMap: [
          { col: 0, row: 0, terrainId: "water" },
          { col: 0, row: 1, terrainId: "lava" },
        ],
      };
      expect(() => validateProjectDocument(invalidDoc, registry)).toThrow('Unknown terrainId: "lava"');
    });
  });

  describe("E. Generation Metadata Validation (Optional)", () => {
    it("should accept valid generation metadata or omit if absent", () => {
      const docWithoutGen = createValidDoc() as any;
      delete docWithoutGen.generation;
      expect(validateProjectDocument(docWithoutGen).generation).toBeUndefined();
    });

    it("should reject invalid seed or scale in generation metadata", () => {
      expect(() =>
        validateProjectDocument({
          ...createValidDoc(),
          generation: { seed: NaN, scale: 180 },
        })
      ).toThrow(/Invalid generation seed/);

      expect(() =>
        validateProjectDocument({
          ...createValidDoc(),
          generation: { seed: 12345, scale: -10 },
        })
      ).toThrow(/Invalid generation scale/);
    });
  });
});
