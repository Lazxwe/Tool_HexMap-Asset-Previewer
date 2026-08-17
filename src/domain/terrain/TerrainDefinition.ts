import { TerrainId } from "./TerrainId";

export interface TerrainDefinitionProps {
  id: TerrainId | string;
  displayName: string;
}

/**
 * TerrainDefinition
 * Pure domain model describing a semantic terrain category/type (e.g. Forest, Mountain, Grass).
 *
 * Notice: Weight does NOT belong to TerrainDefinition; selection weight is owned by individual
 * visual stamp assets (TerrainAsset) associated with this terrain category.
 */
export class TerrainDefinition {
  public readonly id: TerrainId;
  public readonly displayName: string;

  constructor(props: TerrainDefinitionProps) {
    if (!props) {
      throw new Error("TerrainDefinitionProps are required.");
    }

    this.id = props.id instanceof TerrainId ? props.id : new TerrainId(props.id);

    if (typeof props.displayName !== "string" || props.displayName.trim().length === 0) {
      throw new Error("TerrainDefinition displayName must be a non-empty string.");
    }
    this.displayName = props.displayName.trim();

    Object.freeze(this);
  }

  /**
   * Creates a new copy of TerrainDefinition with updated displayName
   */
  public withDisplayName(newDisplayName: string): TerrainDefinition {
    return new TerrainDefinition({
      id: this.id,
      displayName: newDisplayName,
    });
  }
}
