# Architecture Decisions

## ADR-001: Rendering Technology

Use HTML Canvas 2D.

Reason:
The MVP only requires 2D terrain stamp rendering and Canvas provides sufficient performance with minimal complexity.

---

## ADR-002: Desktop Framework

Use Tauri.

Reason:
The application should be distributed as a standalone desktop application without requiring users to install a runtime.

---

## ADR-003: Hex Orientation

Use Flat-top hexagons.

---

## ADR-004: Hex Geometry

Hex width and height are independently configurable.

The application does not require mathematically regular hexagons.

---

## ADR-005: Terrain and Asset Separation

TerrainMap stores TerrainId.

Asset selection is handled separately.

Reason:
Terrain represents logical map data while assets represent visual presentation.

---

## ADR-006: PNG Assets

PNG assets are treated as visual stamps.

Assets do not need to tile or connect seamlessly.

Assets are not automatically clipped to hex boundaries.

---

## ADR-007: Terrain Generation

Terrain generation uses a low-frequency seeded noise field.

Terrain should have spatial continuity.

Terrain ratio represents an approximate global target rather than independent per-cell probability.

---

## ADR-008: Deterministic Generation

Generation must be deterministic.

The same project configuration and seed must produce the same result.

---

## ADR-009: Independent Random Streams

Terrain generation and asset selection use independent deterministic random streams.

---

## ADR-010: Asset Re-roll

Re-roll Assets changes only AssetMap.

TerrainMap must remain unchanged.

---

## ADR-011: Asset Persistence

Project files store AssetMap.

Reason:
Reopening a project must reproduce the same visual result.

---

## ADR-012: Asset Import

Imported assets are copied into the project.

Projects should be self-contained.

---

## ADR-013: Project Format

Project data is stored as JSON.

A version field is mandatory.

---

## ADR-014: Undo / Redo

MVP uses state snapshots for TerrainMap and AssetMap.

Camera and UI state are not part of undo history.

---

## ADR-015: Flat-top Offset Coordinate Convention

Use `odd-q` offset coordinates for the flat-top hex grid.

Reason:
In a flat-top hexagonal orientation, columns align with the X-axis while rows align with the Y-axis. The `odd-q` convention (odd columns shifted downwards by 0.5 * hexHeight) provides natural spatial indexing for 2D map views, simple column-based stride calculations, and seamless round-trip conversions via fractional axial cube-rounding.

---

## ADR-016: Hex Geometric Picking & Boundary Ownership

Use direct polygon-consistent half-plane metric $\text{metric}(u, v) = \max(2|u| + |v|, 2|v|)$ for pixel picking with deterministic lexicographical tie-breaking $(col, row)$ on shared boundaries.

Reason:
Ensures 100% spatial consistency between `getHexPolygon()` and `pixelToHex()` across arbitrary independent `hexWidth` and `hexHeight` aspect ratios with zero boundary ambiguity.

---

## ADR-017: Viewport Transformation & Coordinate Pipelines

Decouple World Coordinates from Screen Coordinates and Canvas Backing Store via an affine `Viewport` transformation model.

Reason:
Separating World space from Screen space ensures map domain data remains invariant under pan, zoom, and display DPI adjustments. Anchored zooming preserves the precise map point under the user's cursor.

---

## ADR-018: Terrain Definitions, Assets, & TerrainMap Separation

`TerrainRegistry` owns semantic `TerrainDefinition` metadata (`id`, `displayName`), visual assets (`TerrainAsset`) own their selection weights, and `TerrainMap` strictly stores `TerrainId` references mapped to `HexCoordinate` cells.

Reason:
Separating semantic terrain categories from visual asset variations allows multiple weighted PNG stamps per terrain type, prevents object coupling and bloated map storage, and supports clean procedural asset distribution.

---

## ADR-019: Asset Domain & Pure String URI References

The Asset Domain models visual stamp assets using immutable `TerrainAsset` descriptors with primitive string source identifiers, strictly excluding binary/browser objects (`File`, `Blob`, `HTMLImageElement`).

Reason:
Maintains pure platform independence in the domain layer, keeps domain data easily serializable into project JSON formats, and defers image decoding and caching to the dedicated Asset Loading layer (M06).

---

## ADR-020: Pluggable Image Decoder & In-Memory Asset Cache

The Asset Loading infrastructure uses an `IAssetLoader` service with an injected `ImageDecoder` strategy to resolve `TerrainAsset.source` strings into `RenderableImage` objects.

Reason:
Enables mock decoding in unit test environments, isolates browser DOM/Canvas APIs to the infrastructure layer, and deduplicates concurrent image decode requests through an in-memory cache.

---

## ADR-021: Hex-Clipped Terrain Stamp Rendering

Terrain stamps are rendered using `TerrainStampRenderer`, strictly clipped to the Hex polygon geometry, scaled via an aspect-ratio-preserving `cover` strategy centered on the hex center, and drawn underneath hex grid outlines.

Reason:
Guarantees visual stamps never bleed into neighboring hex cells, preserves original stamp proportions without non-uniform stretching, maintains clear separation between asset loading and rendering, and isolates per-stamp render failures.

---

## ADR-022: Deterministic Spatial Terrain Generation

Terrain generation utilizes `TerrainGenerator` sampling continuous 2D `NoiseField` implementations (e.g. `SeededNoiseField`) mapped via `HexGeometry.hexToPixel()` in World Space, translating scalar noise into `TerrainId` categories via `TerrainClassifier`.

Reason:
Decouples noise evaluation and classification from rendering and visual asset selection, guarantees deterministic reproducible maps for a given seed, and preserves spatial continuity across arbitrary hex grid layouts.

---

## ADR-023: Deterministic Weighted Asset Selection

Visual asset selection uses `WeightedAssetSelector` consuming an injected `RandomSource` (e.g. `SeededRandomSource`), sampling `TerrainAsset` options per `TerrainId` from `TerrainAssetRegistry` proportional to their `weight` and recording assignments in `HexAssetMap`.

Reason:
Separates semantic terrain map data (`TerrainMap`) from visual stamp assignments (`HexAssetMap`), guarantees deterministic reproduction with independent PRNG streams, ignores zero-weight assets, and isolates random generation from rendering.

---

## ADR-024: Editor Core as Application Orchestrator

The Map Editor architecture utilizes `EditorCore` as the dedicated application orchestration service, coordinating `TerrainGenerator`, `WeightedAssetSelector`, `IAssetLoader`, and `CanvasRenderer` while managing a single immutable `EditorState`.

Principles & Invariants:
1. **EditorCore as Orchestrator**: EditorCore manages workflow execution, state transitions, subscriptions, and viewport commands without duplicating or reimplementing domain algorithms.
2. **Domain, Generation, & Selection Purity**: Pure business layers remain isolated from UI, Canvas, Image, and Browser dependencies.
3. **UI Decoupling**: UI components and DOM controllers (`EditorUI`) interact strictly via `EditorCore` commands and subscriptions without directly modifying domain models or rendering state.
4. **Asynchronous Infrastructure Asset Loading**: Image decoding and caching remain strictly encapsulated in the infrastructure layer (`AssetLoader`), with in-memory deduplication across cells referencing the same asset.
5. **Transactional State Commit**: Map generation commits new `TerrainMap`, `HexAssetMap`, and render stamps atomically upon complete generation and asset loading success. If generation or loading throws an error, the previous valid map state is retained and status is set to `error`.
6. **Render Data Decoupling**: `CanvasRenderer` and `TerrainStampRenderer` accept only render-ready data contracts (`HexStampEntry[]` with `LoadedAsset`) without knowledge of domain registries or procedural generators.
7. **Independent Deterministic PRNG Streams**: Terrain generation uses the configured seed while asset selection uses a deterministically derived independent seed (`deriveAssetSeed(seed)`). Viewport transformations (zoom, pan, hover picking) and canvas redraws never consume PRNG values.

---

## ADR-025: Versioned Project Persistence Boundary

Project persistence utilizes a dedicated `ProjectDocument` DTO and `ProjectSerializer`/`ProjectDeserializer` service layer, establishing a pure, versioned data interchange format decoupled from runtime resources, UI state, and filesystem implementations.

Principles & Invariants:
1. **Runtime Resource Decoupling**: Project documents strictly record semantic identifiers (`TerrainId`, `AssetId`) and mathematical parameters, never embedding binary images, DOM elements (`HTMLImageElement`), Canvas contexts, or `LoadedAsset` instances.
2. **Transient State Exclusion**: Runtime status (`status`, `errorMessage`, `hoveredHex`) is not persisted; reopening or parsing project data reconstructs a fresh `PersistableProjectState`.
3. **Explicit Format Versioning**: Project files declare an integer `formatVersion` (starting at `1`). Future unknown versions (`> 1`) or invalid versions (`< 1`, non-integer) are strictly rejected upon validation.
4. **Deterministic Spatial Map Representation**: Map cells are serialized as flat entry arrays ordered by `col ASC, row ASC` to guarantee deterministic, git-diff-friendly JSON representations.
5. **Duplicate Coordinate Rejection**: Duplicate coordinate entries are strictly rejected during schema validation to prevent silent corruption or ambiguous map state.
6. **Filesystem Independence**: Serialization operates purely in memory as string/object transformations without coupling to Tauri APIs or native filesystem I/O.

---

## ADR-026: TerrainMap as Persistent Preview Input

The application architecture establishes its core identity as a **Hex Map Previewer** where `TerrainMap` constitutes the canonical persistent map data and `HexAssetMap` is a preview-time derived visual state.

Principles & Invariants:
1. **Canonical Input vs. Derived Visuals**: `TerrainMap` (mapping cells to `TerrainId`) is the canonical persistent input data. `HexAssetMap` (mapping cells to `AssetId`) and `Viewport` camera transforms are runtime-derived states. `assetMap` and `viewport` are strictly never persisted in map JSON.
2. **Dual Equal Input Modes**: Maps originate equally from either `BuiltInGenerationSource` (procedural noise) or `JsonMapSource` (JSON map documents). Both converge into the identical downstream asset selection and preview rendering pipelines.
3. **Generation Seed vs. Preview Asset Seed Decoupling**: Procedural generation seed (`seed`) is strictly decoupled from visual asset assignment seed (`previewAssetSeed`). Built-in generation derives `previewAssetSeed = deriveAssetSeed(seed)`. JSON input uses an independent `previewAssetSeed` (defaulting deterministically to `12345` or specified explicitly), allowing visual asset rerolling on JSON maps without mutating `TerrainMap`.
4. **Provenance Metadata vs. Regeneration Instruction**: The `generation` block in map JSON is purely descriptive metadata recording the origin of the map. It is never treated as a regeneration command; loading JSON maps never invokes `TerrainGenerator`.
5. **Missing Asset Fallback**: A missing or unmapped `TerrainAsset` in the registry is not an application error. The preview pipeline gracefully produces fallback rendering (terrain-specific fill and label) while maintaining status `"ready"`. Actual asset loading failures (network/decoding errors) remain isolated and reported as errors.
6. **Generator Decoupling**: Map JSON parsing is completely independent from procedural generation algorithms, ensuring future algorithm changes do not break external map files.

---

## ADR-027: Input Validation Contract & Unknown Terrain Distinction

The application enforces a strict distinction between semantic map validity and visual asset availability, while guaranteeing transactional state isolation on input errors.

Principles & Invariants:
1. **Unknown TerrainId vs. Missing Asset**:
   - **Unknown Terrain**: Any `terrainId` in map JSON not present in `TerrainRegistry` constitutes an **Invalid Input** (schema/domain violation). Deserialization strictly rejects it with an error (`Unknown terrainId: "..."`), setting status to `"error"`.
   - **Missing Asset**: Any `terrainId` present in `TerrainRegistry` but lacking visual assets in `TerrainAssetRegistry` is **Valid Input**. It produces a non-error Fallback preview (base terrain color and label) with status `"ready"`.
2. **Transactional Safety on Input Failures**:
   - If JSON parsing, schema validation, coordinate uniqueness, or terrain registry checks fail, the previous valid map state (`terrainMap`, `assetMap`, stamps, fallbacks) is completely retained without clearing or corrupting the view.
3. **Dedicated Preview Asset Seed Controls**:
   - Preview asset seed manipulation and rerolling (`rerollAssets()`) recalculate `HexAssetMap` without altering or re-generating `TerrainMap`.

---

## ADR-028: Unified Artist Asset Input Pipeline & Runtime Registration

The application provides a unified artist workflow for importing custom PNG stamp assets via File Picker and Drag & Drop.

Principles & Invariants:
1. **Shared Registration Pipeline**: File Picker and Drag & Drop entry points share the exact same `AssetFileValidator` and registration workflow.
2. **File & Domain Boundary**: Browser-specific objects (`File`, `Blob`, `DragEvent`, `createObjectURL`) are strictly confined to the UI and Infrastructure layers. Domain entities (`TerrainAsset`, `TerrainAssetRegistry`) receive only pure primitive `source: string` references.
3. **Terrain Validation & Weight Semantics**: Imported assets must be mapped to known terrains from `TerrainRegistry`. Selection weights must be finite and `>= 0` (default `1.0`). `weight = 0` is valid (registered but excluded from random sampling).
4. **Asset Registration ≠ Terrain Generation**: Registering an asset updates `TerrainAssetRegistry` and re-evaluates visual stamp assignments with the current `previewAssetSeed` without altering `TerrainMap` or re-running `TerrainGenerator`.
5. **Transactional Registration Isolation**: If asset decoding/loading throws during registration, the newly registered asset is rolled back from `TerrainAssetRegistry` and the existing preview map is preserved.

---

## ADR-029: Artist-facing Visual Variant Naming & Presentation Decoupling

The application decouples internal asset identifiers (`AssetId`) from artist-facing visual variant presentation (`TerrainAsset.name`).

Principles & Invariants:
1. **Visual Variants vs Semantic Terrains**: Multiple stamp assets belonging to the same `TerrainId` represent visual variants (e.g. `Forest 1`, `Forest 2`, `Forest 3`), providing visual diversity without semantic differences.
2. **Internal Identity vs Display Identity**:
   - `AssetId`: Internal unique identity used by the engine, registry, and `WeightedAssetSelector`.
   - `TerrainAsset.name`: Artist-facing Display Name (e.g. `Forest 1`, `Forest 2`), shown in Hover information and UI controls.
3. **Max + 1 Variant Numbering**: New variants registered under a `TerrainId` are assigned `max(existing variant numbers) + 1` to prevent ID reuse even when gaps exist.
4. **Weighted Selection Agnosticism**: Selection algorithms operate solely on `AssetId` and `weight`, completely agnostic to variant display naming.
5. **Presentation Polish**: Wheel zoom sensitivity is set to `1.06` for smooth control, fallback label font sizes are scaled to fit comfortably inside cells, and reroll button tooltips clarify behavior.

---

## ADR-030: Minimal Asset Library & Live Weight Editing

The application provides a dedicated, lightweight Asset Library panel to inspect registered visual variants grouped by terrain category, view image thumbnails, and adjust selection weights.

Principles & Invariants:
1. **Minimal Inspector Scope**: The Asset Library is strictly an inspection and weight-tuning tool. It does not include management operations such as delete, rename, replace, folder hierarchies, or persistent asset libraries.
2. **Domain Encapsulation for Weight Updates**: `TerrainAssetRegistry.updateWeight` strictly validates finite non-negative values (`weight >= 0`). `weight = 0` is valid and denotes disabling the variant from random sampling.
3. **Map & Seed Invariance on Weight Changes**: Updating an asset's weight re-evaluates `WeightedAssetSelector.selectForMap` with the current `previewAssetSeed` without altering `TerrainMap`, `seed`, `scale`, or `previewAssetSeed`, and without invoking `TerrainGenerator.generate()`.
4. **Thumbnail Error Isolation**: Failure to load or render an image thumbnail in the Asset Library falls back to `"Preview unavailable"` and never propagates into an editor error state or corrupts the main canvas preview.
5. **Clear Empty State**: When no assets are registered, a helpful empty state guide is rendered instead of an empty or broken list.

---

## ADR-031: M09 Preview Quality, Large Map Scalability & Conditional Refinement Trigger

Milestone M09 is formally scoped as "Preview Quality & Artist Workflow", prioritizing procedural generation preview and validation.

Principles & Invariants:
1. **Random Generation First, Manual Refinement Later**: Procedural generation and JSON input remain the primary sources of map terrain. The previewer is complete when artists can reliably evaluate modular stamp assets on large continuous maps.
2. **Large Map Scalability**: The procedural pipeline, spatial classification, and viewport transforms maintain sub-second performance across large map bounds (e.g. 25x25 = 625 hexes, 50x50 = 2500 hexes) without requiring additional rendering complexity.
3. **Multi-Variant Balance**: Visual variants under identical `TerrainId` distribute naturally according to relative weights, while `weight = 0` variants are strictly excluded from random sampling.
4. **Conditional Trigger for Manual Refinement**: Manual cell painting (Brush / Eraser / History Stack) is designated as a conditional future refinement feature, to be implemented only if actual artist testing reveals that random generation cannot adequately produce required test arrangements.







