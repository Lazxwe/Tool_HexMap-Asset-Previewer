# Implementation Plan - Hex Terrain Preview

## Milestone Breakdown

- **M01: Project Bootstrap** (Completed)
  - Set up TS, Vite, Vitest, Canvas 2D entry, Tauri config, documentation baseline.
- **M02: Hex Domain** (Completed)
  - Task 002 & Task 002-R1 (Completed): Pure Flat-top hex domain math, HexCoordinate value object, HexGeometry (hexToPixel, pixelToHex, getHexPolygon, getHexNeighbors), polygon-consistent picking, deterministic boundary ownership, independent width/height support.
- **M03: Canvas Renderer Engine** (Completed)
  - Task 003 (Completed): Canvas 2D Viewport abstraction, forward/inverse world-screen transforms, anchor-preserving zoom, screen-space pan, High-DPI scaling, 10x10 Flat-top hex grid & coordinate label visualization.
  - Task 007 (Completed): Terrain Stamp Canvas Rendering pipeline (TerrainStampRenderer, hex polygon clipping, aspect-ratio-preserving cover scaling, layered grid overlay, render failure isolation).
- **M04: Terrain Domain** (Completed)
  - Task 004 & Task 004-R1 (Completed): Pure Terrain Domain layer (TerrainId value object, TerrainDefinition semantic category metadata, TerrainRegistry catalog, TerrainMap HexCoordinate -> TerrainId spatial mapping, decoupled from asset selection weights).
- **M05: Asset Domain & Loading Infrastructure** (Completed)
  - Task 005 (Completed): Pure Asset Domain layer (AssetId value object, TerrainAsset visual stamp descriptor & selection weight model, TerrainAssetRegistry catalog with terrain-based query support).
  - Task 006 (Completed): Infrastructure Asset Loading layer (AssetLoader, BrowserImageDecoder, MockImageDecoder, LoadedAsset, RenderableImage, in-memory caching and request deduplication).
- **M06: Procedural Terrain Generation & Weighted Selection** (Completed)
  - Task 008 (Completed): Pure Terrain Generation pipeline (NoiseField interface, SeededNoiseField smooth value noise with quintic interpolation, TerrainClassifier threshold mapping, HexBounds, TerrainGenerator orchestrating World Space continuous sampling into TerrainMap).
  - Task 009 (Completed): Weighted Asset Selection layer (RandomSource interface, SeededRandomSource Mulberry32 PRNG, HexAssetMap Hex -> AssetId spatial map, WeightedAssetSelector).
- **M07: Editor Core & UI Application Assembly** (Completed)
  - Task 010 (Completed): Editor Core orchestration service (EditorCore), single immutable state model (EditorState), transactional procedural generation pipeline (Generator -> Weighted Selection -> Async Asset Loading -> Stamp Assembly), independent deterministic PRNG stream derivation, EditorUI DOM & Canvas 2D event binding (zoom, pan, hex picking, hover state, responsive resizing).
- **M08: Project Persistence & Preview Input Boundary** (Completed)
  - Task 011 (Completed): Project Persistence Core (JSON ProjectDocument DTO, formatVersion 1, ProjectSerializer with deterministic coordinate sorting, ProjectValidation schema validation, ProjectDeserializer with domain object reconstruction, round-trip preservation, duplicate coordinate detection).
  - Task 012 (Completed): Preview Data Model & JSON Input Boundary (MapSource dual input abstraction for Built-in generator vs JSON map input, TerrainMap as canonical map data, HexAssetMap as derived preview state, missing asset fallback rendering, UI source switcher).
  - Task 013 (Completed): Input Contract & Preview UX (Unknown TerrainId validation against TerrainRegistry, Preview Asset Seed & Reroll Assets UI controls, transactional isolation on invalid JSON/terrains, specific validation error messages).
  - Task 014 (Completed): Asset Input Workflow (Unified File Picker & Drag-and-Drop PNG stamp import, AssetFileValidator, AssetIdGenerator, Terrain selection from TerrainRegistry, non-negative weights, transactional registration & instant preview refresh).
  - Task 015-P (Completed): Artist Preview UX Polish (Asset Visual Variant Naming, Max+1 variant numbering, Hover display name decoupling, Demo asset names, wheel zoom smoothing to 1.06, fallback label font size reduction, reroll tooltip).
  - Task 016 (Completed): Asset Library / Variant Management (Dedicated sidebar panel, terrain grouping, thumbnail previews with error isolation, variant display name presentation, live weight editing >= 0, map & seed invariance, empty state).
  - Task 017 (Completed): Final Architecture & Product Gap Review (Repository-wide review, invariant verification, zero scope violations).
  - Task 018 (Completed): Roadmap & Milestone Alignment Review (Milestone definition and documentation alignment).
- **M09: Preview Quality & Artist Workflow** (Completed)
  - Task 019 (Completed): Preview Quality & Artist Workflow (Task 019-A Large map scalability 25x25 & 50x50, 019-B Biome continuity, 019-C Multi-variant weighted balance & weight=0 exclusion, 019-D Stamp scaling & clipping, 019-E Missing asset fallback stability, 019-F Library inspection, 019-G Seed isolation, 019-H Viewport navigation, 019-I QA Scenarios, 019-J Performance observation, 019-K Documentation alignment).
  - *Conditional Refinement (Future)*: Brush painting, eraser, and undo/redo history stack (only triggered if real artist usage demonstrates manual hex adjustments are required).
- **M10: Tauri Desktop Integration** (Scheduled)
  - Native filesystem access, project save/load dialogs, asset file copying and bundling.
- **M11: Polish & Release** (Scheduled)
  - E2E testing, edge case handling, performance optimization, build package.
