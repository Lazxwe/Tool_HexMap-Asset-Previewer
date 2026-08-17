import { TerrainAssetRegistry } from "./TerrainAssetRegistry";
import { AssetId } from "./AssetId";
import { TerrainId } from "../terrain/TerrainId";

/**
 * Generates a clean, unique, and deterministic AssetId from a file name and terrain context.
 * Automatically resolves ID collisions against the provided TerrainAssetRegistry.
 */
export function generateUniqueAssetId(
  fileName: string,
  terrainId: TerrainId | string,
  registry?: TerrainAssetRegistry
): AssetId {
  const tidStr = typeof terrainId === "string" ? terrainId.trim() : terrainId.value;

  // 1. Strip file extensions (.png, etc.)
  let baseName = fileName.replace(/\.[^/.]+$/, "").trim();

  // 2. Sanitize: replace non-alphanumeric/underscore characters with underscores
  baseName = baseName
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  // 3. Fallback if empty
  if (baseName.length === 0) {
    baseName = `${tidStr}_stamp`.toLowerCase();
  }

  // 4. Collision check against registry
  if (!registry || !registry.has(baseName)) {
    return new AssetId(baseName);
  }

  let counter = 1;
  while (registry.has(`${baseName}_${counter}`)) {
    counter++;
  }

  return new AssetId(`${baseName}_${counter}`);
}
