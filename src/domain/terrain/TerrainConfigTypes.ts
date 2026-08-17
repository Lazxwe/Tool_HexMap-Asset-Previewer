export interface TerrainConfigItem {
  readonly id: string;
  readonly displayName: string;
  readonly fallbackColor: string;
  readonly generationWeight: number;
  readonly isEnabled: boolean;
}

export interface TerrainConfigFile {
  readonly version: string;
  readonly name?: string;
  readonly terrains: TerrainConfigItem[];
}

export const DEFAULT_TERRAIN_CONFIGS: readonly TerrainConfigItem[] = Object.freeze([
  {
    id: "water",
    displayName: "水域",
    fallbackColor: "#1d4ed8",
    generationWeight: 1.0,
    isEnabled: true,
  },
  {
    id: "sand",
    displayName: "沙地 / 平原",
    fallbackColor: "#d97706",
    generationWeight: 1.0,
    isEnabled: true,
  },
  {
    id: "forest",
    displayName: "森林",
    fallbackColor: "#15803d",
    generationWeight: 1.5,
    isEnabled: true,
  },
  {
    id: "mountain",
    displayName: "山脈 / 高山",
    fallbackColor: "#475569",
    generationWeight: 1.0,
    isEnabled: true,
  },
]);
