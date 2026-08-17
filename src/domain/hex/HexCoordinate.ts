/**
 * HexCoordinate
 * Pure domain value object representing a hexagon coordinate in the flat-top grid.
 *
 * Public coordinate system: (col, row) offset coordinates.
 */
export class HexCoordinate {
  public readonly col: number;
  public readonly row: number;

  constructor(col: number, row: number) {
    if (!Number.isInteger(col) || !Number.isInteger(row)) {
      throw new Error(`HexCoordinate requires integer coordinates. Received col: ${col}, row: ${row}`);
    }
    this.col = col;
    this.row = row;
    Object.freeze(this);
  }

  /**
   * Alias for col to support both naming styles
   */
  public get column(): number {
    return this.col;
  }

  /**
   * Value equality check
   */
  public equals(other: HexCoordinate | null | undefined): boolean {
    if (!other) return false;
    return this.col === other.col && this.row === other.row;
  }

  /**
   * Static equality helper
   */
  public static equals(a: HexCoordinate | null | undefined, b: HexCoordinate | null | undefined): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.equals(b);
  }

  /**
   * Unique string key representation suitable for Maps/Sets
   */
  public toKey(): string {
    return `${this.col},${this.row}`;
  }

  public toString(): string {
    return `HexCoordinate(${this.col}, ${this.row})`;
  }
}
