# Product Specification - Hex Terrain Preview

## Target User

Game Artists and Level Designers.

## Problem Statement

Artists need a dedicated, lightweight preview tool to visualize how modular PNG terrain stamp assets look when distributed across large hexagonal maps before integrating them into actual game engines.

## MVP Goal

Generate a spatially continuous hex terrain map and visualize uploaded PNG assets on a flat-top hex grid.

## Core Features

- **Hex Map Grid**: Flat-top orientation, configurable map width and height (column/row).
- **Hex Geometry**: Independently configurable hex width and height (non-regular hex support).
- **Terrain Definitions**: Define terrain types (e.g., Grass, Mountain, Water, Sand) with custom identifiers and display names.
- **PNG Asset Import**: Import 2D PNG terrain stamps.
- **Weighted Assets**: Assign multiple assets per terrain type with configurable probability weights.
- **Seeded Generation**: Deterministic procedural terrain generation using low-frequency noise.
- **Continuous Terrain**: Spatially continuous terrain biomes with adjustable size and ratio controls.
- **Asset Placement**: Deterministic asset selection decoupled from terrain logic.
- **Re-roll Assets**: Re-sample asset variations without modifying the underlying terrain layout.
- **Manual Brush**: Paint tool to directly modify hex terrain types.
- **Undo / Redo**: Snapshot-based history for terrain and asset modifications.
- **Interactive Canvas**: Smooth zoom and pan navigation across the canvas.
- **Project Persistence**: Save and load self-contained JSON project packages with bundled assets.
- **Standalone Desktop App**: Tauri-powered desktop application wrapper.
