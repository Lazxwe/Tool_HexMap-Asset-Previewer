import {
  CURRENT_PROJECT_FORMAT_VERSION,
  PersistableMapState,
  ProjectDocument,
  TerrainEntryDocument,
} from "./ProjectTypes";

/**
 * Deterministic entry comparator ordering by column ascending, then row ascending.
 */
function compareCoordinates(
  a: { col: number; row: number },
  b: { col: number; row: number }
): number {
  if (a.col !== b.col) {
    return a.col - b.col;
  }
  return a.row - b.row;
}

/**
 * ProjectSerializer
 * Pure service responsible for converting runtime map state into a JSON-safe ProjectDocument.
 */
export class ProjectSerializer {
  /**
   * Serializes runtime persistable map state into a structured, deterministic ProjectDocument.
   * Excludes transient runtime properties and derived visual assets (assetMap).
   */
  public serialize(state: PersistableMapState): ProjectDocument {
    if (!state) {
      throw new Error("Cannot serialize undefined or null map state.");
    }

    // 1. Serialize and sort TerrainMap entries deterministically
    const terrainMapEntries: TerrainEntryDocument[] = [];
    if (state.terrainMap) {
      for (const entry of state.terrainMap.entries()) {
        terrainMapEntries.push({
          col: entry.coord.col,
          row: entry.coord.row,
          terrainId: entry.terrainId.value,
        });
      }
    }
    terrainMapEntries.sort(compareCoordinates);

    // 2. Construct clean ProjectDocument
    const document: ProjectDocument = {
      formatVersion: CURRENT_PROJECT_FORMAT_VERSION,
      ...(state.name ? { metadata: { name: state.name } } : {}),
      bounds: {
        minCol: state.bounds.minCol,
        maxCol: state.bounds.maxCol,
        minRow: state.bounds.minRow,
        maxRow: state.bounds.maxRow,
      },
      terrainMap: terrainMapEntries,
      ...(state.generation
        ? {
            generation: {
              algorithm: "builtin",
              seed: state.generation.seed,
              scale: state.generation.scale,
            },
          }
        : {}),
    };

    return document;
  }

  /**
   * Serializes runtime persistable map state into a formatted JSON string.
   */
  public stringify(state: PersistableMapState, space: number | string = 2): string {
    const document = this.serialize(state);
    return JSON.stringify(document, null, space);
  }
}
