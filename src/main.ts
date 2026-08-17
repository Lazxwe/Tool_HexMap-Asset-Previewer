/**
 * Hex Terrain Preview - Main Application Entry (Composition Root)
 * Task 010: Editor Core & UI Application Assembly
 */
import { HexGeometry } from "./domain/hex/HexGeometry";
import { TerrainDefinition } from "./domain/terrain/TerrainDefinition";
import { TerrainId } from "./domain/terrain/TerrainId";
import { TerrainRegistry } from "./domain/terrain/TerrainRegistry";
import { TerrainAssetRegistry } from "./domain/asset/TerrainAssetRegistry";
import { EditorCore } from "./editor/EditorCore";
import { SeededNoiseField } from "./generation/SeededNoiseField";
import { TerrainClassifier } from "./generation/TerrainClassification";
import { TerrainGenerator } from "./generation/TerrainGenerator";
import { AssetLoader } from "./infrastructure/asset/AssetLoader";
import { BrowserImageDecoder } from "./infrastructure/asset/BrowserImageDecoder";
import { CanvasRenderer } from "./rendering/CanvasRenderer";
import { Viewport } from "./rendering/Viewport";
import { EditorUI } from "./ui/EditorUI";

function initApp(): void {
  const canvas = document.getElementById("viewport-canvas") as HTMLCanvasElement | null;
  if (!canvas) {
    console.error("Canvas element #viewport-canvas not found");
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("Canvas 2D context not supported");
    return;
  }

  // 1. Initialize Domain Terrain Definitions
  const waterId = new TerrainId("water");
  const sandId = new TerrainId("sand");
  const forestId = new TerrainId("forest");
  const mountainId = new TerrainId("mountain");

  const terrainRegistry = new TerrainRegistry();
  terrainRegistry.register(new TerrainDefinition({ id: waterId, displayName: "水域", fallbackColor: "#1d4ed8" }));
  terrainRegistry.register(new TerrainDefinition({ id: sandId, displayName: "沙地 / 平原", fallbackColor: "#d97706" }));
  terrainRegistry.register(new TerrainDefinition({ id: forestId, displayName: "森林", fallbackColor: "#15803d" }));
  terrainRegistry.register(new TerrainDefinition({ id: mountainId, displayName: "山脈 / 高山", fallbackColor: "#475569" }));

  // 2. Initialize Visual Stamp Assets (Clean default - ready for artist PNG import)
  const terrainAssetRegistry = new TerrainAssetRegistry();

  // 3. Initialize Geometry & Generation Services
  const hexGeometry = new HexGeometry(120, 70);
  const classifier = new TerrainClassifier([
    { terrainId: waterId, max: 0.35 },
    { terrainId: sandId, max: 0.52 },
    { terrainId: forestId, max: 0.78 },
    { terrainId: mountainId, max: 1.0 },
  ]);

  const initialNoise = new SeededNoiseField(12345);
  const terrainGenerator = new TerrainGenerator(initialNoise, hexGeometry, classifier);

  // 4. Initialize Infrastructure Asset Loader & Renderer
  const assetLoader = new AssetLoader(new BrowserImageDecoder());
  const viewport = new Viewport({ zoom: 1.0 });
  const renderer = new CanvasRenderer(ctx);

  // 5. Initialize EditorCore Orchestrator
  const editor = new EditorCore(
    {
      generator: terrainGenerator,
      assetRegistry: terrainAssetRegistry,
      terrainRegistry,
      assetLoader,
      geometry: hexGeometry,
      viewport,
    },
    {
      initialSeed: 12345,
      initialScale: 180,
      initialBounds: { minCol: 0, maxCol: 9, minRow: 0, maxRow: 9 },
    }
  );

  // 6. Initialize EditorUI
  const ui = new EditorUI(editor, renderer, {
    canvas,
    sourceBuiltinBtn: document.getElementById("btn-source-builtin") as HTMLButtonElement | null,
    sourceJsonBtn: document.getElementById("btn-source-json") as HTMLButtonElement | null,
    panelBuiltinControls: document.getElementById("panel-builtin-controls"),
    panelJsonControls: document.getElementById("panel-json-controls"),
    openJsonBtn: document.getElementById("btn-open-json") as HTMLButtonElement | null,
    jsonFileInput: document.getElementById("input-json-file") as HTMLInputElement | null,
    seedInput: document.getElementById("input-seed") as HTMLInputElement | null,
    scaleInput: document.getElementById("input-scale") as HTMLInputElement | null,
    generateBtn: document.getElementById("btn-generate") as HTMLButtonElement | null,
    randomSeedBtn: document.getElementById("btn-random-seed") as HTMLButtonElement | null,
    addAssetsBtn: document.getElementById("btn-add-assets") as HTMLButtonElement | null,
    assetFilesInput: document.getElementById("input-asset-files") as HTMLInputElement | null,
    assetSeedInput: document.getElementById("input-asset-seed") as HTMLInputElement | null,
    rerollAssetsBtn: document.getElementById("btn-reroll-assets") as HTMLButtonElement | null,
    resetViewBtn: document.getElementById("btn-reset-view") as HTMLButtonElement | null,
    canvasContainer: document.getElementById("canvas-container"),
    dragDropOverlay: document.getElementById("drag-drop-overlay"),
    modalAssetRegister: document.getElementById("modal-asset-register"),
    btnModalClose: document.getElementById("btn-modal-close") as HTMLButtonElement | null,
    assetModalFilename: document.getElementById("asset-modal-filename"),
    selectAssetTerrain: document.getElementById("select-asset-terrain") as HTMLSelectElement | null,
    inputAssetWeight: document.getElementById("input-asset-weight") as HTMLInputElement | null,
    btnCancelAsset: document.getElementById("btn-cancel-asset") as HTMLButtonElement | null,
    btnSubmitAsset: document.getElementById("btn-submit-asset") as HTMLButtonElement | null,
    statusSource: document.getElementById("status-source"),
    statusText: document.getElementById("status-text"),
    hoverInfo: document.getElementById("hover-info"),
    panelAssetLibrary: document.getElementById("panel-asset-library"),
    assetLibraryContent: document.getElementById("asset-library-content"),
    btnAddTerrain: document.getElementById("btn-add-terrain") as HTMLButtonElement | null,
    btnImportTerrainConfig: document.getElementById("btn-import-terrain-config") as HTMLButtonElement | null,
    btnExportTerrainConfig: document.getElementById("btn-export-terrain-config") as HTMLButtonElement | null,
    btnResetTerrainConfig: document.getElementById("btn-reset-terrain-config") as HTMLButtonElement | null,
    inputTerrainConfigFile: document.getElementById("input-terrain-config-file") as HTMLInputElement | null,
    modalAddTerrain: document.getElementById("modal-add-terrain"),
    btnCloseAddTerrainModal: document.getElementById("btn-close-add-terrain-modal") as HTMLButtonElement | null,
    btnCancelAddTerrain: document.getElementById("btn-cancel-add-terrain") as HTMLButtonElement | null,
    btnSubmitAddTerrain: document.getElementById("btn-submit-add-terrain") as HTMLButtonElement | null,
    inputNewTerrainId: document.getElementById("input-new-terrain-id") as HTMLInputElement | null,
    inputNewTerrainName: document.getElementById("input-new-terrain-name") as HTMLInputElement | null,
    inputNewTerrainColor: document.getElementById("input-new-terrain-color") as HTMLInputElement | null,
    labelNewTerrainColorVal: document.getElementById("label-new-terrain-color-val"),
  });

  ui.mount();

  // 7. Center initial view on the 10x10 map and trigger initial generation
  const rect = canvas.getBoundingClientRect();
  editor.centerOnGrid({ x: rect.width || 800, y: rect.height || 600 }, 1.0);
  editor.generate();

  console.info("Hex Terrain Preview - Core & UI application assembled successfully.");
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", initApp);
}
