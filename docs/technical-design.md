# Technical Design - Hex Terrain Preview

## Architectural Pipeline

```text
UI
 ↓
Editor State
 ↓
Domain
 ├── Hex
 ├── Terrain
 └── Map
 ↓
Generator
 ↓
TerrainMap
 ↓
Asset Resolver
 ↓
AssetMap
 ↓
Renderer
 ↓
Canvas
```

## Layer Responsibilities

1. **Domain**:
   - Pure business logic & data models.
   - Flat-top axial/offset coordinate calculations, hex metrics, terrain definitions.
   - Strictly zero dependencies on UI, Canvas 2D, or Tauri APIs.

2. **Generator**:
   - Procedural terrain generation based on deterministic seeded pseudo-random noise fields (e.g. Perlin / Simplex noise).
   - Produces `TerrainMap` (mapping hex coordinates to `TerrainId`).

3. **Asset Resolver**:
   - Maps `TerrainId` to specific `AssetId` using weighted random selection.
   - Operates with an independent deterministic random stream.
   - Produces `AssetMap` (mapping hex coordinates to `AssetId`).

4. **Renderer**:
   - HTML Canvas 2D rendering engine.
   - Renders grid lines, coordinate labels (optional debug), and resolves `AssetId -> ImageBitmap/HTMLImageElement`.
   - Draws visual stamps centered at hex positions without boundary clipping.
   - Handles viewport transform (zoom & pan).
   - Strictly read-only relative to domain data.

5. **Editor**:
   - Encapsulates edit operations: brush painting, generator invocation, asset re-roll.
   - Manages snapshot-based undo/redo history stacks for `TerrainMap` and `AssetMap`.

6. **Project Manager**:
   - Serialization and deserialization of `.hexproj` JSON files with schema versioning.
   - Bundles/copies imported PNG assets to the local project asset directory.

7. **UI**:
   - Vanilla TypeScript + DOM / CSS components.
   - Panels: Toolbar, Map/Generation Settings, Terrain/Asset Library, Brush Controls, Status Bar.

8. **Tauri Integration**:
   - Desktop host boundary: native file dialogs (Save Project, Open Project, Import Asset), window controls, filesystem IO.

---

## Hex Coordinate & Geometry Specification (Task 002)

- **Orientation**: Flat-top hexagons.
- **Offset Convention**: `odd-q` (Odd columns are shifted downwards by `0.5 * hexHeight`).
- **Independent Dimensions**: `hexWidth` ($W$) and `hexHeight` ($H$) are independent positive values (non-regular hex support).
- **Public Coordinate System**: Offset coordinates $(col, row)$ via immutable `HexCoordinate`.
- **Pixel Center Formula**:
  - $cx = (col \times 0.75 + 0.5) \times W$
  - $cy = (row + 0.5 + (col \pmod 2 \neq 0 ? 0.5 : 0)) \times H$
- **Polygon Vertices**: 6 vertices ordered clockwise starting from East tip $(cx + W/2, cy)$. Top and bottom edges are strictly horizontal.
- **Neighbor Ordering**: Deterministic clockwise order from Northeast [NE, SE, S, SW, NW, N].
- **Geometric Picking (`pixelToHex`)**: Direct polygon-consistent half-plane metric:
  $$\text{metric}(u, v) = \max(2|u| + |v|, 2|v|) \quad \text{where } u = \frac{px - cx}{W}, v = \frac{py - cy}{H}$$
  - $\text{metric} < 1$: Point is strictly inside the hex polygon.
  - $\text{metric} = 1$: Point is exactly on the hex polygon boundary.
- **Deterministic Boundary Ownership Rule**:
  - When a point lies on the shared boundary of adjacent hexes ($\text{metric} = 1$), tie-breaking deterministically selects the candidate with the smallest column (`col`), and if columns are equal, the smallest row (`row`).

---

## Rendering Architecture & Viewport Specification (Task 003)

### 1. Coordinate Pipelines

The rendering system decouples spatial spaces into three distinct domains:

```text
Map Data (HexCoordinate: col, row)
      │
      ▼  (HexGeometry.hexToPixel)
World Space (wx, wy: pure continuous domain coordinates)
      │
      ▼  (Viewport: screen = world * zoom + pan)
Screen Space (sx, sy: logical CSS pixel coordinates relative to canvas)
      │
      ▼  (High-DPI: backing = screen * devicePixelRatio)
Backing Store (px, py: physical canvas pixel buffer)
```

### 2. Viewport Transformation Mathematics

- **Forward Transformation (`worldToScreen`)**:
  $$sx = wx \cdot \text{zoom} + \text{panX}$$
  $$sy = wy \cdot \text{zoom} + \text{panY}$$

- **Inverse Transformation (`screenToWorld`)**:
  $$wx = \frac{sx - \text{panX}}{\text{zoom}}$$
  $$wy = \frac{sy - \text{panY}}{\text{zoom}}$$

### 3. Zoom Around Screen Anchor Mechanics

To prevent the map from slipping underneath the mouse pointer during zooming:
1. Determine the World Point under the screen anchor $S = (sx, sy)$ before zoom:
   $$W_{\text{anchor}} = \frac{S - \text{pan}_{\text{old}}}{\text{zoom}_{\text{old}}}$$
2. Compute clamped target zoom $\text{zoom}_{\text{new}} \in [\text{minZoom}, \text{maxZoom}]$.
3. Solve for new pan offsets that keep $W_{\text{anchor}}$ invariant at the screen anchor $S$:
   $$\text{panX}_{\text{new}} = sx - W_{\text{anchor}, x} \cdot \text{zoom}_{\text{new}}$$
   $$\text{panY}_{\text{new}} = sy - W_{\text{anchor}, y} \cdot \text{zoom}_{\text{new}}$$

### 4. High-DPI (Retina) & Resize Strategy

- Backing-store dimensions are allocated as $\text{width} \times \text{dpr}$ and $\text{height} \times \text{dpr}$.
- Canvas 2D context is scaled by $\text{dpr}$ prior to viewport matrix transforms, ensuring domain world geometry remains completely agnostic of display pixel densities.
- Canvas resizing adjusts buffer dimensions without mutating or recreating domain grid data.

---

## Terrain Domain Specification (Task 004 / 004-R1)

### 1. Architectural Separation: Definitions vs. Assets vs. Cell Assignments

Terrain categories, visual assets, and map cell spatial assignments are strictly decoupled:

```text
TerrainDefinition (id: TerrainId, displayName: string)
      │
      │ 1 : N
      ▼
TerrainAsset (id: AssetId, terrainId: TerrainId, source: string, weight: number)
      │
      ▼  (Weighted Asset Selection per TerrainId)
AssetMap (HexCoordinate -> AssetId)

HexCoordinate (col, row) ─────────┐
                                  ▼
TerrainMap (owns spatial assignments: HexCoordinate -> TerrainId)
```

- **`TerrainId`**: Immutable value object uniquely identifying a semantic terrain category (e.g. `"forest"`, `"grass"`).
- **`TerrainDefinition`**: Immutable descriptor containing only semantic categorization (`id`, `displayName`). Weight does NOT belong here.
- **`TerrainAsset`** (M05 / Task 005): Individual visual stamp belonging to a terrain category. Owns its own selection `weight` ($\ge 0$).
- **`TerrainRegistry`**: Manages the available catalog of terrain definitions. Enforces ID uniqueness.
- **`TerrainMap`**: Maps `HexCoordinate` to `TerrainId` references (never directly storing `TerrainDefinition` or `TerrainAsset` objects). Unassigned cells naturally represent empty terrain slots.

---

## Asset Domain Specification (Task 005)

### 1. Structure & Model

The Asset Domain models visual stamp metadata independently from image loading and binary parsing:

```text
TerrainAssetRegistry
      │
      ├── Forest Assets:
      │    ├── forest_01.png (weight = 5)
      │    ├── forest_02.png (weight = 3)
      │    └── forest_03.png (weight = 1)
      │
      └── Mountain Assets:
           ├── mountain_01.png (weight = 4)
           └── mountain_02.png (weight = 2)
```

- **`AssetId`**: Immutable value object uniquely identifying a visual stamp asset.
- **`TerrainAsset`**: Immutable descriptor containing `id: AssetId`, `terrainId: TerrainId`, `name: string`, `source: string`, and `weight: number`.
  - `source`: Relative file path or project resource string (pure primitive string, zero browser/DOM dependency).
  - `weight`: Selection probability weight ($\ge 0$, finite). Weights are non-normalized relative ratios (e.g. weights $5, 3, 1$ give probabilities $\frac{5}{9}, \frac{3}{9}, \frac{1}{9}$).
- **`TerrainAssetRegistry`**: Manages the catalog of registered `TerrainAsset` instances. Supports fast queries by `AssetId` and category queries by `TerrainId` (`getByTerrain`).

---

## Asset Loading Infrastructure Specification (Task 006)

### 1. Architecture & Dependency Flow

The Infrastructure Asset Loading layer bridges abstract domain resource references (`TerrainAsset.source`) to decoded canvas-renderable images (`RenderableImage`):

```text
Domain:
TerrainAsset (id: AssetId, source: "assets/forest_01.png")
      │
      ▼
Infrastructure:
IAssetLoader (AssetLoader)
      ├── Cache (Map<AssetId, LoadedAsset>)
      └── InFlight Deduplication (Map<AssetId, Promise<LoadedAsset>>)
            │
            ▼
ImageDecoder (Strategy)
      ├── BrowserImageDecoder (HTMLImageElement / createImageBitmap)
      └── MockImageDecoder (Unit test fake / headless environment)
            │
            ▼
Output:
LoadedAsset (assetId: AssetId, source: string, image: RenderableImage)
```

- **`RenderableImage`**: Uniform interface wrapping canvas-renderable bitmap resources (`width`, `height`, `nativeSource`).
- **`LoadedAsset`**: Immutable container bundling `AssetId`, original `source`, and decoded `RenderableImage`.
- **`ImageDecoder`**: Pluggable decoding strategy allowing seamless switching between browser DOM APIs, headless test mocks, and future desktop native IPC loaders.
- **`AssetLoader`**: In-memory caching and concurrent request deduplication service.

---

## Terrain Stamp Rendering Specification (Task 007)

### 1. Rendering Pipeline & Layer Architecture

Terrain stamps are rendered as aspect-ratio-preserving, hex-clipped visual stamps underneath grid outlines and coordinate overlays:

```text
Rendering Layer Stack (Bottom to Top):
1. Clear Background (CanvasRenderer.clear)
2. Viewport Transform (ctx.translate(panX, panY), ctx.scale(zoom, zoom))
3. Terrain Stamp Layer (TerrainStampRenderer.renderStamps - Hex-clipped drawImage)
4. Hex Grid Outlines (Polygons & Stroke lines)
5. Hover / Selection Highlight
6. Debug Coordinate Labels (ctx.fillText)
```

### 2. Hex Clipping Strategy

Every terrain stamp is strictly bounded within its Hex polygon geometry using canvas context clipping:

```text
ctx.save()
  -> ctx.beginPath()
  -> Traverse 6 polygon vertices from HexGeometry.getHexPolygon(coord)
  -> ctx.closePath()
  -> ctx.clip()
  -> ctx.drawImage(image.nativeSource, drawX, drawY, drawW, drawH)
ctx.restore()
```

- **Neighbor Protection**: Guarantees visual stamps never bleed into neighboring hex cells.
- **State Isolation**: `save()` and `restore()` wrap every stamp draw call to prevent clipping paths, transforms, or alpha states from leaking.

### 3. Aspect Ratio & Cover Scaling Strategy

- **Placement**: Image center is aligned with the Hex center $(cx, cy)$ computed from `HexGeometry.hexToPixel(coord)`.
- **Scaling (`cover`)**:
  $$\text{scale} = \max\left(\frac{\text{hexWidth}}{\text{imgWidth}}, \frac{\text{hexHeight}}{\text{imgHeight}}\right)$$
  $$\text{drawWidth} = \text{imgWidth} \times \text{scale}, \quad \text{drawHeight} = \text{imgHeight} \times \text{scale}$$
  $$\text{drawX} = cx - \frac{\text{drawWidth}}{2}, \quad \text{drawY} = cy - \frac{\text{drawHeight}}{2}$$
- **Zero Distortion**: The image maintains its original aspect ratio regardless of hex aspect ratio, with excess areas clipped away by the polygon boundary.
- **World Space Invariance**: Stamp dimensions and placement are computed in World Space coordinates, naturally scaling and panning with the `Viewport` transform without duplicating transform math.

---

## Terrain Generation Specification (Task 008)

### 1. Procedural Generation Pipeline

Terrain generation produces a spatially coherent `TerrainMap` by mapping continuous 2D seeded noise fields through discrete classification thresholds:

```text
HexCoordinate (col, row)
      │
      ▼
HexGeometry.hexToPixel(coord) -> Continuous World Point (x, y)
      │
      ▼
Spatial Frequency Scaling: (sampleX, sampleY) = (x / scale, y / scale)
      │
      ▼
Deterministic SeededNoiseField.sample(sampleX, sampleY) -> Scalar [0, 1]
      │
      ▼
TerrainClassifier.classify(scalarValue) -> TerrainId
      │
      ▼
TerrainMap.set(coord, terrainId)
```

### 2. Smooth 2D Value Noise Algorithm

`SeededNoiseField` computes continuous $C^2$ value noise:
1. **Lattice Integer Coordinates**: $(x_0, y_0) = (\lfloor x \rfloor, \lfloor y \rfloor)$, $(x_1, y_1) = (x_0 + 1, y_0 + 1)$.
2. **Fractional Offsets**: $fx = x - x_0, fy = y - y_0$.
3. **Smooth Quintic Interpolation**:
   $$u = 6fx^5 - 15fx^4 + 10fx^3$$
   $$v = 6fy^5 - 15fy^4 + 10fy^3$$
4. **Deterministic Pseudorandom 32-bit Hash Mixer**: Computes uniform random float in $[0, 1]$ for each lattice corner using bitwise multiplication and XOR mixing with the seed.
5. **Bilinear Interpolation**: Interpolates the 4 corner values using weights $(u, v)$ to produce a smooth, continuous scalar value guaranteed in $[0, 1]$.

### 3. Classification Model

`TerrainClassifier` maps the normalized scalar $[0, 1]$ to discrete `TerrainId` categories using ordered threshold boundaries (`value <= threshold.max`).
- Full coverage of $[0, 1]$ is strictly enforced at initialization.
- Non-increasing or out-of-range thresholds are rejected immediately.

---

## Weighted Asset Selection Specification (Task 009)

### 1. Selection Architecture & Separation of Concerns

The Selection service resolves `TerrainId` categories into concrete visual `AssetId` references using proportional random sampling:

```text
TerrainMap (HexCoordinate -> TerrainId)
      │
      ▼
WeightedAssetSelector
      ├── TerrainAssetRegistry (queries available TerrainAsset[] for TerrainId)
      └── RandomSource (injected deterministic RNG: SeededRandomSource)
            │
            ▼
HexAssetMap (HexCoordinate -> AssetId)
```

### 2. Domain Concept Decoupling

- **`TerrainId` vs `AssetId`**: `TerrainId` represents a semantic terrain type (e.g. `"forest"`), whereas `AssetId` represents a specific visual PNG stamp (e.g. `"forest_01"`).
- **`TerrainMap` vs `HexAssetMap`**: `TerrainMap` tracks spatial classification data, while `HexAssetMap` tracks visual stamp assignment data.
- **`TerrainAsset.weight`**: Represents relative selection probability within a terrain category (e.g. weights $5, 3, 1 \to \frac{5}{9}, \frac{3}{9}, \frac{1}{9}$), strictly decoupled from spatial terrain generation ratios.

### 3. Selection Algorithm & RNG Consumption

- **Cumulative Weight Sampling**: Computes $\text{target} = r \times \text{totalWeight}$ where $r \in [0, 1)$ from `RandomSource.next()`, selecting the first asset where $\text{cumulative} > \text{target}$.
- **Zero Weight**: Assets with `weight === 0` are never selected by random sampling. If all assets for a terrain have `weight <= 0`, selection throws an error.
- **Strict Invariant**: Every assigned cell in `TerrainMap` consumes exactly one random value from `RandomSource`, ensuring deterministic reproducibility.

---

## Editor Core & UI Application Assembly Specification (Task 010)

### 1. Application Architecture

```text
                  EditorUI (DOM / Canvas Event Binder)
                               │ user actions / intent
                               ▼
                  EditorCore (Application Orchestrator)
                  ├── EditorState (Single Immutable State Model)
                  ├── Viewport (Zoom / Pan / Center)
                  ├── State Subscriptions
                  └── Generation Pipeline Coordinator
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
  TerrainGenerator    WeightedAssetSelector     AssetLoader
         │                     │                     │
         ▼                     ▼                     ▼
    TerrainMap            HexAssetMap           LoadedAsset
         └─────────────────────┬─────────────────────┘
                               ▼
                     HexStampEntry[]
                               ▼
                     CanvasRenderer
```

### 2. State Model (`EditorState`)

`EditorState` provides an immutable snapshot of editor data:
- `seed: number`: Random seed for procedural generation.
- `scale: number`: Spatial noise frequency scale.
- `bounds: HexBounds`: Inclusive generation bounding box.
- `terrainMap: TerrainMap`: Spatial map mapping cells to `TerrainId`.
- `assetMap: HexAssetMap`: Spatial map mapping cells to `AssetId`.
- `hoveredHex: HexCoordinate | null`: Currently highlighted hex cell.
- `zoom: number`, `panX: number`, `panY: number`: Viewport camera transforms.
- `status: "idle" | "generating" | "loading-assets" | "ready" | "error"`.
- `errorMessage?: string`: Failure message on error.

### 3. Transactional Generation Pipeline

1. **Status Transition**: State transitions to `"generating"`.
2. **Procedural Terrain Generation**: `TerrainGenerator.generate(bounds, { seed, scale })` produces new `TerrainMap`.
3. **Independent Asset PRNG**: Deterministically derives `assetSeed = deriveAssetSeed(seed)`.
4. **Weighted Asset Selection**: `WeightedAssetSelector.selectForMap(newTerrainMap)` produces new `HexAssetMap`.
5. **Status Transition**: State transitions to `"loading-assets"`.
6. **Asynchronous Deduplicated Loading**: Unique `AssetId`s are resolved via `TerrainAssetRegistry` and decoded via `AssetLoader.load()`.
7. **Transactional Commit**: Upon complete success, `terrainMap`, `assetMap`, and cached `HexStampEntry[]` are atomically committed with status `"ready"`.
8. **Failure Isolation**: If any step fails, the previous valid map is retained and state transitions to `"error"`.

---

## Preview Data Model & JSON Input Boundary (Task 012)

### 1. Dual Map Source Architecture

```text
                         ┌──────────────────────┐
                         │      Map Source       │
                         └──────────┬───────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     │                             │
                     ▼                             ▼
             Built-in Generator               JSON Input
                     │                             │
             TerrainGenerator                 JSON Parser
                     │                             │
                     └──────────────┬──────────────┘
                                    ▼
                               TerrainMap
                                    │
                                    ▼
                         WeightedAssetSelector
                                    │
                                    ▼
                               HexAssetMap
                                    │
                                    ▼
                             Preview Assembly
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
                   Asset exists          Asset missing
                         │                     │
                         ▼                     ▼
                   PNG / Stamp          Terrain fallback
```

### 2. Canonical vs. Derived State Boundaries

| Component / Property | Category | Persisted in JSON | Description |
| :--- | :--- | :---: | :--- |
| `formatVersion` | Meta | ✅ | Schema migration versioning (currently 1). |
| `bounds` | Geography | ✅ | Map bounding box coordinates. |
| `terrainMap` | Canonical Map Data | ✅ | Semantic `(col, row) -> TerrainId` classification. |
| `generation` | Metadata | Optional | Algorithm metadata (seed, scale) if generated. |
| `assetMap` | Derived Preview State | ❌ | Dynamically sampled from active `TerrainAssetRegistry`. |
| `fallbacks` | Derived Preview State | ❌ | Cells rendered with base color/labels when no asset exists. |
| `viewport` | UI Camera State | ❌ | Camera zoom/pan in preview viewport. |
| `status`, `errorMessage` | UI Runtime State | ❌ | Generation/loading/error indicators. |

### 3. Missing Asset Fallback Handling

When a cell has a `TerrainId` that does not resolve to any visual stamp assets in `TerrainAssetRegistry` (or all weights <= 0), the preview pipeline does **not** fail:
- Cell is collected into `HexFallbackEntry[]`.
- `CanvasRenderer` renders the hex polygon with a categorized terrain base fill color and white text label.
- Application status remains `"ready"`.

### 4. Seed Decoupling & Independent Preview Determinism

- **Generation Seed vs. Preview Asset Seed**: Procedural terrain generation (`seed`) is strictly decoupled from preview-time visual stamp selection (`previewAssetSeed`).
- **Built-in Source**: Derives an independent seed via `deriveAssetSeed(seed)`.
- **JSON Source**: Uses an independent `previewAssetSeed` (default `12345` or specified explicitly), guaranteeing deterministic visual stamp assignment across preview sessions.
- **Reroll Assets**: Visual stamp assignments can be re-randomized (`editor.rerollAssets(newSeed)`) without mutating or regenerating `TerrainMap`.
- **Provenance vs. Execution**: A JSON `generation` block is metadata only; loading a JSON map never calls `TerrainGenerator.generate()`.

### 5. Input Contract & Error UX (Task 013)

```text
                               Input Document
                                     │
                                     ▼
                            ProjectValidation
                                     │
                      ┌──────────────┴──────────────┐
                      ▼                             ▼
              Unknown TerrainId             Known TerrainId
                      │                             │
                      ▼                             ▼
                INVALID INPUT               Valid TerrainMap
             (status = "error")                     │
         (preserves previous map)                   ▼
                                          WeightedAssetSelector
                                                    │
                                     ┌──────────────┴──────────────┐
                                     ▼                             ▼
                               Missing Asset                 Asset Found
                                     │                             │
                                     ▼                             ▼
                              Fallback Preview                Stamp Asset
                             (status = "ready")            (status = "ready")
```

- **Validation Rules**: Every `terrainId` must exist in `TerrainRegistry`. Unknown IDs are rejected before state commit.
- **Transactional Error Handling**: On parse/validation failure, previous `TerrainMap`, `HexAssetMap`, and render stamps are retained; UI displays the specific error and highlights the status cell.

### 6. Artist Asset Input Workflow (Task 014)

```text
               Artist
                 │
        ┌────────┴────────┐
        ▼                 ▼
    File Picker       Drag & Drop
        │                 │
        └────────┬────────┘
                 ▼
         AssetFileValidator
                 │
                 ▼
        Registration Dialog
      (TerrainId from TerrainRegistry, Weight >= 0)
                 │
                 ▼
       generateUniqueAssetId()
                 │
                 ▼
           TerrainAsset
                 │
                 ▼
       EditorCore.registerAsset()
                 │
                 ▼
       TerrainAssetRegistry
                 │
                 ▼
       WeightedAssetSelector
                 │
                 ▼
            HexAssetMap
                 │
                 ▼
              Preview
```

- **File & Domain Boundary**: `File` and `createObjectURL` are strictly isolated in UI / Infrastructure. `TerrainAsset.source` remains `string`.
- **Terrain Validation**: Registration requires valid `TerrainId` from `TerrainRegistry`.
- **Weight Semantics**: Supports finite `weight >= 0`. `weight = 0` assets exist in registry but are skipped in weighted random sampling.
- **Transactional Isolation**: If loading fails, registry entry is rolled back without corrupting `TerrainMap` or active preview.





