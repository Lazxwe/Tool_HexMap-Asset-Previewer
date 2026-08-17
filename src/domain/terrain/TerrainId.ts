/**
 * TerrainId
 * Immutable value object representing a unique identifier for a terrain type.
 */
export class TerrainId {
  public readonly value: string;

  constructor(value: string) {
    if (typeof value !== "string") {
      throw new Error(`TerrainId must be a string. Received: ${typeof value}`);
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new Error("TerrainId cannot be empty or whitespace only.");
    }
    this.value = trimmed;
    Object.freeze(this);
  }

  /**
   * Value equality check against another TerrainId or string identifier.
   */
  public equals(other: TerrainId | string | null | undefined): boolean {
    if (!other) return false;
    const otherVal = typeof other === "string" ? other.trim() : other.value;
    return this.value === otherVal;
  }

  public static equals(
    a: TerrainId | string | null | undefined,
    b: TerrainId | string | null | undefined
  ): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    const valA = typeof a === "string" ? a.trim() : a.value;
    const valB = typeof b === "string" ? b.trim() : b.value;
    return valA === valB;
  }

  public toString(): string {
    return this.value;
  }

  public toJSON(): string {
    return this.value;
  }
}
