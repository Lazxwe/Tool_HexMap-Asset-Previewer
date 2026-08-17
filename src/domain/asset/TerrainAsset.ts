import { TerrainId } from "../terrain/TerrainId";
import { AssetId } from "./AssetId";

export interface TerrainAssetProps {
  id: AssetId | string;
  terrainId: TerrainId | string;
  name: string;
  source: string;
  weight?: number;
}

/**
 * TerrainAsset
 * Pure domain model representing an individual visual stamp asset belonging to a terrain category.
 *
 * Owns its individual selection weight (>= 0) for weighted random sampling.
 * Pure primitive string source reference with zero browser/DOM dependencies.
 */
export class TerrainAsset {
  public readonly id: AssetId;
  public readonly terrainId: TerrainId;
  public readonly name: string;
  public readonly source: string;
  public readonly weight: number;

  constructor(props: TerrainAssetProps) {
    if (!props) {
      throw new Error("TerrainAssetProps are required.");
    }

    this.id = props.id instanceof AssetId ? props.id : new AssetId(props.id);
    this.terrainId =
      props.terrainId instanceof TerrainId ? props.terrainId : new TerrainId(props.terrainId);

    if (typeof props.name !== "string" || props.name.trim().length === 0) {
      throw new Error("TerrainAsset name must be a non-empty string.");
    }
    this.name = props.name.trim();

    if (typeof props.source !== "string" || props.source.trim().length === 0) {
      throw new Error("TerrainAsset source must be a non-empty string.");
    }
    this.source = props.source.trim();

    const weight = props.weight !== undefined ? props.weight : 1.0;
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error(
        `Invalid weight: ${weight}. Weight must be a non-negative finite number (>= 0).`
      );
    }
    this.weight = weight;

    Object.freeze(this);
  }

  /**
   * Creates a new copy with an updated weight.
   */
  public withWeight(newWeight: number): TerrainAsset {
    return new TerrainAsset({
      id: this.id,
      terrainId: this.terrainId,
      name: this.name,
      source: this.source,
      weight: newWeight,
    });
  }

  /**
   * Creates a new copy with an updated name.
   */
  public withName(newName: string): TerrainAsset {
    return new TerrainAsset({
      id: this.id,
      terrainId: this.terrainId,
      name: newName,
      source: this.source,
      weight: this.weight,
    });
  }

  /**
   * Creates a new copy with an updated source.
   */
  public withSource(newSource: string): TerrainAsset {
    return new TerrainAsset({
      id: this.id,
      terrainId: this.terrainId,
      name: this.name,
      source: newSource,
      weight: this.weight,
    });
  }
}
