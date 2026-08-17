import { TerrainDefinition } from "./TerrainDefinition";
import { TerrainId } from "./TerrainId";

/**
 * TerrainRegistry
 * Manages the set of available terrain definitions within the domain layer.
 *
 * Guarantees unique IDs, deterministic listing, and defensive encapsulation.
 */
export class TerrainRegistry {
  private readonly definitions: Map<string, TerrainDefinition> = new Map();

  /**
   * Registers a new terrain definition.
   * Throws if a terrain with the same ID is already registered.
   */
  public register(definition: TerrainDefinition): void {
    if (!(definition instanceof TerrainDefinition)) {
      throw new Error("Can only register instances of TerrainDefinition.");
    }
    const key = definition.id.value;
    if (this.definitions.has(key)) {
      throw new Error(`Terrain with id '${key}' is already registered.`);
    }
    this.definitions.set(key, definition);
  }

  /**
   * Retrieves a terrain definition by ID.
   * Returns undefined if not found.
   */
  public get(id: TerrainId | string): TerrainDefinition | undefined {
    const key = typeof id === "string" ? id.trim() : id.value;
    return this.definitions.get(key);
  }

  /**
   * Checks whether a terrain with the given ID exists in the registry.
   */
  public has(id: TerrainId | string): boolean {
    const key = typeof id === "string" ? id.trim() : id.value;
    return this.definitions.has(key);
  }

  /**
   * Removes a terrain definition by ID.
   * Returns true if removed, false if not found.
   */
  public remove(id: TerrainId | string): boolean {
    const key = typeof id === "string" ? id.trim() : id.value;
    return this.definitions.delete(key);
  }

  /**
   * Returns a deterministic list of registered definitions (in registration order).
   */
  public list(): TerrainDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Total count of registered terrain definitions.
   */
  public get size(): number {
    return this.definitions.size;
  }

  /**
   * Clears all registered terrain definitions.
   */
  public clear(): void {
    this.definitions.clear();
  }
}
