# TileMap setup

Use `level_1V1.tmx` as the current first playable map.

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

1. Import `assets/maps/level_1V1.tmx`.
2. Add a `TiledMap` node to `scene-2d` and assign `level_1V1.tmx`.
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
5. Create or select `Canvas/LevelRoot/Player`, then add fixed player components:
   - `RigidBody2D`: Type `Dynamic`, Fixed Rotation checked, Gravity Scale `1`
   - `BoxCollider2D`: Size `28 x 30`, Offset `0 x 15`
   - `PlayerController`: Movement Mode `kinematic`
   - Keep `Player` Mobility set to `Movable`
6. Press Play. The loader enables 2D physics, creates solid colliders from the `solid` layer, and uses the existing `Player` node.
7. Click the Preview/Game view once before pressing WASD so the browser/canvas has keyboard focus.

For editor-visible Player setup, create a node named `Player` under `Canvas/LevelRoot`. The root should own `RigidBody2D`, `BoxCollider2D`, and `PlayerController`; `Player/Visual` should own the Mario `Sprite`. The loader uses this existing node before trying `Player Prefab` or dynamic fallback.

If the player is not visible, open Console and check the `[TileMapLevelLoader] Spawned Player` log. Confirm the `mapBottomLeft` and final player `world` position look close to the visible floor. If `sprite=missing-fallback`, assign a Mario frame to `Player Sprite`; the red debug marker should still be visible while debugging.
