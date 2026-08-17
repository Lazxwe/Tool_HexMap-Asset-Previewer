import {
  CURRENT_PROJECT_FORMAT_VERSION,
  MapBoundsDocument,
  ProjectDocument,
  TerrainEntryDocument,
} from "./ProjectTypes";

/**
 * Validates whether a value is a non-null, non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates whether a number is a valid finite integer.
 */
function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/**
 * Validates whether a number is a valid finite number.
 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * ProjectValidation
 * Validates raw, untyped JSON data against the Map Document schema.
 * Throws clear, descriptive errors on schema violations.
 */
export function validateProjectDocument(
  input: unknown,
  terrainRegistry?: import("../domain/terrain/TerrainRegistry").TerrainRegistry
): ProjectDocument {
  // 1. Root Object Validation
  if (!isRecord(input)) {
    throw new Error(
      `Invalid project document: Expected a JSON object, received ${
        input === null ? "null" : Array.isArray(input) ? "array" : typeof input
      }.`
    );
  }

  // 2. Format Version Validation
  if (!("formatVersion" in input)) {
    throw new Error("Invalid project document: Missing 'formatVersion' field.");
  }

  const { formatVersion } = input;
  if (!isInteger(formatVersion)) {
    throw new Error(`Invalid project format version: Expected integer, received ${formatVersion}.`);
  }

  if (formatVersion < 1) {
    throw new Error(`Invalid project format version: ${formatVersion}. Must be >= 1.`);
  }

  if (formatVersion > CURRENT_PROJECT_FORMAT_VERSION) {
    throw new Error(
      `Unsupported project format version: ${formatVersion}. Current supported version: ${CURRENT_PROJECT_FORMAT_VERSION}.`
    );
  }

  // 3. Metadata Validation (Optional)
  let validatedMetadata: { name?: string } | undefined;
  if ("metadata" in input && input.metadata !== undefined) {
    if (!isRecord(input.metadata)) {
      throw new Error("Invalid metadata: Expected an object.");
    }
    if ("name" in input.metadata && input.metadata.name !== undefined) {
      if (typeof input.metadata.name !== "string") {
        throw new Error("Invalid metadata name: Expected a string.");
      }
      validatedMetadata = { name: input.metadata.name };
    }
  }

  // 4. TerrainMap Entries Validation & Duplicate Detection
  if (!("terrainMap" in input) || !Array.isArray(input.terrainMap)) {
    throw new Error("Invalid project document: Missing or invalid 'terrainMap' array.");
  }

  const terrainCoords = new Set<string>();
  let computedMinCol = Infinity;
  let computedMaxCol = -Infinity;
  let computedMinRow = Infinity;
  let computedMaxRow = -Infinity;

  const validatedTerrainEntries: TerrainEntryDocument[] = input.terrainMap.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Invalid terrain entry at index ${index}: Expected an object.`);
    }

    const { col, row, terrainId } = entry;

    if (!isInteger(col) || !isInteger(row)) {
      throw new Error(
        `Invalid coordinates in terrain entry at index ${index}: (${col}, ${row}). Coordinates must be integers.`
      );
    }

    if (typeof terrainId !== "string" || terrainId.trim().length === 0) {
      throw new Error(`Invalid terrainId in terrain entry at index ${index}: Expected non-empty string.`);
    }

    const trimmedTerrainId = terrainId.trim();

    if (terrainRegistry && !terrainRegistry.has(trimmedTerrainId)) {
      throw new Error(`Unknown terrainId: "${trimmedTerrainId}"`);
    }

    const key = `${col},${row}`;
    if (terrainCoords.has(key)) {
      throw new Error(`Duplicate terrain coordinate: (${col}, ${row})`);
    }
    terrainCoords.add(key);

    if (col < computedMinCol) computedMinCol = col;
    if (col > computedMaxCol) computedMaxCol = col;
    if (row < computedMinRow) computedMinRow = row;
    if (row > computedMaxRow) computedMaxRow = row;

    return {
      col,
      row,
      terrainId: trimmedTerrainId,
    };
  });

  // 5. Bounds Validation (Root-level, nested in generation, or inferred)
  let validatedBounds: MapBoundsDocument;

  const rawBounds =
    "bounds" in input && isRecord(input.bounds)
      ? input.bounds
      : "generation" in input && isRecord(input.generation) && isRecord(input.generation.bounds)
      ? input.generation.bounds
      : undefined;

  if (rawBounds) {
    const { minCol, maxCol, minRow, maxRow } = rawBounds;

    if (!isInteger(minCol) || !isInteger(maxCol) || !isInteger(minRow) || !isInteger(maxRow)) {
      throw new Error("Invalid bounds: minCol, maxCol, minRow, and maxRow must all be integers.");
    }

    if (minCol > maxCol) {
      throw new Error(`Invalid bounds: minCol (${minCol}) cannot be greater than maxCol (${maxCol}).`);
    }

    if (minRow > maxRow) {
      throw new Error(`Invalid bounds: minRow (${minRow}) cannot be greater than maxRow (${maxRow}).`);
    }

    validatedBounds = { minCol, maxCol, minRow, maxRow };
  } else {
    // Inferred bounds from terrainMap
    if (validatedTerrainEntries.length > 0) {
      validatedBounds = {
        minCol: computedMinCol,
        maxCol: computedMaxCol,
        minRow: computedMinRow,
        maxRow: computedMaxRow,
      };
    } else {
      validatedBounds = { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 };
    }
  }

  // 6. Generation Metadata Validation (Optional)
  let validatedGeneration:
    | { algorithm?: string; seed?: number; scale?: number; bounds?: MapBoundsDocument }
    | undefined;

  if ("generation" in input && input.generation !== undefined) {
    if (!isRecord(input.generation)) {
      throw new Error("Invalid generation metadata: Expected an object.");
    }

    const { seed, scale, algorithm } = input.generation;

    if (seed !== undefined && !isFiniteNumber(seed)) {
      throw new Error(`Invalid generation seed: ${seed}. Expected a finite number.`);
    }

    if (scale !== undefined && (!isFiniteNumber(scale) || scale <= 0)) {
      throw new Error(`Invalid generation scale: ${scale}. Expected a positive finite number (> 0).`);
    }

    validatedGeneration = {
      ...(typeof algorithm === "string" ? { algorithm } : {}),
      ...(seed !== undefined ? { seed } : {}),
      ...(scale !== undefined ? { scale } : {}),
      bounds: validatedBounds,
    };
  }

  return {
    formatVersion,
    ...(validatedMetadata ? { metadata: validatedMetadata } : {}),
    bounds: validatedBounds,
    terrainMap: validatedTerrainEntries,
    ...(validatedGeneration ? { generation: validatedGeneration } : {}),
  };
}
