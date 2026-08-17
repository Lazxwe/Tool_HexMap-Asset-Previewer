import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AssetId } from "../../src/domain/asset/AssetId";
import { TerrainAsset } from "../../src/domain/asset/TerrainAsset";
import { TerrainAssetRegistry } from "../../src/domain/asset/TerrainAssetRegistry";
import { HexCoordinate } from "../../src/domain/hex/HexCoordinate";
import { HexGeometry } from "../../src/domain/hex/HexGeometry";
import { TerrainDefinition } from "../../src/domain/terrain/TerrainDefinition";
import { TerrainId } from "../../src/domain/terrain/TerrainId";
import { TerrainRegistry } from "../../src/domain/terrain/TerrainRegistry";
import { EditorCore } from "../../src/editor/EditorCore";
import { SeededNoiseField } from "../../src/generation/SeededNoiseField";
import { TerrainClassifier } from "../../src/generation/TerrainClassification";
import { TerrainGenerator } from "../../src/generation/TerrainGenerator";
import { AssetLoader } from "../../src/infrastructure/asset/AssetLoader";
import { CanvasRenderer } from "../../src/rendering/CanvasRenderer";
import { Viewport } from "../../src/rendering/Viewport";
import { EditorUI } from "../../src/ui/EditorUI";
import { MockImageDecoder } from "../infrastructure/asset/MockImageDecoder";

// Lightweight Mock DOM Helper for Node Test Environment
class MockEventTarget {
  private listeners: Map<string, Array<(e: any) => void>> = new Map();

  public addEventListener(type: string, listener: (e: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  public removeEventListener(type: string, listener: (e: any) => void): void {
    const list = this.listeners.get(type);
    if (list) {
      const idx = list.indexOf(listener);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  public dispatchEvent(event: any): boolean {
    const list = this.listeners.get(event.type);
    if (list) {
      for (const listener of list) {
        listener(event);
      }
    }
    return true;
  }
}

class MockClassList {
  private classes: Set<string> = new Set();
  add(name: string): void {
    this.classes.add(name);
  }
  remove(name: string): void {
    this.classes.delete(name);
  }
  toggle(name: string, force?: boolean): boolean {
    if (force === true) {
      this.classes.add(name);
      return true;
    } else if (force === false) {
      this.classes.delete(name);
      return false;
    }
    if (this.classes.has(name)) {
      this.classes.delete(name);
      return false;
    } else {
      this.classes.add(name);
      return true;
    }
  }
  contains(name: string): boolean {
    return this.classes.has(name);
  }
}

class MockElement extends MockEventTarget {
  public value: string = "";
  public textContent: string | null = "";
  public innerHTML: string = "";
  public disabled: boolean = false;
  public width: number = 800;
  public height: number = 600;
  public style: Record<string, string> = {};
  public classList: MockClassList = new MockClassList();
  public children: MockElement[] = [];
  public files: File[] = [];
  public dataset: Record<string, string> = {};
  public src: string = "";
  public alt: string = "";
  public type: string = "";
  public min: string = "";
  public step: string = "";
  public className: string = "";
  public title: string = "";
  public onerror: (() => void) | null = null;

  public appendChild(child: MockElement) {
    this.children.push(child);
  }

  public contains(el: any): boolean {
    if (el === this) return true;
    for (const child of this.children) {
      if (child.contains && child.contains(el)) return true;
    }
    return false;
  }

  public getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      width: this.width,
      height: this.height,
      right: this.width,
      bottom: this.height,
    };
  }

  public click() {
    this.dispatchEvent({ type: "click" });
  }
}

describe("EditorUI", () => {
  let originalWindow: any;
  let originalDocument: any;
  let originalUrl: any;

  let mockWindow: MockEventTarget & { devicePixelRatio: number };
  let mockDocument: { activeElement: any; createElement: (tag: string) => MockElement };

  let canvas: MockElement;
  let sourceBuiltinBtn: MockElement;
  let sourceJsonBtn: MockElement;
  let panelBuiltinControls: MockElement;
  let panelJsonControls: MockElement;
  let openJsonBtn: MockElement;
  let jsonFileInput: MockElement;
  let seedInput: MockElement;
  let scaleInput: MockElement;
  let generateBtn: MockElement;
  let randomSeedBtn: MockElement;
  let addAssetsBtn: MockElement;
  let assetFilesInput: MockElement;
  let assetSeedInput: MockElement;
  let rerollAssetsBtn: MockElement;
  let resetViewBtn: MockElement;
  let canvasContainer: MockElement;
  let dragDropOverlay: MockElement;
  let modalAssetRegister: MockElement;
  let btnModalClose: MockElement;
  let assetModalFilename: MockElement;
  let selectAssetTerrain: MockElement;
  let inputAssetWeight: MockElement;
  let btnCancelAsset: MockElement;
  let btnSubmitAsset: MockElement;
  let statusSource: MockElement;
  let statusText: MockElement;
  let hoverInfo: MockElement;
  let panelAssetLibrary: MockElement;
  let assetLibraryContent: MockElement;

  let editor: EditorCore;
  let renderer: CanvasRenderer;
  let ui: EditorUI;

  beforeEach(() => {
    // 1. Setup mock DOM environment
    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;
    originalUrl = (globalThis as any).URL;

    mockWindow = new MockEventTarget() as any;
    mockWindow.devicePixelRatio = 1;
    mockDocument = {
      activeElement: null,
      createElement: (_tag: string) => new MockElement(),
    };

    (globalThis as any).window = mockWindow;
    (globalThis as any).document = mockDocument;
    (globalThis as any).URL = {
      createObjectURL: vi.fn((file: any) => `blob:mock/${file.name}`),
      revokeObjectURL: vi.fn(),
    };

    // 2. Setup mock elements
    canvas = new MockElement();
    sourceBuiltinBtn = new MockElement();
    sourceJsonBtn = new MockElement();
    panelBuiltinControls = new MockElement();
    panelJsonControls = new MockElement();
    openJsonBtn = new MockElement();
    jsonFileInput = new MockElement();
    seedInput = new MockElement();
    seedInput.value = "12345";
    scaleInput = new MockElement();
    scaleInput.value = "180";
    generateBtn = new MockElement();
    randomSeedBtn = new MockElement();
    addAssetsBtn = new MockElement();
    assetFilesInput = new MockElement();
    assetSeedInput = new MockElement();
    assetSeedInput.value = "12345";
    rerollAssetsBtn = new MockElement();
    resetViewBtn = new MockElement();
    canvasContainer = new MockElement();
    dragDropOverlay = new MockElement();
    dragDropOverlay.classList.add("hidden");
    modalAssetRegister = new MockElement();
    modalAssetRegister.classList.add("hidden");
    btnModalClose = new MockElement();
    assetModalFilename = new MockElement();
    selectAssetTerrain = new MockElement();
    inputAssetWeight = new MockElement();
    btnCancelAsset = new MockElement();
    btnSubmitAsset = new MockElement();
    statusSource = new MockElement();
    statusText = new MockElement();
    hoverInfo = new MockElement();
    panelAssetLibrary = new MockElement();
    assetLibraryContent = new MockElement();

    // 3. Setup domain & editor services
    const terrainRegistry = new TerrainRegistry();
    terrainRegistry.register(new TerrainDefinition({ id: "forest", displayName: "Forest" }));
    terrainRegistry.register(new TerrainDefinition({ id: "water", displayName: "Water" }));

    const assetRegistry = new TerrainAssetRegistry();
    assetRegistry.register(
      new TerrainAsset({
        id: "forest_01",
        terrainId: "forest",
        name: "Forest 1",
        source: "assets/forest_01.png",
        weight: 10,
      })
    );

    const hexGeometry = new HexGeometry(120, 70);
    const classifier = new TerrainClassifier([{ terrainId: new TerrainId("forest"), max: 1.0 }]);
    const noise = new SeededNoiseField(12345);
    const generator = new TerrainGenerator(noise, hexGeometry, classifier);
    const assetLoader = new AssetLoader(new MockImageDecoder());
    const viewport = new Viewport({ zoom: 1.0 });

    editor = new EditorCore(
      { generator, assetRegistry, terrainRegistry, assetLoader, geometry: hexGeometry, viewport },
      { initialSeed: 12345, initialScale: 180, initialBounds: { minCol: 0, maxCol: 4, minRow: 0, maxRow: 4 } }
    );

    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      setTransform: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      clip: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    renderer = new CanvasRenderer(mockCtx);

    ui = new EditorUI(editor, renderer, {
      canvas: canvas as unknown as HTMLCanvasElement,
      sourceBuiltinBtn: sourceBuiltinBtn as unknown as HTMLButtonElement,
      sourceJsonBtn: sourceJsonBtn as unknown as HTMLButtonElement,
      panelBuiltinControls: panelBuiltinControls as unknown as HTMLElement,
      panelJsonControls: panelJsonControls as unknown as HTMLElement,
      openJsonBtn: openJsonBtn as unknown as HTMLButtonElement,
      jsonFileInput: jsonFileInput as unknown as HTMLInputElement,
      seedInput: seedInput as unknown as HTMLInputElement,
      scaleInput: scaleInput as unknown as HTMLInputElement,
      generateBtn: generateBtn as unknown as HTMLButtonElement,
      randomSeedBtn: randomSeedBtn as unknown as HTMLButtonElement,
      addAssetsBtn: addAssetsBtn as unknown as HTMLButtonElement,
      assetFilesInput: assetFilesInput as unknown as HTMLInputElement,
      assetSeedInput: assetSeedInput as unknown as HTMLInputElement,
      rerollAssetsBtn: rerollAssetsBtn as unknown as HTMLButtonElement,
      resetViewBtn: resetViewBtn as unknown as HTMLButtonElement,
      canvasContainer: canvasContainer as unknown as HTMLElement,
      dragDropOverlay: dragDropOverlay as unknown as HTMLElement,
      modalAssetRegister: modalAssetRegister as unknown as HTMLElement,
      btnModalClose: btnModalClose as unknown as HTMLButtonElement,
      assetModalFilename: assetModalFilename as unknown as HTMLElement,
      selectAssetTerrain: selectAssetTerrain as unknown as HTMLSelectElement,
      inputAssetWeight: inputAssetWeight as unknown as HTMLInputElement,
      btnCancelAsset: btnCancelAsset as unknown as HTMLButtonElement,
      btnSubmitAsset: btnSubmitAsset as unknown as HTMLButtonElement,
      statusSource: statusSource as unknown as HTMLElement,
      statusText: statusText as unknown as HTMLElement,
      hoverInfo: hoverInfo as unknown as HTMLElement,
      panelAssetLibrary: panelAssetLibrary as unknown as HTMLElement,
      assetLibraryContent: assetLibraryContent as unknown as HTMLElement,
    });
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    (globalThis as any).URL = originalUrl;
  });

  it("should mount and subscribe to editor state updates", () => {
    const subscribeSpy = vi.spyOn(editor, "subscribe");
    ui.mount();

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(seedInput.value).toBe("12345");
    expect(scaleInput.value).toBe("180");
    expect(statusSource.textContent).toContain("地圖來源：隨機生成");

    ui.unmount();
  });

  it("should update editor seed when seed input changes", () => {
    ui.mount();

    const setSeedSpy = vi.spyOn(editor, "setSeed");
    seedInput.value = "54321";
    seedInput.dispatchEvent({ type: "change" });

    expect(setSeedSpy).toHaveBeenCalledWith(54321);

    ui.unmount();
  });

  it("should update editor scale when scale input changes", () => {
    ui.mount();

    const setScaleSpy = vi.spyOn(editor, "setScale");
    scaleInput.value = "250";
    scaleInput.dispatchEvent({ type: "change" });

    expect(setScaleSpy).toHaveBeenCalledWith(250);

    ui.unmount();
  });

  it("should trigger generate when generate button is clicked", () => {
    ui.mount();

    const generateSpy = vi.spyOn(editor, "generate");
    generateBtn.click();

    expect(generateSpy).toHaveBeenCalledTimes(1);

    ui.unmount();
  });

  it("should trigger regenerate with new seed when random seed button is clicked", () => {
    ui.mount();

    const regenSpy = vi.spyOn(editor, "regenerate");
    randomSeedBtn.click();

    expect(regenSpy).toHaveBeenCalledTimes(1);

    ui.unmount();
  });

  it("should center viewport when reset view button is clicked", () => {
    ui.mount();

    const centerSpy = vi.spyOn(editor, "centerOnGrid");
    resetViewBtn.click();

    expect(centerSpy).toHaveBeenCalledWith({ x: 800, y: 600 }, 1.0);

    ui.unmount();
  });

  it("should update hover info display with variant display name when hoveredHex changes in state", async () => {
    ui.mount();
    await editor.generate();

    editor.setHoveredHex(new HexCoordinate(0, 0));
    expect(hoverInfo.textContent).toContain("六角格：(0, 0)");
    expect(hoverInfo.textContent).toContain("地形：Forest");
    // Must display artist-facing Display Name "Forest 1", NOT internal AssetId "forest_01"
    expect(hoverInfo.textContent).toContain("素材變體：Forest 1");

    editor.setHoveredHex(null);
    expect(hoverInfo.textContent).toBe("游標位置：無");

    ui.unmount();
  });

  it("should handle wheel zoom interaction on canvas", () => {
    ui.mount();

    const zoomSpy = vi.spyOn(editor, "zoomAt");
    const preventDefault = vi.fn();

    canvas.dispatchEvent({
      type: "wheel",
      deltaY: -100,
      clientX: 200,
      clientY: 150,
      preventDefault,
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(zoomSpy).toHaveBeenCalledWith(200, 150, 1.06);

    ui.unmount();
  });

  it("should handle mouse drag panning interaction", () => {
    ui.mount();

    const panSpy = vi.spyOn(editor, "panBy");

    // 1. Mouse down
    canvas.dispatchEvent({ type: "mousedown", clientX: 100, clientY: 100 });
    // 2. Mouse move
    mockWindow.dispatchEvent({ type: "mousemove", clientX: 150, clientY: 120 });

    expect(panSpy).toHaveBeenCalledWith(50, 20);

    // 3. Mouse up
    mockWindow.dispatchEvent({ type: "mouseup" });

    ui.unmount();
  });

  it("should switch between Built-in and JSON source panels on toggle button click", () => {
    ui.mount();

    expect(sourceBuiltinBtn.classList.contains("active")).toBe(true);
    expect(panelBuiltinControls.classList.contains("hidden")).toBe(false);
    expect(panelJsonControls.classList.contains("hidden")).toBe(true);

    sourceJsonBtn.click();
    expect(sourceJsonBtn.classList.contains("active")).toBe(true);
    expect(panelBuiltinControls.classList.contains("hidden")).toBe(true);
    expect(panelJsonControls.classList.contains("hidden")).toBe(false);

    sourceBuiltinBtn.click();
    expect(sourceBuiltinBtn.classList.contains("active")).toBe(true);
    expect(panelBuiltinControls.classList.contains("hidden")).toBe(false);
    expect(panelJsonControls.classList.contains("hidden")).toBe(true);

    ui.unmount();
  });

  it("should update previewAssetSeed when asset seed input changes", () => {
    ui.mount();

    const setAssetSeedSpy = vi.spyOn(editor, "setPreviewAssetSeed");
    assetSeedInput.value = "98765";
    assetSeedInput.dispatchEvent({ type: "change" });

    expect(setAssetSeedSpy).toHaveBeenCalledWith(98765);

    ui.unmount();
  });

  it("should trigger rerollAssets when reroll button is clicked", () => {
    ui.mount();

    const rerollSpy = vi.spyOn(editor, "rerollAssets");
    rerollAssetsBtn.click();

    expect(rerollSpy).toHaveBeenCalledTimes(1);

    ui.unmount();
  });

  it("should add error class and display specific message when editor status is error", async () => {
    ui.mount();

    // Trigger an unknown terrain error
    await editor.loadJson(
      JSON.stringify({
        formatVersion: 1,
        terrainMap: [{ col: 0, row: 0, terrainId: "unknown_biome" }],
      })
    );

    expect(statusText.classList.contains("error")).toBe(true);
    expect(statusText.textContent).toContain('Unknown terrainId: "unknown_biome"');

    ui.unmount();
  });

  describe("Asset Input Workflow (Task 014)", () => {
    const createMockFile = (name: string, size: number = 1024, type: string = "image/png"): File => {
      return { name, size, type } as unknown as File;
    };

    it("should open file picker when Add Assets button is clicked", () => {
      ui.mount();
      const clickSpy = vi.spyOn(assetFilesInput, "click");

      addAssetsBtn.click();
      expect(clickSpy).toHaveBeenCalledTimes(1);

      ui.unmount();
    });

    it("should open registration modal with terrain options when valid PNG is selected", () => {
      ui.mount();
      const file = createMockFile("oak_tree.png", 2048);
      assetFilesInput.files = [file];

      assetFilesInput.dispatchEvent({ type: "change", target: assetFilesInput });

      expect(modalAssetRegister.classList.contains("hidden")).toBe(false);
      expect(assetModalFilename.textContent).toContain("oak_tree.png");
      expect(selectAssetTerrain.children.length).toBe(2); // Forest, Water
      expect(inputAssetWeight.value).toBe("1.0");

      ui.unmount();
    });

    it("should register asset and refresh preview when modal is submitted", async () => {
      ui.mount();
      const registerSpy = vi.spyOn(editor, "registerAsset");

      const file = createMockFile("oak_tree.png", 2048);
      ui.handleAssetFiles([file]);

      selectAssetTerrain.value = "forest";
      inputAssetWeight.value = "2.5";

      btnSubmitAsset.click();

      await vi.waitFor(() => {
        expect(registerSpy).toHaveBeenCalledTimes(1);
        expect(modalAssetRegister.classList.contains("hidden")).toBe(true);
      });

      const registeredAsset = registerSpy.mock.calls[0][0];
      expect(registeredAsset.name).toBe("Forest 2");
      expect(registeredAsset.terrainId.value).toBe("forest");
      expect(registeredAsset.weight).toBe(2.5);

      ui.unmount();
    });

    it("should handle Drag & Drop flow (dragover, dragleave, drop)", () => {
      ui.mount();
      const file = createMockFile("swamp_rock.png", 4096);

      // 1. Dragover shows overlay
      canvasContainer.dispatchEvent({
        type: "dragover",
        preventDefault: vi.fn(),
        dataTransfer: { dropEffect: "" },
      });
      expect(dragDropOverlay.classList.contains("hidden")).toBe(false);

      // 2. Dragleave hides overlay
      canvasContainer.dispatchEvent({ type: "dragleave" });
      expect(dragDropOverlay.classList.contains("hidden")).toBe(true);

      // 3. Drop validates and opens modal
      canvasContainer.dispatchEvent({
        type: "drop",
        preventDefault: vi.fn(),
        dataTransfer: { files: [file] },
      });

      expect(modalAssetRegister.classList.contains("hidden")).toBe(false);
      expect(assetModalFilename.textContent).toContain("swamp_rock.png");

      ui.unmount();
    });

    it("should display error and preserve map when non-PNG or empty file is dropped", () => {
      ui.mount();

      const badFile = createMockFile("invalid.jpg", 1024, "image/jpeg");
      ui.handleAssetFiles([badFile]);

      expect(editor.getState().status).toBe("error");
      expect(editor.getState().errorMessage).toContain("Only PNG files are supported");
      expect(modalAssetRegister.classList.contains("hidden")).toBe(true);

      ui.unmount();
    });
  });

  describe("Asset Library / Variant Management (Task 016)", () => {
    it("should render terrain groups, variant display names, thumbnails, and weights", () => {
      ui.mount();

      expect(assetLibraryContent.children.length).toBeGreaterThan(0);

      // Find forest terrain group
      const forestGroup = assetLibraryContent.children.find(
        (c) => c.dataset.terrainId === "forest"
      );
      expect(forestGroup).toBeDefined();

      const titleEl = forestGroup!.children.find((c) => c.className === "terrain-group-title");
      expect(titleEl?.textContent).toBe("Forest");

      const listEl = forestGroup!.children.find((c) => c.className === "variant-list");
      expect(listEl).toBeDefined();

      const rowEl = listEl!.children[0];
      expect(rowEl.dataset.assetId).toBe("forest_01");

      // Verify thumbnail
      const thumbBox = rowEl.children.find((c) => c.className === "variant-thumb-box");
      expect(thumbBox).toBeDefined();
      const img = thumbBox!.children.find((c) => c.className === "variant-thumb-img");
      expect(img?.src).toBe("assets/forest_01.png");
      expect(img?.alt).toBe("Forest 1");

      // Verify variant display name is Forest 1, NOT forest_01
      const details = rowEl.children.find((c) => c.className === "variant-details");
      const nameEl = details?.children.find((c) => c.className === "variant-name");
      expect(nameEl?.textContent).toBe("Forest 1");

      // Verify weight input
      const weightWrap = details?.children.find((c) => c.className === "variant-weight-wrap");
      const weightInput = weightWrap?.children.find((c) => c.className === "variant-weight-input");
      expect(weightInput?.value).toBe("10");

      // Verify water terrain (empty terrain)
      const waterGroup = assetLibraryContent.children.find(
        (c) => c.dataset.terrainId === "water"
      );
      expect(waterGroup).toBeDefined();
      const emptyMsg = waterGroup!.children.find((c) => c.className === "empty-terrain-msg");
      expect(emptyMsg?.textContent).toBe("未設定素材（使用底色預覽）");

      ui.unmount();
    });

    it("should update weight and refresh preview when weight input changes", async () => {
      ui.mount();
      await editor.generate();

      const updateSpy = vi.spyOn(editor, "updateAssetWeight");

      const forestGroup = assetLibraryContent.children.find(
        (c) => c.dataset.terrainId === "forest"
      );
      const listEl = forestGroup!.children.find((c) => c.className === "variant-list");
      const rowEl = listEl!.children[0];
      const details = rowEl.children.find((c) => c.className === "variant-details");
      const weightWrap = details?.children.find((c) => c.className === "variant-weight-wrap");
      const weightInput = weightWrap?.children.find((c) => c.className === "variant-weight-input")!;

      // Change weight to 2.5
      weightInput.value = "2.5";
      weightInput.dispatchEvent({ type: "change" });

      await vi.waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(new AssetId("forest_01"), 2.5);
      });

      expect(editor.assetRegistry.get("forest_01")!.weight).toBe(2.5);

      ui.unmount();
    });

    it("should reject invalid weight and restore previous value", () => {
      ui.mount();
      const updateSpy = vi.spyOn(editor, "updateAssetWeight");

      const forestGroup = assetLibraryContent.children.find(
        (c) => c.dataset.terrainId === "forest"
      );
      const listEl = forestGroup!.children.find((c) => c.className === "variant-list");
      const rowEl = listEl!.children[0];
      const details = rowEl.children.find((c) => c.className === "variant-details");
      const weightWrap = details?.children.find((c) => c.className === "variant-weight-wrap");
      const weightInput = weightWrap?.children.find((c) => c.className === "variant-weight-input")!;

      // Input invalid negative weight
      weightInput.value = "-3";
      weightInput.dispatchEvent({ type: "change" });

      expect(updateSpy).not.toHaveBeenCalled();
      expect(weightInput.classList.contains("invalid")).toBe(true);
      expect(weightInput.value).toBe("10");

      ui.unmount();
    });

    it("should render empty state message when registry is empty", () => {
      editor.assetRegistry.clear();
      ui.mount();

      const emptyEl = assetLibraryContent.children.find(
        (c) => c.className === "empty-library-msg"
      );
      expect(emptyEl).toBeDefined();
      expect(emptyEl?.textContent).toContain("尚未註冊任何素材");

      ui.unmount();
    });
  });
});
