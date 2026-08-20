import { HexCoordinate } from "../domain/hex/HexCoordinate";
import { HexGeometry, Point2D } from "../domain/hex/HexGeometry";
import { TerrainRegistry } from "../domain/terrain/TerrainRegistry";
import { AssetId } from "../domain/asset/AssetId";
import { TerrainAsset } from "../domain/asset/TerrainAsset";
import { TerrainAssetRegistry } from "../domain/asset/TerrainAssetRegistry";
import { TerrainGenerator } from "../generation/TerrainGenerator";
import { HexBounds } from "../generation/NoiseTypes";
import { SeededRandomSource } from "../selection/SeededRandomSource";
import { WeightedAssetSelector } from "../selection/WeightedAssetSelector";
import { IAssetLoader, LoadedAsset } from "../infrastructure/asset/AssetTypes";
import { HexStampEntry } from "../rendering/terrain/TerrainStampTypes";
import { HexFallbackEntry } from "../rendering/RenderTypes";
import { Viewport } from "../rendering/Viewport";
import { PersistableMapState } from "../persistence/ProjectTypes";
import { ProjectDeserializer } from "../persistence/ProjectDeserializer";
import {
  DEFAULT_TERRAIN_CONFIGS,
  TerrainConfigItem,
} from "../domain/terrain/TerrainConfigTypes";
import { TerrainDefinition } from "../domain/terrain/TerrainDefinition";
import { TerrainId } from "../domain/terrain/TerrainId";
import { createClassifierFromWeights } from "../generation/TerrainClassification";
import { TerrainStorage } from "../persistence/TerrainStorage";
import {
  createInitialEditorState,
  deriveAssetSeed,
  EditorConfig,
  EditorState,
  MapSource,
} from "./EditorState";

export { deriveAssetSeed };

export interface EditorCoreDependencies {
  readonly generator: TerrainGenerator;
  readonly assetRegistry: TerrainAssetRegistry;
  readonly terrainRegistry: TerrainRegistry;
  readonly assetLoader: IAssetLoader;
  readonly geometry: HexGeometry;
  readonly viewport?: Viewport;
  readonly terrainStorage?: TerrainStorage;
  readonly initialTerrainConfigs?: readonly TerrainConfigItem[];
}

export type StateListener = (state: EditorState) => void;

/**
 * EditorCore / PreviewCore
 * Application orchestration service that coordinates Terrain Generation, JSON Map Input,
 * Weighted Asset Selection, Fallback Assembly, Asset Loading, and Viewport State.
 */
export class EditorCore {
  private _state: EditorState;
  private readonly listeners: Set<StateListener> = new Set();
  private readonly deserializer: ProjectDeserializer;

  private _generator: TerrainGenerator;
  public get generator(): TerrainGenerator {
    return this._generator;
  }

  public readonly assetRegistry: TerrainAssetRegistry;
  public readonly terrainRegistry: TerrainRegistry;
  public readonly assetLoader: IAssetLoader;
  private _geometry: HexGeometry;
  public get geometry(): HexGeometry {
    return this._geometry;
  }
  public readonly viewport: Viewport;
  public readonly terrainStorage: TerrainStorage;

  private terrainConfigs: TerrainConfigItem[] = [];
  private cachedStamps: HexStampEntry[] = [];
  private cachedFallbacks: HexFallbackEntry[] = [];
  private currentGenerationId: number = 0;

  constructor(deps: EditorCoreDependencies, config: EditorConfig = {}) {
    if (!deps.generator) throw new Error("EditorCore requires a TerrainGenerator.");
    if (!deps.assetRegistry) throw new Error("EditorCore requires a TerrainAssetRegistry.");
    if (!deps.terrainRegistry) throw new Error("EditorCore requires a TerrainRegistry.");
    if (!deps.assetLoader) throw new Error("EditorCore requires an IAssetLoader.");
    if (!deps.geometry) throw new Error("EditorCore requires a HexGeometry.");

    this._generator = deps.generator;
    this.assetRegistry = deps.assetRegistry;
    this.terrainRegistry = deps.terrainRegistry;
    this.assetLoader = deps.assetLoader;
    this._geometry = deps.geometry;
    this.deserializer = new ProjectDeserializer(this.terrainRegistry);

    this.terrainStorage = deps.terrainStorage ?? new TerrainStorage();
    const storedConfigs = this.terrainStorage.load();
    let initialConfigs: TerrainConfigItem[];
    if (deps.initialTerrainConfigs) {
      initialConfigs = [...deps.initialTerrainConfigs];
    } else if (storedConfigs && storedConfigs.length > 0) {
      initialConfigs = storedConfigs;
    } else if (this.terrainRegistry.size > 0) {
      initialConfigs = this.terrainRegistry.list().map((t) => ({
        id: t.id.value,
        displayName: t.displayName,
        fallbackColor: t.fallbackColor,
        generationWeight: 1.0,
        isEnabled: true,
      }));
    } else {
      initialConfigs = [...DEFAULT_TERRAIN_CONFIGS];
    }

    this.terrainConfigs = [...initialConfigs];
    this.syncTerrainRegistry(false);
    if (deps.initialTerrainConfigs || (storedConfigs && storedConfigs.length > 0)) {
      this.rebuildClassifierFromConfigs(false);
    }

    this.viewport =
      deps.viewport ??
      new Viewport({
        zoom: config.initialZoom ?? 1.0,
        panX: config.initialPanX ?? 0,
        panY: config.initialPanY ?? 0,
      });

    this._state = createInitialEditorState({
      ...config,
      initialHexWidth: this._geometry.hexWidth,
      initialHexHeight: this._geometry.hexHeight,
      initialZoom: this.viewport.zoom,
      initialPanX: this.viewport.panX,
      initialPanY: this.viewport.panY,
    });
  }

  /**
   * Synchronizes terrain registry definitions from current configs.
   */
  public syncTerrainRegistry(persist: boolean = true): void {
    if (persist) {
      this.terrainStorage.save(this.terrainConfigs);
    }

    for (const item of this.terrainConfigs) {
      const existing = this.terrainRegistry.get(item.id);
      if (existing) {
        if (
          existing.displayName !== item.displayName ||
          existing.fallbackColor !== item.fallbackColor
        ) {
          this.terrainRegistry.remove(item.id);
          this.terrainRegistry.register(
            new TerrainDefinition({
              id: item.id,
              displayName: item.displayName,
              fallbackColor: item.fallbackColor,
            })
          );
        }
      } else {
        this.terrainRegistry.register(
          new TerrainDefinition({
            id: item.id,
            displayName: item.displayName,
            fallbackColor: item.fallbackColor,
          })
        );
      }
    }
  }

  /**
   * Rebuilds the generator classifier dynamically from active configs.
   */
  public rebuildClassifierFromConfigs(persist: boolean = true): void {
    if (persist) {
      this.terrainStorage.save(this.terrainConfigs);
    }

    const activeEntries = this.terrainConfigs
      .filter((c) => c.isEnabled && c.generationWeight > 0)
      .map((c) => ({ terrainId: c.id, weight: c.generationWeight }));

    if (activeEntries.length > 0) {
      try {
        const dynamicClassifier = createClassifierFromWeights(activeEntries);
        this._generator = this._generator.withClassifier(dynamicClassifier);
      } catch (err) {
        console.warn("Failed to create dynamic classifier from weights:", err);
      }
    }
  }

  public syncTerrainRegistryAndClassifier(persist: boolean = true): void {
    this.syncTerrainRegistry(persist);
    this.rebuildClassifierFromConfigs(persist);
  }

  public getState(): EditorState {
    return this._state;
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const currentState = this._state;
    for (const listener of this.listeners) {
      try {
        listener(currentState);
      } catch (err) {
        console.error("Error in EditorCore subscriber listener:", err);
      }
    }
  }

  private updateState(partial: Partial<EditorState>): void {
    this._state = {
      ...this._state,
      ...partial,
    };
    this.notify();
  }

  public setSource(mapSource: MapSource): void {
    this.updateState({ mapSource });
  }

  public setSeed(seed: number): void {
    if (!Number.isFinite(seed)) {
      throw new Error(`Invalid seed: ${seed}`);
    }
    if (this._state.seed !== seed) {
      this.updateState({
        seed,
        previewAssetSeed: deriveAssetSeed(seed),
        mapSource: {
          kind: "builtin",
          seed,
          scale: this._state.scale,
        },
      });
    }
  }

  public setScale(scale: number): void {
    if (!Number.isFinite(scale) || scale <= 0) {
      throw new Error(`Invalid scale: ${scale}. Must be > 0.`);
    }
    if (this._state.scale !== scale) {
      this.updateState({
        scale,
        mapSource: {
          kind: "builtin",
          seed: this._state.seed,
          scale,
        },
      });
    }
  }

  public setBounds(bounds: HexBounds): void {
    if (bounds.minCol > bounds.maxCol || bounds.minRow > bounds.maxRow) {
      throw new Error(
        `Invalid bounds: minCol (${bounds.minCol}) <= maxCol (${bounds.maxCol}) and minRow (${bounds.minRow}) <= maxRow (${bounds.maxRow}) required.`
      );
    }
    this.updateState({ bounds: { ...bounds } });
  }

  /**
   * Updates hex dimensions dynamically without re-generating terrain or re-rolling asset assignments.
   * Updates geometry reference and emits state update to trigger immediate canvas rerender.
   */
  public setHexDimensions(hexWidth: number, hexHeight?: number): void {
    const targetHeight = hexHeight ?? this._geometry.hexHeight;
    HexGeometry.validateDimensions(hexWidth, targetHeight);

    if (this._geometry.hexWidth === hexWidth && this._geometry.hexHeight === targetHeight) {
      return;
    }

    this._geometry = new HexGeometry(hexWidth, targetHeight);
    this._generator = new TerrainGenerator(
      this._generator.noise,
      this._geometry,
      this._generator.classifier
    );

    this.updateState({
      hexWidth: this._geometry.hexWidth,
      hexHeight: this._geometry.hexHeight,
    });
  }

  public setHoveredHex(hex: HexCoordinate | null): void {
    const current = this._state.hoveredHex;
    if (current === hex) return;
    if (current && hex && current.equals(hex)) return;
    this.updateState({ hoveredHex: hex ? new HexCoordinate(hex.col, hex.row) : null });
  }

  public zoomAt(screenX: number, screenY: number, factor: number): void {
    this.viewport.zoomAroundAnchor(factor, { x: screenX, y: screenY });
    this.updateState({
      zoom: this.viewport.zoom,
      panX: this.viewport.panX,
      panY: this.viewport.panY,
    });
  }

  public panBy(deltaX: number, deltaY: number): void {
    this.viewport.panBy(deltaX, deltaY);
    this.updateState({
      panX: this.viewport.panX,
      panY: this.viewport.panY,
    });
  }

  public centerOnGrid(screenSize: Point2D, zoom?: number): void {
    const bounds = this._state.bounds;
    const centerCol = (bounds.minCol + bounds.maxCol) / 2;
    const centerRow = (bounds.minRow + bounds.maxRow) / 2;
    const centerCoord = new HexCoordinate(Math.round(centerCol), Math.round(centerRow));
    const worldCenter = this.geometry.hexToPixel(centerCoord);

    this.viewport.centerOnWorldPoint(worldCenter, screenSize, zoom);
    this.updateState({
      zoom: this.viewport.zoom,
      panX: this.viewport.panX,
      panY: this.viewport.panY,
    });
  }

  public getRenderStamps(): HexStampEntry[] {
    return this.cachedStamps;
  }

  public getRenderFallbacks(): HexFallbackEntry[] {
    return this.cachedFallbacks;
  }

  /**
   * Sets an explicit error state on the editor while retaining the active map and visual stamps.
   */
  public setError(errorMessage: string): void {
    this.updateState({
      status: "error",
      errorMessage,
    });
  }

  /**
   * Exports the current persistable map data snapshot.
   */
  public exportPersistenceState(): PersistableMapState {
    const state = this._state;
    return {
      bounds: { ...state.bounds },
      terrainMap: state.terrainMap,
      ...(state.mapSource.kind === "builtin"
        ? {
            generation: {
              seed: state.seed,
              scale: state.scale,
            },
          }
        : {}),
    };
  }

  /**
   * Loads map from either Built-in Generator or JSON Map Document.
   * Transactional commit: on failure, preserves previous valid state and sets status = "error".
   * Latest-Wins: prevents out-of-order async resolution from overwriting newer generation requests.
   */
  public async loadSource(source: MapSource): Promise<void> {
    const generationId = ++this.currentGenerationId;

    // 1. Enter generating state
    this.updateState({ status: "generating", errorMessage: undefined, mapSource: source });

    try {
      let newTerrainMap: import("../domain/terrain/TerrainMap").TerrainMap;
      let newBounds: HexBounds;
      let assetSeed: number;

      if (source.kind === "builtin") {
        newBounds = source.bounds ?? this._state.bounds;
        newTerrainMap = this.generator.generate(newBounds, { seed: source.seed, scale: source.scale });
        assetSeed = deriveAssetSeed(source.seed);
      } else {
        const parsed = this.deserializer.parse(source.document, this.terrainRegistry);
        newTerrainMap = parsed.terrainMap;
        newBounds = parsed.bounds;
        assetSeed =
          source.previewAssetSeed ??
          (parsed.generation?.seed !== undefined ? deriveAssetSeed(parsed.generation.seed) : 12345);
      }

      if (this.currentGenerationId !== generationId) {
        return;
      }

      // 2. Deterministically select assets via WeightedAssetSelector
      const randomSource = new SeededRandomSource(assetSeed);
      const selector = new WeightedAssetSelector(this.assetRegistry, randomSource);
      const newAssetMap = selector.selectForMap(newTerrainMap);

      // 3. Assemble missing-asset fallback entries
      const fallbacks: HexFallbackEntry[] = [];
      for (const entry of newTerrainMap.entries()) {
        if (!newAssetMap.has(entry.coord)) {
          const def = this.terrainRegistry.get(entry.terrainId);
          fallbacks.push({
            coord: entry.coord,
            terrainId: entry.terrainId.value,
            label: def ? def.displayName : entry.terrainId.value,
            fillColor: def ? def.fallbackColor : undefined,
          });
        }
      }

      if (this.currentGenerationId !== generationId) {
        return;
      }

      // 4. Enter loading-assets state
      this.updateState({ status: "loading-assets" });

      // 5. Collect unique asset IDs
      const uniqueAssetIds = new Set<string>();
      for (const entry of newAssetMap.entries()) {
        uniqueAssetIds.add(entry.assetId.value);
      }

      // 6. Load all required unique visual stamp assets concurrently
      const loadPromises: Promise<LoadedAsset>[] = [];
      for (const assetIdStr of uniqueAssetIds) {
        const terrainAsset = this.assetRegistry.get(assetIdStr);
        if (!terrainAsset) {
          throw new Error(`Asset with id '${assetIdStr}' not found in TerrainAssetRegistry.`);
        }
        loadPromises.push(this.assetLoader.load(terrainAsset));
      }
      await Promise.all(loadPromises);

      // Check if a newer request superseded this one
      if (this.currentGenerationId !== generationId) {
        return;
      }

      // 7. Assemble render-ready stamp entries
      const stamps: HexStampEntry[] = [];
      for (const entry of newAssetMap.entries()) {
        const loaded = this.assetLoader.get(entry.assetId);
        if (loaded) {
          stamps.push({ coord: entry.coord, asset: loaded });
        }
      }

      // 8. Atomic transactional commit
      this.cachedStamps = stamps;
      this.cachedFallbacks = fallbacks;

      this.updateState({
        bounds: newBounds,
        terrainMap: newTerrainMap,
        assetMap: newAssetMap,
        previewAssetSeed: assetSeed,
        status: "ready",
        errorMessage: undefined,
        ...(source.kind === "builtin" ? { seed: source.seed, scale: source.scale } : {}),
      });
    } catch (err) {
      if (this.currentGenerationId !== generationId) {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("EditorCore map loading failed:", err);
      // Retain previous terrainMap, assetMap, stamps, and fallbacks
      this.updateState({
        status: "error",
        errorMessage,
      });
    }
  }

  /**
   * Re-rolls visual asset stamp selections for the currently active TerrainMap without re-generating terrain.
   */
  public async rerollAssets(newAssetSeed?: number): Promise<void> {
    const assetSeed = newAssetSeed ?? Math.floor(Math.random() * 1000000);
    const terrainMap = this._state.terrainMap;

    if (terrainMap.size === 0) {
      return;
    }

    const generationId = ++this.currentGenerationId;
    this.updateState({ status: "loading-assets" });

    try {
      const randomSource = new SeededRandomSource(assetSeed);
      const selector = new WeightedAssetSelector(this.assetRegistry, randomSource);
      const newAssetMap = selector.selectForMap(terrainMap);

      const fallbacks: HexFallbackEntry[] = [];
      for (const entry of terrainMap.entries()) {
        if (!newAssetMap.has(entry.coord)) {
          const def = this.terrainRegistry.get(entry.terrainId);
          fallbacks.push({
            coord: entry.coord,
            terrainId: entry.terrainId.value,
            label: def ? def.displayName : entry.terrainId.value,
            fillColor: def ? def.fallbackColor : undefined,
          });
        }
      }

      const uniqueAssetIds = new Set<string>();
      for (const entry of newAssetMap.entries()) {
        uniqueAssetIds.add(entry.assetId.value);
      }

      const loadPromises: Promise<LoadedAsset>[] = [];
      for (const assetIdStr of uniqueAssetIds) {
        const terrainAsset = this.assetRegistry.get(assetIdStr);
        if (!terrainAsset) {
          throw new Error(`Asset with id '${assetIdStr}' not found in TerrainAssetRegistry.`);
        }
        loadPromises.push(this.assetLoader.load(terrainAsset));
      }
      await Promise.all(loadPromises);

      if (this.currentGenerationId !== generationId) {
        return;
      }

      const stamps: HexStampEntry[] = [];
      for (const entry of newAssetMap.entries()) {
        const loaded = this.assetLoader.get(entry.assetId);
        if (loaded) {
          stamps.push({ coord: entry.coord, asset: loaded });
        }
      }

      this.cachedStamps = stamps;
      this.cachedFallbacks = fallbacks;

      this.updateState({
        assetMap: newAssetMap,
        previewAssetSeed: assetSeed,
        status: "ready",
        errorMessage: undefined,
      });
    } catch (err) {
      if (this.currentGenerationId !== generationId) {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.updateState({
        status: "error",
        errorMessage,
      });
    }
  }

  /**
   * Sets preview asset seed and rerolls asset assignments.
   */
  public async setPreviewAssetSeed(seed: number): Promise<void> {
    return this.rerollAssets(seed);
  }

  /**
   * Registers a new visual stamp asset into TerrainAssetRegistry and refreshes the preview.
   * Enforces transactional integrity: rolls back registry on error and preserves current preview.
   */
  public async registerAsset(asset: TerrainAsset): Promise<void> {
    if (!asset || !(asset instanceof TerrainAsset)) {
      throw new Error("Can only register instances of TerrainAsset.");
    }

    if (!this.terrainRegistry.has(asset.terrainId)) {
      throw new Error(
        `Cannot register asset '${asset.name}': Unknown terrainId '${asset.terrainId.value}'.`
      );
    }

    // Register into TerrainAssetRegistry (throws if duplicate AssetId)
    this.assetRegistry.register(asset);

    // If map has cells, refresh asset assignments using the current previewAssetSeed
    if (this._state.terrainMap.size > 0) {
      await this.rerollAssets(this._state.previewAssetSeed);
      if (this._state.status === "error") {
        this.assetRegistry.remove(asset.id);
      }
    }
  }

  /**
   * Updates the selection weight of an existing visual stamp asset and refreshes the preview.
   * Maintains unchanged TerrainMap, seed, scale, and previewAssetSeed.
   * Does NOT call TerrainGenerator.generate().
   */
  public async updateAssetWeight(assetId: AssetId | string, weight: number): Promise<void> {
    const asset = this.assetRegistry.get(assetId);
    if (!asset) {
      const idStr = typeof assetId === "string" ? assetId : assetId.value;
      throw new Error(`Cannot update weight: Asset with id '${idStr}' not found.`);
    }

    const previousWeight = asset.weight;
    // 1. Update in registry (validates weight >= 0 and finite)
    this.assetRegistry.updateWeight(assetId, weight);

    // 2. Refresh asset assignments using current previewAssetSeed without modifying TerrainMap
    if (this._state.terrainMap.size > 0) {
      await this.rerollAssets(this._state.previewAssetSeed);
      if (this._state.status === "error") {
        // Rollback weight on failure
        this.assetRegistry.updateWeight(assetId, previousWeight);
      }
    }
  }

  /**
   * Executes Built-in procedural terrain generation.
   */
  public async generate(): Promise<void> {
    return this.loadSource({
      kind: "builtin",
      seed: this._state.seed,
      scale: this._state.scale,
    });
  }

  /**
   * Loads map from JSON string.
   */
  public async loadJson(
    jsonString: string,
    name?: string,
    previewAssetSeed?: number
  ): Promise<void> {
    return this.loadSource({
      kind: "json",
      document: jsonString,
      name,
      previewAssetSeed,
    });
  }

  /**
   * Regenerates map with optional new seed.
   */
  public async regenerate(newSeed?: number): Promise<void> {
    if (newSeed !== undefined) {
      this.setSeed(newSeed);
    }
    return this.generate();
  }

  public getTerrainConfigs(): readonly TerrainConfigItem[] {
    return this.terrainConfigs;
  }

  public async applyTerrainConfigs(
    configs: readonly TerrainConfigItem[],
    persist: boolean = true
  ): Promise<void> {
    this.terrainConfigs = [...configs];
    this.syncTerrainRegistryAndClassifier(persist);

    if (this._state.mapSource.kind === "builtin") {
      await this.generate();
    } else {
      await this.rerollAssets(this._state.previewAssetSeed);
    }
  }

  public async addTerrain(
    id: string,
    displayName: string,
    fallbackColor: string = "#475569"
  ): Promise<void> {
    const cleanId = id.trim().toLowerCase();
    if (!cleanId) {
      throw new Error("地形 ID 不能為空。");
    }
    if (this.terrainConfigs.some((c) => c.id === cleanId)) {
      throw new Error(`地形 ID '${cleanId}' 已經存在。`);
    }

    const newItem: TerrainConfigItem = {
      id: cleanId,
      displayName: displayName.trim() || cleanId,
      fallbackColor: fallbackColor.trim() || "#475569",
      generationWeight: 1.0,
      isEnabled: true,
    };

    const nextConfigs = [...this.terrainConfigs, newItem];
    await this.applyTerrainConfigs(nextConfigs, true);
  }

  public async removeTerrain(terrainId: string): Promise<void> {
    const cleanId = terrainId.trim().toLowerCase();
    const existingIndex = this.terrainConfigs.findIndex((c) => c.id === cleanId);
    if (existingIndex === -1) {
      throw new Error(`找不到 ID 為 '${cleanId}' 的地形。`);
    }

    const nextConfigs = this.terrainConfigs.filter((c) => c.id !== cleanId);
    if (nextConfigs.length === 0) {
      throw new Error("不能刪除最後一個地形。請至少保留一種地形。");
    }

    this.terrainRegistry.remove(cleanId);
    const assets = this.assetRegistry.getByTerrain(new TerrainId(cleanId));
    for (const a of assets) {
      this.assetRegistry.remove(a.id);
    }

    await this.applyTerrainConfigs(nextConfigs, true);
  }

  public async updateTerrainColor(terrainId: string, fallbackColor: string): Promise<void> {
    const cleanId = terrainId.trim().toLowerCase();
    const nextConfigs = this.terrainConfigs.map((c) =>
      c.id === cleanId ? { ...c, fallbackColor } : c
    );
    await this.applyTerrainConfigs(nextConfigs, true);
  }

  public async updateTerrainGenerationWeight(terrainId: string, weight: number): Promise<void> {
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error("生成佔比必須為大於或等於 0 的有效數字。");
    }
    const cleanId = terrainId.trim().toLowerCase();
    const nextConfigs = this.terrainConfigs.map((c) =>
      c.id === cleanId ? { ...c, generationWeight: weight } : c
    );
    await this.applyTerrainConfigs(nextConfigs, true);
  }

  public async toggleTerrainGeneration(terrainId: string, isEnabled: boolean): Promise<void> {
    const cleanId = terrainId.trim().toLowerCase();
    const nextConfigs = this.terrainConfigs.map((c) =>
      c.id === cleanId ? { ...c, isEnabled } : c
    );
    await this.applyTerrainConfigs(nextConfigs, true);
  }

  public async resetTerrainConfigToDefaults(): Promise<void> {
    this.terrainStorage.clear();
    await this.applyTerrainConfigs(DEFAULT_TERRAIN_CONFIGS, false);
  }

  public exportTerrainConfigJson(): string {
    return this.terrainStorage.exportToJson(this.terrainConfigs);
  }

  public async importTerrainConfigJson(jsonStr: string): Promise<void> {
    const imported = this.terrainStorage.importFromJson(jsonStr);
    await this.applyTerrainConfigs(imported, true);
  }
}
