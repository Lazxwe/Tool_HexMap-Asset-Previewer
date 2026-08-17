# Hex Terrain Preview - Agent Instructions

## Project

Hex Terrain Preview is a desktop map preview tool for artists.

The application allows artists to:

- Define hex-based maps.
- Define terrain types.
- Import PNG terrain stamp assets.
- Assign weighted assets to terrain types.
- Generate spatially continuous terrain using seeded noise.
- Manually paint terrain.
- Preview the resulting map.
- Save and reopen projects.

## Technology

- TypeScript
- Vite
- HTML
- CSS
- Canvas 2D
- Tauri
- Vitest

Do not introduce other major frameworks unless explicitly approved.

Do not introduce:

- Unity
- Godot
- Electron
- React
- Vue
- Three.js
- WebGL
- Backend services
- Database

## Architecture Rules

The application is divided into:

1. Domain
2. Generator
3. Asset
4. Rendering
5. Editor
6. Project
7. UI
8. Tauri integration

Domain code must not depend on UI, Canvas, or Tauri.

Terrain generation must not depend on rendering.

Rendering must not modify terrain data.

Tauri integration must remain at the application boundary.

## Important Concepts

Terrain data and visual assets are separate.

A hex stores:

    TerrainId

The renderer resolves:

    TerrainId -> AssetId -> PNG

PNG files are terrain stamps, not tile textures.

PNG assets must not be assumed to fit exactly inside a hex.

Assets are normally rendered without clipping to the hex boundary.

## Randomness

Terrain generation and asset selection must use deterministic seeded random streams.

They must use independent random streams.

Re-rolling assets must not change TerrainMap.

## Project Files

Projects must be self-contained.

Assets imported into a project should be copied into the project asset directory.

Project references should use relative paths.

## Testing

Every implementation task must:

1. Run type checking.
2. Run unit tests.
3. Run production build.

Do not modify tests merely to hide implementation failures.

## Scope

Do not implement features outside the current task.

If a requirement is ambiguous or conflicts with existing architecture:

STOP and report the issue instead of guessing.

## Completion Report

After each task, report:

- Summary
- Changed files
- Tests
- Build result
- Known issues
- Design questions
