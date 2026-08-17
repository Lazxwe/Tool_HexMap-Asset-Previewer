import { HexCoordinate } from "../domain/hex/HexCoordinate";
import { TerrainId } from "../domain/terrain/TerrainId";
import { TerrainMap } from "../domain/terrain/TerrainMap";
import { TerrainRegistry } from "../domain/terrain/TerrainRegistry";
import { PersistableMapState } from "./ProjectTypes";
import { validateProjectDocument } from "./ProjectValidation";

/**
 * ProjectDeserializer
 * Pure service responsible for parsing raw JSON and deserializing validated Map documents into PersistableMapState.
 */
export class ProjectDeserializer {
  constructor(private readonly terrainRegistry?: TerrainRegistry) {}

  /**
   * Deserializes an untyped document object into a validated PersistableMapState.
   */
  public deserialize(
    document: unknown,
    terrainRegistry?: TerrainRegistry
  ): PersistableMapState {
    const activeRegistry = terrainRegistry ?? this.terrainRegistry;
    const validatedDoc = validateProjectDocument(document, activeRegistry);

    // 1. Reconstruct TerrainMap using domain value objects
    const terrainMap = new TerrainMap();
    for (const entry of validatedDoc.terrainMap) {
      const coord = new HexCoordinate(entry.col, entry.row);
      const terrainId = new TerrainId(entry.terrainId);
      terrainMap.set(coord, terrainId);
    }

    // 2. Assemble runtime persistable map state
    const bounds = validatedDoc.bounds ?? { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 };
    const state: PersistableMapState = {
      bounds: {
        minCol: bounds.minCol,
        maxCol: bounds.maxCol,
        minRow: bounds.minRow,
        maxRow: bounds.maxRow,
      },
      terrainMap,
      ...(validatedDoc.metadata?.name ? { name: validatedDoc.metadata.name } : {}),
      ...(validatedDoc.generation
        ? {
            generation: {
              seed: validatedDoc.generation.seed,
              scale: validatedDoc.generation.scale,
            },
          }
        : {}),
    };

    return state;
  }

  /**
   * Safely parses a JSON string and deserializes it into PersistableMapState.
   */
  public parse(json: string, terrainRegistry?: TerrainRegistry): PersistableMapState {
    if (typeof json !== "string" || json.trim().length === 0) {
      throw new Error("Invalid project JSON: Input string is empty.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (err) {
      throw new Error(`Failed to parse project JSON: ${err instanceof Error ? err.message : String(err)}`);
    }

    return this.deserialize(parsed, terrainRegistry);
  }
}
