# UI Specification - Hex Terrain Preview

## Layout Wireframe

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Toolbar: [New] [Open] [Save] | [Undo] [Redo] | [Gen Terrain] [Reroll Assets]│
├───────────────────┬───────────────────────────────────┬─────────────────────┤
│ Left Panel        │ Center Viewport                   │ Right Panel         │
│ ───────────────── │ ───────────────────────────────── │ ─────────────────── │
│ Map Settings:     │                                   │ Terrain Library:    │
│ - Cols / Rows     │           Canvas 2D               │ - Terrain List      │
│ - Hex Width/Height│       (Interactive Viewport)      │ - Add / Edit Terrain│
│                   │                                   │                     │
│ Generation Config:│   - Flat-top Hex Grid Overlay     │ Asset Library:      │
│ - Seed Input      │   - Terrain Stamp Layers          │ - Asset List        │
│ - Biome Scale     │   - Hover Hex Indicator           │ - Weights           │
│ - Terrain Weights │   - Zoom / Pan controls           │ - Import PNG        │
│                   │                                   │                     │
│                   │                                   │ Brush Tool:         │
│                   │                                   │ - Active Terrain    │
│                   │                                   │ - Brush Size        │
├───────────────────┴───────────────────────────────────┴─────────────────────┤
│ Status Bar: Cursor Coords (q,r) | Zoom Level | Hex Count | Active Seed      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Interactions

1. **Map Generation**:
   - Click `Generate Terrain`: evaluates procedural noise and fills `TerrainMap`, then populates `AssetMap`.
   - Click `Re-roll Assets`: re-samples assets using the secondary seed without touching `TerrainMap`.

2. **Manual Painting**:
   - Select terrain type from right panel.
   - Left-click / Drag on canvas to paint hex cells.

3. **History Operations**:
   - `Undo` (Ctrl/Cmd+Z) / `Redo` (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y): reverts/re-applies terrain & asset snapshot changes.

4. **Viewport Controls**:
   - Mouse wheel: Zoom in/out anchored at cursor.
   - Middle click / Right click / Space+Left click drag: Pan canvas.

5. **Project IO**:
   - Save / Load project JSON packages with asset bundles via native dialogs.
