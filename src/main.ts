/**
 * Hex Terrain Preview - Main Application Entry (Composition Root)
 * Task 010: Editor Core & UI Application Assembly
 */
import { AssetId } from "./domain/asset/AssetId";
import { TerrainAsset } from "./domain/asset/TerrainAsset";
import { TerrainAssetRegistry } from "./domain/asset/TerrainAssetRegistry";
import { HexGeometry } from "./domain/hex/HexGeometry";
import { TerrainDefinition } from "./domain/terrain/TerrainDefinition";
import { TerrainId } from "./domain/terrain/TerrainId";
import { TerrainRegistry } from "./domain/terrain/TerrainRegistry";
import { EditorCore } from "./editor/EditorCore";
import { SeededNoiseField } from "./generation/SeededNoiseField";
import { TerrainClassifier } from "./generation/TerrainClassification";
import { TerrainGenerator } from "./generation/TerrainGenerator";
import { AssetLoader } from "./infrastructure/asset/AssetLoader";
import { BrowserImageDecoder } from "./infrastructure/asset/BrowserImageDecoder";
import { CanvasRenderer } from "./rendering/CanvasRenderer";
import { Viewport } from "./rendering/Viewport";
import { EditorUI } from "./ui/EditorUI";

/**
 * Creates procedural Data-URL PNG stamps for the demo environment.
 */
function createDemoStampDataUrl(
  label: string,
  primaryColor: string,
  accentColor: string,
  width: number,
  height: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const grad = ctx.createRadialGradient(
    width / 2,
    height / 2,
    10,
    width / 2,
    height / 2,
    width / 2
  );
  grad.addColorStop(0, primaryColor);
  grad.addColorStop(1, accentColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtle inner vignette / pattern
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, width - 8, height - 8);

  // Center icon and text
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.font = `bold ${Math.round(height * 0.22)}px -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, width / 2, height / 2);

  return canvas.toDataURL("image/png");
}

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
  terrainRegistry.register(new TerrainDefinition({ id: waterId, displayName: "水域" }));
  terrainRegistry.register(new TerrainDefinition({ id: sandId, displayName: "沙地 / 平原" }));
  terrainRegistry.register(new TerrainDefinition({ id: forestId, displayName: "森林" }));
  terrainRegistry.register(new TerrainDefinition({ id: mountainId, displayName: "山脈 / 高山" }));

  // 2. Initialize Visual Stamp Assets (Multiple weighted variants per terrain)
  const terrainAssetRegistry = new TerrainAssetRegistry();

  const water01Url = createDemoStampDataUrl("🌊 水域 1", "#1a365d", "#0f2038", 180, 180);
  const water02Url = createDemoStampDataUrl("💧 水域 2", "#2b6cb0", "#1a365d", 180, 180);
  terrainAssetRegistry.register(new TerrainAsset({ id: new AssetId("water_01"), terrainId: waterId, name: "水域 1", source: water01Url, weight: 10 }));
  terrainAssetRegistry.register(new TerrainAsset({ id: new AssetId("water_02"), terrainId: waterId, name: "水域 2", source: water02Url, weight: 5 }));

  const sand01Url = createDemoStampDataUrl("🏜️ 沙地 1", "#d69e2e", "#744210", 180, 180);
  const sand02Url = createDemoStampDataUrl("🌾 沙地 2", "#b7791f", "#5b3708", 180, 180);
  terrainAssetRegistry.register(new TerrainAsset({ id: new AssetId("sand_01"), terrainId: sandId, name: "沙地 1", source: sand01Url, weight: 10 }));
  terrainAssetRegistry.register(new TerrainAsset({ id: new AssetId("sand_02"), terrainId: sandId, name: "沙地 2", source: sand02Url, weight: 5 }));

  const forest01Url = createDemoStampDataUrl("🌲 森林 1", "#1c4532", "#0c2317", 180, 180);
  const forest02Url = createDemoStampDataUrl("🌳 森林 2", "#276749", "#133524", 180, 180);
  terrainAssetRegistry.register(new TerrainAsset({ id: new AssetId("forest_01"), terrainId: forestId, name: "森林 1", source: forest01Url, weight: 10 }));
  terrainAssetRegistry.register(new TerrainAsset({ id: new AssetId("forest_02"), terrainId: forestId, name: "森林 2", source: forest02Url, weight: 6 }));

  const mountain01Url = createDemoStampDataUrl("⛰️ 山脈 1", "#4a5568", "#1a202c", 200, 160);
  const mountain02Url = createDemoStampDataUrl("🏔️ 山脈 2", "#718096", "#2d3748", 200, 160);
  terrainAssetRegistry.register(new TerrainAsset({ id: new AssetId("mountain_01"), terrainId: mountainId, name: "山脈 1", source: mountain01Url, weight: 10 }));
  terrainAssetRegistry.register(new TerrainAsset({ id: new AssetId("mountain_02"), terrainId: mountainId, name: "山脈 2", source: mountain02Url, weight: 4 }));

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
