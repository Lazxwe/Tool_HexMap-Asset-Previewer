import { generateUniqueAssetId } from "../domain/asset/AssetIdGenerator";
import { generateVariantDisplayName } from "../domain/asset/AssetVariantNaming";
import { TerrainAsset } from "../domain/asset/TerrainAsset";
import { EditorCore } from "../editor/EditorCore";
import { EditorState } from "../editor/EditorState";
import { validateAssetFiles } from "../infrastructure/asset/AssetFileValidator";
import { CanvasRenderer } from "../rendering/CanvasRenderer";
import { GridRenderOptions } from "../rendering/RenderTypes";

export interface EditorUIElements {
  readonly canvas: HTMLCanvasElement;
  readonly sourceBuiltinBtn?: HTMLButtonElement | null;
  readonly sourceJsonBtn?: HTMLButtonElement | null;
  readonly panelBuiltinControls?: HTMLElement | null;
  readonly panelJsonControls?: HTMLElement | null;
  readonly openJsonBtn?: HTMLButtonElement | null;
  readonly jsonFileInput?: HTMLInputElement | null;
  readonly seedInput?: HTMLInputElement | null;
  readonly scaleInput?: HTMLInputElement | null;
  readonly generateBtn?: HTMLButtonElement | null;
  readonly randomSeedBtn?: HTMLButtonElement | null;
  readonly addAssetsBtn?: HTMLButtonElement | null;
  readonly assetFilesInput?: HTMLInputElement | null;
  readonly assetSeedInput?: HTMLInputElement | null;
  readonly rerollAssetsBtn?: HTMLButtonElement | null;
  readonly resetViewBtn?: HTMLButtonElement | null;
  readonly canvasContainer?: HTMLElement | null;
  readonly dragDropOverlay?: HTMLElement | null;
  readonly modalAssetRegister?: HTMLElement | null;
  readonly btnModalClose?: HTMLButtonElement | null;
  readonly assetModalFilename?: HTMLElement | null;
  readonly selectAssetTerrain?: HTMLSelectElement | null;
  readonly inputAssetWeight?: HTMLInputElement | null;
  readonly btnCancelAsset?: HTMLButtonElement | null;
  readonly btnSubmitAsset?: HTMLButtonElement | null;
  readonly statusSource?: HTMLElement | null;
  readonly statusText?: HTMLElement | null;
  readonly hoverInfo?: HTMLElement | null;
  readonly panelAssetLibrary?: HTMLElement | null;
  readonly assetLibraryContent?: HTMLElement | null;
}

/**
 * EditorUI / PreviewUI
 * Binds DOM and Canvas 2D event interactions to EditorCore commands, manages dual-source UI workflows,
 * and coordinates unified artist asset import (File Picker & Drag & Drop).
 */
export class EditorUI {
  public readonly editor: EditorCore;
  public readonly renderer: CanvasRenderer;
  public readonly canvas: HTMLCanvasElement;

  public get assetLibraryPanel(): HTMLElement | null {
    return this.panelAssetLibrary;
  }

  private readonly sourceBuiltinBtn: HTMLButtonElement | null;
  private readonly sourceJsonBtn: HTMLButtonElement | null;
  private readonly panelBuiltinControls: HTMLElement | null;
  private readonly panelJsonControls: HTMLElement | null;
  private readonly openJsonBtn: HTMLButtonElement | null;
  private readonly jsonFileInput: HTMLInputElement | null;
  private readonly seedInput: HTMLInputElement | null;
  private readonly scaleInput: HTMLInputElement | null;
  private readonly generateBtn: HTMLButtonElement | null;
  private readonly randomSeedBtn: HTMLButtonElement | null;
  private readonly addAssetsBtn: HTMLButtonElement | null;
  private readonly assetFilesInput: HTMLInputElement | null;
  private readonly assetSeedInput: HTMLInputElement | null;
  private readonly rerollAssetsBtn: HTMLButtonElement | null;
  private readonly resetViewBtn: HTMLButtonElement | null;
  private readonly canvasContainer: HTMLElement | null;
  private readonly dragDropOverlay: HTMLElement | null;
  private readonly modalAssetRegister: HTMLElement | null;
  private readonly btnModalClose: HTMLButtonElement | null;
  private readonly assetModalFilename: HTMLElement | null;
  private readonly selectAssetTerrain: HTMLSelectElement | null;
  private readonly inputAssetWeight: HTMLInputElement | null;
  private readonly btnCancelAsset: HTMLButtonElement | null;
  private readonly btnSubmitAsset: HTMLButtonElement | null;
  private readonly statusSource: HTMLElement | null;
  private readonly statusText: HTMLElement | null;
  private readonly hoverInfo: HTMLElement | null;
  private readonly panelAssetLibrary: HTMLElement | null;
  private readonly assetLibraryContent: HTMLElement | null;

  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private renderPending = false;
  private unsubscribeEditor: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private pendingAssetFiles: File[] = [];
  private currentRegisteringFile: File | null = null;

  constructor(
    editor: EditorCore,
    renderer: CanvasRenderer,
    elements: EditorUIElements
  ) {
    if (!editor) throw new Error("EditorUI requires an EditorCore instance.");
    if (!renderer) throw new Error("EditorUI requires a CanvasRenderer instance.");
    if (!elements.canvas) throw new Error("EditorUI requires a canvas element.");

    this.editor = editor;
    this.renderer = renderer;
    this.canvas = elements.canvas;

    this.sourceBuiltinBtn = elements.sourceBuiltinBtn ?? null;
    this.sourceJsonBtn = elements.sourceJsonBtn ?? null;
    this.panelBuiltinControls = elements.panelBuiltinControls ?? null;
    this.panelJsonControls = elements.panelJsonControls ?? null;
    this.openJsonBtn = elements.openJsonBtn ?? null;
    this.jsonFileInput = elements.jsonFileInput ?? null;
    this.seedInput = elements.seedInput ?? null;
    this.scaleInput = elements.scaleInput ?? null;
    this.generateBtn = elements.generateBtn ?? null;
    this.randomSeedBtn = elements.randomSeedBtn ?? null;
    this.addAssetsBtn = elements.addAssetsBtn ?? null;
    this.assetFilesInput = elements.assetFilesInput ?? null;
    this.assetSeedInput = elements.assetSeedInput ?? null;
    this.rerollAssetsBtn = elements.rerollAssetsBtn ?? null;
    this.resetViewBtn = elements.resetViewBtn ?? null;
    this.canvasContainer = elements.canvasContainer ?? null;
    this.dragDropOverlay = elements.dragDropOverlay ?? null;
    this.modalAssetRegister = elements.modalAssetRegister ?? null;
    this.btnModalClose = elements.btnModalClose ?? null;
    this.assetModalFilename = elements.assetModalFilename ?? null;
    this.selectAssetTerrain = elements.selectAssetTerrain ?? null;
    this.inputAssetWeight = elements.inputAssetWeight ?? null;
    this.btnCancelAsset = elements.btnCancelAsset ?? null;
    this.btnSubmitAsset = elements.btnSubmitAsset ?? null;
    this.statusSource = elements.statusSource ?? null;
    this.statusText = elements.statusText ?? null;
    this.hoverInfo = elements.hoverInfo ?? null;
    this.panelAssetLibrary = elements.panelAssetLibrary ?? null;
    this.assetLibraryContent = elements.assetLibraryContent ?? null;
  }

  /**
   * Initializes event listeners and attaches UI state bindings.
   */
  public mount(): void {
    // 1. Subscribe to EditorCore state changes
    this.unsubscribeEditor = this.editor.subscribe((state) => {
      this.syncControls(state);
      this.updateStatusDisplay(state);
      this.requestRender();
    });

    // 2. Initial sync
    const initialState = this.editor.getState();
    this.syncControls(initialState);
    this.updateStatusDisplay(initialState);

    // 3. Attach DOM control listeners
    this.attachControlListeners();

    // 4. Attach Canvas Pointer & Wheel listeners
    this.attachCanvasListeners();

    // 5. Attach Drag & Drop listeners
    this.attachDragDropListeners();

    // 6. Setup Canvas Resize Observation
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        this.resizeCanvas();
      });
      this.resizeObserver.observe(this.canvas);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("resize", this.onWindowResize);
    }

    // Initial sizing and render
    this.resizeCanvas();
    this.renderAssetLibrary();
  }

  /**
   * Cleans up all event listeners and subscriptions.
   */
  public unmount(): void {
    if (this.unsubscribeEditor) {
      this.unsubscribeEditor();
      this.unsubscribeEditor = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.onWindowResize);
    }
  }

  private onWindowResize = (): void => {
    this.resizeCanvas();
  };

  private attachControlListeners(): void {
    // Source Switcher Buttons
    if (this.sourceBuiltinBtn) {
      this.sourceBuiltinBtn.addEventListener("click", () => {
        const state = this.editor.getState();
        this.editor.setSource({
          kind: "builtin",
          seed: state.seed,
          scale: state.scale,
        });
      });
    }

    if (this.sourceJsonBtn) {
      this.sourceJsonBtn.addEventListener("click", () => {
        const state = this.editor.getState();
        if (state.mapSource.kind !== "json") {
          // Switch UI view to JSON source panel
          this.editor.setSource({
            kind: "json",
            document: "{}",
            name: "Empty Document",
          });
        }
      });
    }

    // JSON File Picker
    if (this.openJsonBtn && this.jsonFileInput) {
      this.openJsonBtn.addEventListener("click", () => {
        this.jsonFileInput!.click();
      });
    }

    if (this.jsonFileInput) {
      this.jsonFileInput.addEventListener("change", (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files && target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            const content = reader.result;
            if (typeof content === "string") {
              this.editor.loadJson(content, file.name);
            }
          };
          reader.readAsText(file);
          target.value = "";
        }
      });
    }

    // Built-in Controls
    if (this.seedInput) {
      this.seedInput.addEventListener("change", () => {
        const val = parseInt(this.seedInput!.value, 10);
        if (Number.isFinite(val)) {
          this.editor.setSeed(val);
        }
      });
    }

    if (this.scaleInput) {
      this.scaleInput.addEventListener("change", () => {
        const val = parseFloat(this.scaleInput!.value);
        if (Number.isFinite(val) && val > 0) {
          this.editor.setScale(val);
        }
      });
    }

    if (this.generateBtn) {
      this.generateBtn.addEventListener("click", () => {
        this.editor.generate();
      });
    }

    if (this.randomSeedBtn) {
      this.randomSeedBtn.addEventListener("click", () => {
        const newSeed = Math.floor(Math.random() * 1000000);
        this.editor.regenerate(newSeed);
      });
    }

    // Asset Import (File Picker)
    if (this.addAssetsBtn && this.assetFilesInput) {
      this.addAssetsBtn.addEventListener("click", () => {
        this.assetFilesInput!.click();
      });
    }

    if (this.assetFilesInput) {
      this.assetFilesInput.addEventListener("change", (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          this.handleAssetFiles(target.files);
        }
      });
    }

    // Asset Registration Modal Listeners
    if (this.btnModalClose) {
      this.btnModalClose.addEventListener("click", () => {
        this.closeAssetRegisterModal();
      });
    }

    if (this.btnCancelAsset) {
      this.btnCancelAsset.addEventListener("click", () => {
        this.closeAssetRegisterModal();
      });
    }

    if (this.btnSubmitAsset) {
      this.btnSubmitAsset.addEventListener("click", () => {
        this.submitAssetRegistration();
      });
    }

    // Preview Asset Controls
    if (this.assetSeedInput) {
      this.assetSeedInput.addEventListener("change", () => {
        const val = parseInt(this.assetSeedInput!.value, 10);
        if (Number.isFinite(val)) {
          this.editor.setPreviewAssetSeed(val);
        }
      });
    }

    if (this.rerollAssetsBtn) {
      this.rerollAssetsBtn.addEventListener("click", () => {
        this.editor.rerollAssets();
      });
    }

    if (this.resetViewBtn) {
      this.resetViewBtn.addEventListener("click", () => {
        const size = this.getCanvasSize();
        this.editor.centerOnGrid({ x: size.cssWidth, y: size.cssHeight }, 1.0);
      });
    }
  }

  private attachDragDropListeners(): void {
    const dropTarget = this.canvasContainer ?? this.canvas;
    if (!dropTarget) return;

    dropTarget.addEventListener("dragover", (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
      if (this.dragDropOverlay) {
        this.dragDropOverlay.classList.remove("hidden");
      }
    });

    dropTarget.addEventListener("dragleave", () => {
      if (this.dragDropOverlay) {
        this.dragDropOverlay.classList.add("hidden");
      }
    });

    dropTarget.addEventListener("drop", (e: DragEvent) => {
      e.preventDefault();
      if (this.dragDropOverlay) {
        this.dragDropOverlay.classList.add("hidden");
      }
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.handleAssetFiles(e.dataTransfer.files);
      }
    });
  }

  /**
   * Unified entry point for importing asset files (from File Picker or Drag & Drop).
   */
  public handleAssetFiles(files: FileList | File[] | null): void {
    if (!files || files.length === 0) return;

    try {
      const validated = validateAssetFiles(files);
      this.pendingAssetFiles = [...validated];
      this.processNextPendingAsset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.editor.setError(msg);
    }
  }

  private processNextPendingAsset(): void {
    if (this.pendingAssetFiles.length === 0) {
      this.currentRegisteringFile = null;
      this.closeAssetRegisterModal();
      return;
    }

    const file = this.pendingAssetFiles.shift()!;
    this.currentRegisteringFile = file;
    this.openAssetRegisterModal(file);
  }

  private openAssetRegisterModal(file: File): void {
    if (this.assetModalFilename) {
      const kb = (file.size / 1024).toFixed(1);
      this.assetModalFilename.textContent = `${file.name} (${kb} KB)`;
    }

    if (this.selectAssetTerrain) {
      this.selectAssetTerrain.innerHTML = "";
      const terrains = this.editor.terrainRegistry.list();
      for (const t of terrains) {
        const option = document.createElement("option");
        option.value = t.id.value;
        option.textContent = t.displayName;
        this.selectAssetTerrain.appendChild(option);
      }
    }

    if (this.inputAssetWeight) {
      this.inputAssetWeight.value = "1.0";
    }

    if (this.modalAssetRegister) {
      this.modalAssetRegister.classList.remove("hidden");
    }
  }

  private closeAssetRegisterModal(): void {
    if (this.modalAssetRegister) {
      this.modalAssetRegister.classList.add("hidden");
    }
    this.currentRegisteringFile = null;
    if (this.assetFilesInput) {
      this.assetFilesInput.value = "";
    }
  }

  private async submitAssetRegistration(): Promise<void> {
    if (!this.currentRegisteringFile) return;

    const file = this.currentRegisteringFile;
    const terrainIdStr =
      this.selectAssetTerrain?.value ?? this.editor.terrainRegistry.list()[0]?.id.value;

    if (!terrainIdStr) {
      this.editor.setError("無法註冊素材：目前無可用的地形類別。");
      this.closeAssetRegisterModal();
      return;
    }

    const weightVal = this.inputAssetWeight ? parseFloat(this.inputAssetWeight.value) : 1.0;
    const weight = Number.isFinite(weightVal) && weightVal >= 0 ? weightVal : 1.0;

    const terrainDef = this.editor.terrainRegistry.get(terrainIdStr);
    const terrainDisplayName = terrainDef ? terrainDef.displayName : terrainIdStr;
    const variantName = generateVariantDisplayName(
      terrainDisplayName,
      terrainIdStr,
      this.editor.assetRegistry
    );

    const assetId = generateUniqueAssetId(file.name, terrainIdStr, this.editor.assetRegistry);
    const source =
      typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(file)
        : file.name;

    const asset = new TerrainAsset({
      id: assetId,
      terrainId: terrainIdStr,
      name: variantName,
      source,
      weight,
    });

    try {
      await this.editor.registerAsset(asset);
      this.renderAssetLibrary();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.editor.setError(msg);
    }

    this.processNextPendingAsset();
  }

  private attachCanvasListeners(): void {
    const { canvas } = this;

    canvas.addEventListener("mousedown", (e: MouseEvent) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      canvas.style.cursor = "grabbing";
    });

    window.addEventListener("mousemove", (e: MouseEvent) => {
      if (this.isDragging) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;

        this.editor.panBy(dx, dy);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      if (
        screenX >= 0 &&
        screenX <= rect.width &&
        screenY >= 0 &&
        screenY <= rect.height
      ) {
        const worldPoint = this.editor.viewport.screenToWorld({ x: screenX, y: screenY });
        const picked = this.editor.geometry.pixelToHex(worldPoint);
        const { bounds } = this.editor.getState();

        if (
          picked.col >= bounds.minCol &&
          picked.col <= bounds.maxCol &&
          picked.row >= bounds.minRow &&
          picked.row <= bounds.maxRow
        ) {
          this.editor.setHoveredHex(picked);
        } else {
          this.editor.setHoveredHex(null);
        }
      } else {
        if (this.editor.getState().hoveredHex !== null) {
          this.editor.setHoveredHex(null);
        }
      }
    });

    window.addEventListener("mouseup", () => {
      if (this.isDragging) {
        this.isDragging = false;
        canvas.style.cursor = "grab";
      }
    });

    canvas.addEventListener(
      "wheel",
      (e: WheelEvent) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        const factor = e.deltaY < 0 ? 1.06 : 1 / 1.06;
        this.editor.zoomAt(screenX, screenY, factor);
      },
      { passive: false }
    );
  }

  private resizeCanvas(): void {
    const size = this.getCanvasSize();
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    const targetWidth = Math.max(1, Math.floor(size.cssWidth * dpr));
    const targetHeight = Math.max(1, Math.floor(size.cssHeight * dpr));

    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
    }

    this.requestRender();
  }

  private getCanvasSize(): { cssWidth: number; cssHeight: number } {
    if (this.canvas.clientWidth && this.canvas.clientHeight) {
      return {
        cssWidth: this.canvas.clientWidth,
        cssHeight: this.canvas.clientHeight,
      };
    }
    const rect = this.canvas.getBoundingClientRect();
    return {
      cssWidth: rect.width || 800,
      cssHeight: rect.height || 600,
    };
  }

  private requestRender(): void {
    if (this.renderPending) return;
    this.renderPending = true;

    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => {
        this.renderPending = false;
        this.render();
      });
    } else {
      this.renderPending = false;
      this.render();
    }
  }

  private render(): void {
    const { cssWidth, cssHeight } = this.getCanvasSize();
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    const stamps = this.editor.getRenderStamps();
    const fallbacks = this.editor.getRenderFallbacks();
    const state = this.editor.getState();

    const gridOptions: GridRenderOptions = {
      cols: state.bounds.maxCol - state.bounds.minCol + 1,
      rows: state.bounds.maxRow - state.bounds.minRow + 1,
      hexGeometry: this.editor.geometry,
      highlightedHex: state.hoveredHex,
      stamps,
      fallbacks,
    };

    this.renderer.render(this.editor.viewport, gridOptions, cssWidth, cssHeight, dpr);
  }

  private syncControls(state: EditorState): void {
    const isBuiltin = state.mapSource.kind === "builtin";

    if (this.sourceBuiltinBtn) {
      this.sourceBuiltinBtn.classList.toggle("active", isBuiltin);
    }
    if (this.sourceJsonBtn) {
      this.sourceJsonBtn.classList.toggle("active", !isBuiltin);
    }

    if (this.panelBuiltinControls) {
      this.panelBuiltinControls.classList.toggle("hidden", !isBuiltin);
    }
    if (this.panelJsonControls) {
      this.panelJsonControls.classList.toggle("hidden", isBuiltin);
    }

    if (this.seedInput && document.activeElement !== this.seedInput) {
      this.seedInput.value = String(state.seed);
    }
    if (this.scaleInput && document.activeElement !== this.scaleInput) {
      this.scaleInput.value = String(state.scale);
    }
    if (this.assetSeedInput && document.activeElement !== this.assetSeedInput) {
      this.assetSeedInput.value = String(state.previewAssetSeed);
    }

    const isBusy = state.status === "generating" || state.status === "loading-assets";
    if (this.generateBtn) {
      this.generateBtn.disabled = isBusy;
      this.generateBtn.textContent = isBusy ? "生成中..." : "生成地圖";
    }
    if (this.rerollAssetsBtn) {
      this.rerollAssetsBtn.disabled = isBusy;
    }
    if (this.addAssetsBtn) {
      this.addAssetsBtn.disabled = isBusy;
    }
  }

  private updateStatusDisplay(state: EditorState): void {
    if (this.statusSource) {
      if (state.mapSource.kind === "builtin") {
        this.statusSource.textContent = `地圖來源：隨機生成 (種子: ${state.seed})`;
      } else {
        const name = state.mapSource.name || "自訂 JSON";
        this.statusSource.textContent = `地圖來源：JSON 檔案 (${name})`;
      }
    }

    if (this.statusText) {
      const isError = state.status === "error";
      this.statusText.classList.toggle("error", isError);

      const statusMap: Record<string, string> = {
        idle: "閒置",
        generating: "正在生成地圖...",
        "loading-assets": "正在載入素材圖檔...",
        ready: "就緒",
        error: `錯誤：${state.errorMessage ?? "未知錯誤"}`,
      };

      const statusLabel = statusMap[state.status] ?? state.status;
      const zoomPct = Math.round(state.zoom * 100);
      const panStr = `平移: (${Math.round(state.panX)}, ${Math.round(state.panY)})`;
      const gridStr = `${state.bounds.maxCol - state.bounds.minCol + 1}×${state.bounds.maxRow - state.bounds.minRow + 1}`;

      this.statusText.textContent = `狀態：${statusLabel} | 網格：${gridStr} | 縮放：${zoomPct}% | ${panStr}`;
    }

    if (this.hoverInfo) {
      if (state.hoveredHex) {
        const hex = state.hoveredHex;
        const terrainId = state.terrainMap.get(hex);
        const terrainDef = terrainId ? this.editor.terrainRegistry.get(terrainId) : undefined;
        const assetId = state.assetMap.get(hex);
        const terrainStr = terrainDef ? terrainDef.displayName : terrainId ? terrainId.value : "無";
        const asset = assetId ? this.editor.assetRegistry.get(assetId) : undefined;
        const assetStr = asset ? asset.name : terrainId ? "[未設定素材 / 底色預覽]" : "無";

        this.hoverInfo.textContent = `六角格：(${hex.col}, ${hex.row}) | 地形：${terrainStr} | 素材變體：${assetStr}`;
      } else {
        this.hoverInfo.textContent = "游標位置：無";
      }
    }
  }

  /**
   * Renders the Asset Library panel with registered variants grouped by terrain.
   * Provides live thumbnail previews and instant weight editing without regenerating terrain.
   */
  public renderAssetLibrary(): void {
    if (!this.assetLibraryContent) return;

    // If an input inside the library is actively focused, avoid clobbering user typing
    if (
      typeof document !== "undefined" &&
      document.activeElement &&
      this.assetLibraryContent.contains(document.activeElement)
    ) {
      return;
    }

    this.assetLibraryContent.innerHTML = "";

    const terrains = this.editor.terrainRegistry.list();
    const totalAssets = this.editor.assetRegistry.size;

    if (totalAssets === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "empty-library-msg";
      emptyMsg.textContent = '尚未註冊任何素材。\n請點擊上方「匯入素材 PNG...」加入印章圖檔。';
      this.assetLibraryContent.appendChild(emptyMsg);
      return;
    }

    for (const terrain of terrains) {
      const group = document.createElement("div");
      group.className = "terrain-group";
      group.dataset.terrainId = terrain.id.value;

      const title = document.createElement("div");
      title.className = "terrain-group-title";
      title.textContent = terrain.displayName;
      group.appendChild(title);

      const assets = this.editor.assetRegistry.getByTerrain(terrain.id);
      if (assets.length === 0) {
        const emptyTerrain = document.createElement("div");
        emptyTerrain.className = "empty-terrain-msg";
        emptyTerrain.textContent = "未設定素材（使用底色預覽）";
        group.appendChild(emptyTerrain);
      } else {
        const list = document.createElement("div");
        list.className = "variant-list";

        for (const asset of assets) {
          const row = document.createElement("div");
          row.className = "variant-row";
          row.dataset.assetId = asset.id.value;

          // Thumbnail Container
          const thumbBox = document.createElement("div");
          thumbBox.className = "variant-thumb-box";

          const img = document.createElement("img");
          img.className = "variant-thumb-img";
          img.src = asset.source;
          img.alt = asset.name;
          img.loading = "lazy";
          img.onerror = () => {
            thumbBox.innerHTML = '<span class="variant-thumb-error">無法載入預覽圖</span>';
          };
          thumbBox.appendChild(img);
          row.appendChild(thumbBox);

          // Details Container (Name + Weight)
          const details = document.createElement("div");
          details.className = "variant-details";

          const nameEl = document.createElement("div");
          nameEl.className = "variant-name";
          nameEl.textContent = asset.name;
          nameEl.title = asset.name;
          details.appendChild(nameEl);

          const weightWrap = document.createElement("div");
          weightWrap.className = "variant-weight-wrap";

          const weightLabel = document.createElement("span");
          weightLabel.className = "variant-weight-label";
          weightLabel.textContent = "出現權重:";
          weightWrap.appendChild(weightLabel);

          const weightInput = document.createElement("input");
          weightInput.type = "number";
          weightInput.className = "variant-weight-input";
          weightInput.min = "0";
          weightInput.step = "0.1";
          weightInput.value = String(asset.weight);
          weightInput.dataset.assetId = asset.id.value;

          weightInput.addEventListener("change", async () => {
            const rawVal = weightInput.value.trim();
            const val = parseFloat(rawVal);
            if (!Number.isFinite(val) || val < 0) {
              weightInput.classList.add("invalid");
              weightInput.value = String(asset.weight);
              return;
            }

            weightInput.classList.remove("invalid");
            try {
              await this.editor.updateAssetWeight(asset.id, val);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              this.editor.setError(msg);
              weightInput.value = String(asset.weight);
            }
          });

          weightWrap.appendChild(weightInput);
          details.appendChild(weightWrap);
          row.appendChild(details);

          list.appendChild(row);
        }

        group.appendChild(list);
      }

      this.assetLibraryContent.appendChild(group);
    }
  }
}

