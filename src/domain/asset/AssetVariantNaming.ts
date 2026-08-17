import { TerrainId } from "../terrain/TerrainId";
import { TerrainAssetRegistry } from "./TerrainAssetRegistry";

/**
 * Escapes regex special characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Generates an artist-facing variant display name for a terrain category (e.g. "Forest 1", "Forest 2").
 * Identifies the maximum existing variant number for the given TerrainId in the registry and assigns max + 1.
 * Gaps in existing numbering are preserved without reusing older numbers.
 */
export function generateVariantDisplayName(
  terrainDisplayName: string,
  terrainId: TerrainId | string,
  registry?: TerrainAssetRegistry
): string {
  const tid = terrainId instanceof TerrainId ? terrainId : new TerrainId(terrainId);
  const basePrefix = terrainDisplayName.trim() || tid.value;

  if (!registry) {
    return `${basePrefix} 1`;
  }

  const existingAssets = registry.getByTerrain(tid);
  if (existingAssets.length === 0) {
    return `${basePrefix} 1`;
  }

  let maxNumber = 0;
  // Match prefix followed by optional whitespace/underscore and digits (e.g., "Forest 3", "Forest_3")
  const regex = new RegExp(`^${escapeRegex(basePrefix)}[\\s_]+(\\d+)$`, "i");

  for (const asset of existingAssets) {
    const match = asset.name.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (Number.isFinite(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  // If existing assets match the pattern, use max + 1; otherwise fallback to existing count + 1
  const nextNumber = maxNumber > 0 ? maxNumber + 1 : existingAssets.length + 1;
  return `${basePrefix} ${nextNumber}`;
}
