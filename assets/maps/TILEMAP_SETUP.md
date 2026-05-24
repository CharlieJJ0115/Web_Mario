# TileMap setup

Use `level_1.tmx` as the first playable map.

## Tiled settings

- Map: orthogonal, finite map
- Tile size: `16 x 16`
- Tileset image: `../AS2_source/effects_UI_tiles/tiles.png`
- Required layers:
  - `terrain`: visible ground/platform tiles
  - `solid`: collision mask; any non-empty tile becomes a static collider
  - `objects`: spawn points and later enemies/items

## Required object

Add one point object in `objects`:

- Name: `player_spawn`
- Type: `spawn` is optional for your own organization; the loader uses the object name because Cocos keeps object shape type separately.
- Position: above the floor, for example `x=64`, `y=256`

## Cocos Creator scene wiring

1. Import `assets/maps/level_1.tmx`.
2. Add a `TiledMap` node to `scene-2d` and assign `level_1.tmx`.
3. Add an empty node named `LevelRoot`.
4. Add `TileMapLevelLoader` to a scene node, then assign:
   - `Tiled Map`: the `TiledMap` component
   - `Level Root`: `LevelRoot`
   - `Player Sprite`: one frame from `mario_small`
   - `Player Prefab`: optional; if you create `assets/prefabs/Player.prefab`, assign it here
   - `Camera`: the scene camera
   - `Follow Camera`: checked
   - `Follow X`: checked
   - `Follow Y`: unchecked for the first version
   - `Camera Offset`: `(0, 80)`
   - `Use Tmx Spawn Position`: unchecked while debugging editor-visible Player
   - `Spawn Lift`: `24`
   - `Show Player Debug Marker`: checked while debugging
5. Press Play. The loader enables 2D physics, creates solid colliders from the `solid` layer, and spawns the player at `player_spawn`.
6. Click the Preview/Game view once before pressing WASD so the browser/canvas has keyboard focus.

For editor-visible Player setup, create a node named `Player` under `Canvas/LevelRoot` with `UITransform`, `Sprite`, and optionally `PlayerController`. The loader uses this existing node before trying `Player Prefab` or dynamic fallback. Keep `PlayerController.Enable Physics` unchecked until basic WASD movement is visible.

If the player is not visible, open Console and check the `[TileMapLevelLoader] Spawned Player` log. Confirm the `mapBottomLeft` and final player `world` position look close to the visible floor. If `sprite=missing-fallback`, assign a Mario frame to `Player Sprite`; the red debug marker should still be visible while debugging.
