import {
    _decorator,
    BoxCollider2D,
    Camera,
    Component,
    ERigidBody2DType,
    Node,
    PhysicsSystem2D,
    RigidBody2D,
    Color,
    Graphics,
    instantiate,
    Prefab,
    Size,
    Sprite,
    SpriteFrame,
    TiledLayer,
    TiledMap,
    UITransform,
    Vec2,
    Vec3,
} from 'cc';
import { PlayerController } from './PlayerController';

const { ccclass, property } = _decorator;

type TiledObject = {
    name?: string;
    type?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
};

@ccclass('TileMapLevelLoader')
export class TileMapLevelLoader extends Component {
    @property(TiledMap)
    public tiledMap: TiledMap | null = null;

    @property(Node)
    public levelRoot: Node | null = null;

    @property(SpriteFrame)
    public playerSprite: SpriteFrame | null = null;

    @property(Prefab)
    public playerPrefab: Prefab | null = null;

    @property(Camera)
    public camera: Camera | null = null;

    @property
    public solidLayerName = 'solid';

    @property
    public objectLayerName = 'objects';

    @property
    public existingPlayerName = 'Player';

    @property
    public playerVisualName = 'Visual';

    @property
    public useTmxSpawnPosition = false;

    @property
    public spawnObjectName = 'player_spawn';

    @property
    public gravityY = -960;

    @property
    public followCamera = true;

    @property
    public followX = true;

    @property
    public followY = false;

    @property(Vec2)
    public cameraOffset = new Vec2(0, 80);

    @property
    public spawnLift = 24;

    @property
    public showPlayerDebugMarker = false;

    @property
    public showSolidColliderDebug = false;

    @property
    public hideSolidLayerOnStart = true;

    @property
    public createDebugGround = false;

    @property(Vec2)
    public debugGroundSize = new Vec2(320, 16);

    @property
    public debugGroundOffsetY = -8;

    private player: Node | null = null;
    private mapPixelSize = new Vec2();
    private warnedMissingFollowTarget = false;

    protected start(): void {
        this.setupPhysics();
        this.resolveSceneReferences();
        this.buildSolidColliders();
        this.spawnPlayer();
    }

    protected lateUpdate(): void {
        this.followPlayer();
    }

    private setupPhysics(): void {
        const physics = PhysicsSystem2D.instance;
        physics.enable = true;
        physics.gravity = new Vec2(0, this.gravityY);
    }

    private resolveSceneReferences(): void {
        if (!this.tiledMap) {
            this.tiledMap = this.node.getComponentInChildren(TiledMap);
        }
        if (!this.levelRoot) {
            this.levelRoot = this.node.getChildByName('LevelRoot') ?? new Node('LevelRoot');
            if (!this.levelRoot.parent) {
                this.node.addChild(this.levelRoot);
            }
        }

        if (!this.tiledMap) {
            console.error('[TileMapLevelLoader] Missing TiledMap. Add a TiledMap node to the scene or assign it in the inspector.');
            return;
        }

        const mapSize = this.tiledMap.getMapSize();
        const tileSize = this.tiledMap.getTileSize();
        this.mapPixelSize.set(mapSize.width * tileSize.width, mapSize.height * tileSize.height);

        console.log(
            `[TileMapLevelLoader] Map loaded size=${mapSize.width}x${mapSize.height} `
            + `tile=${tileSize.width}x${tileSize.height} pixels=${this.mapPixelSize.x}x${this.mapPixelSize.y}`,
        );
    }

    private buildSolidColliders(): void {
        if (!this.tiledMap || !this.levelRoot) {
            return;
        }

        const solidLayer = this.tiledMap.getLayer(this.solidLayerName);
        if (!solidLayer) {
            console.error(`[TileMapLevelLoader] Missing "${this.solidLayerName}" layer in TMX.`);
            return;
        }

        const mapSize = this.tiledMap.getMapSize();
        const tileSize = this.tiledMap.getTileSize();
        let colliderCount = 0;

        for (let y = 0; y < mapSize.height; y += 1) {
            for (let x = 0; x < mapSize.width; x += 1) {
                const gid = solidLayer.getTileGIDAt(x, y);
                if (!gid) {
                    continue;
                }
                this.createStaticTileCollider(solidLayer, x, y, tileSize.width, tileSize.height);
                colliderCount += 1;
            }
        }

        if (this.hideSolidLayerOnStart) {
            solidLayer.node.active = false;
        }

        if (colliderCount === 0) {
            console.error(`[TileMapLevelLoader] Solid layer "${this.solidLayerName}" generated 0 colliders. Player will fall through the map.`);
            return;
        }

        console.log(
            `[TileMapLevelLoader] Solid layer "${this.solidLayerName}" generated ${colliderCount} colliders `
            + `debug=${this.showSolidColliderDebug} hiddenLayer=${this.hideSolidLayerOnStart}`,
        );
    }

    private createStaticTileCollider(
        solidLayer: TiledLayer,
        tileX: number,
        tileY: number,
        tileWidth: number,
        tileHeight: number,
    ): void {
        if (!this.levelRoot) {
            return;
        }

        const colliderNode = new Node(`Solid_${tileX}_${tileY}`);
        this.levelRoot.addChild(colliderNode);

        colliderNode.setWorldPosition(this.tileCellToWorldCenter(tileX, tileY, tileWidth, tileHeight));

        const body = colliderNode.addComponent(RigidBody2D);
        body.type = ERigidBody2DType.Static;

        const collider = colliderNode.addComponent(BoxCollider2D);
        collider.size = new Size(tileWidth, tileHeight);
        collider.friction = 0;
        collider.restitution = 0;
        collider.apply();

        if (this.showSolidColliderDebug) {
            this.createSolidColliderDebugGraphic(colliderNode, tileWidth, tileHeight);
        }
    }

    private createSolidColliderDebugGraphic(colliderNode: Node, tileWidth: number, tileHeight: number): void {
        const transform = colliderNode.addComponent(UITransform);
        transform.setContentSize(tileWidth, tileHeight);

        const graphics = colliderNode.addComponent(Graphics);
        graphics.strokeColor = new Color(0, 255, 80, 220);
        graphics.fillColor = new Color(0, 255, 80, 45);
        graphics.lineWidth = 1;
        graphics.rect(-tileWidth * 0.5, -tileHeight * 0.5, tileWidth, tileHeight);
        graphics.fill();
        graphics.stroke();
    }

    private spawnPlayer(): void {
        if (!this.tiledMap || !this.levelRoot) {
            return;
        }

        const { node: playerNode, source } = this.resolvePlayerNode();
        let spawnX: number | null = null;
        let spawnY: number | null = null;

        if (this.useTmxSpawnPosition) {
            const spawn = this.findSpawnObject();
            if (!spawn) {
                console.error(`[TileMapLevelLoader] Missing "${this.spawnObjectName}" object in "${this.objectLayerName}" object layer.`);
                return;
            }

            spawnX = spawn.x ?? 0;
            spawnY = spawn.y ?? 0;
            const spawnWorld = this.tiledObjectToWorld(spawnX, spawnY);
            playerNode.setWorldPosition(spawnWorld.x, spawnWorld.y + this.spawnLift, 0);
        }

        this.ensurePlayerRenderable(playerNode);
        this.ensurePlayerController(playerNode);
        this.ensurePlayerDebugMarker(playerNode);
        this.player = playerNode;
        this.createDebugGroundBelowPlayer(playerNode);
        const mapBottomLeft = this.getMapBottomLeftWorld();
        console.log(
            `[TileMapLevelLoader] Spawned Player world=(${playerNode.worldPosition.x.toFixed(1)}, ${playerNode.worldPosition.y.toFixed(1)}, ${playerNode.worldPosition.z.toFixed(1)}) `
            + `local=(${playerNode.position.x.toFixed(1)}, ${playerNode.position.y.toFixed(1)}, ${playerNode.position.z.toFixed(1)}) `
            + `spawn=${spawnX === null || spawnY === null ? 'editor-position' : `(${spawnX.toFixed(1)}, ${spawnY.toFixed(1)})`} `
            + `mapBottomLeft=(${mapBottomLeft.x.toFixed(1)}, ${mapBottomLeft.y.toFixed(1)}) `
            + `source=${source} useTmxSpawnPosition=${this.useTmxSpawnPosition} `
            + `sprite=${this.getPlayerVisualSprite(playerNode)?.spriteFrame ? 'assigned' : 'missing-fallback'}`,
        );
        this.followPlayer();
    }

    private createDebugGroundBelowPlayer(playerNode: Node): void {
        if (!this.createDebugGround || !this.levelRoot) {
            return;
        }

        const existing = this.levelRoot.getChildByName('DebugGround');
        if (existing) {
            existing.destroy();
        }

        const groundNode = new Node('DebugGround');
        this.levelRoot.addChild(groundNode);
        groundNode.setWorldPosition(
            playerNode.worldPosition.x + this.debugGroundSize.x * 0.5 - 48,
            playerNode.worldPosition.y - this.debugGroundSize.y * 0.5 - 2,
            0,
        );

        const body = groundNode.addComponent(RigidBody2D);
        body.type = ERigidBody2DType.Static;

        const collider = groundNode.addComponent(BoxCollider2D);
        collider.size = new Size(this.debugGroundSize.x, this.debugGroundSize.y);
        collider.friction = 0;
        collider.restitution = 0;
        collider.apply();

        const transform = groundNode.addComponent(UITransform);
        transform.setContentSize(this.debugGroundSize.x, this.debugGroundSize.y);

        const graphics = groundNode.addComponent(Graphics);
        graphics.fillColor = new Color(255, 64, 0, 110);
        graphics.strokeColor = new Color(255, 255, 0, 240);
        graphics.lineWidth = 2;
        graphics.rect(-this.debugGroundSize.x * 0.5, -this.debugGroundSize.y * 0.5, this.debugGroundSize.x, this.debugGroundSize.y);
        graphics.fill();
        graphics.stroke();

        console.log(
            `[TileMapLevelLoader] DebugGround created world=(${groundNode.worldPosition.x.toFixed(1)}, ${groundNode.worldPosition.y.toFixed(1)}, ${groundNode.worldPosition.z.toFixed(1)}) `
            + `size=${this.debugGroundSize.x}x${this.debugGroundSize.y}`,
        );
    }

    private resolvePlayerNode(): { node: Node; source: 'existing' | 'prefab' | 'dynamic' } {
        if (!this.levelRoot) {
            throw new Error('[TileMapLevelLoader] Cannot resolve player without LevelRoot.');
        }

        const existing = this.levelRoot.getChildByName(this.existingPlayerName);
        if (existing) {
            return { node: existing, source: 'existing' };
        }

        if (this.playerPrefab) {
            const prefabNode = instantiate(this.playerPrefab);
            prefabNode.name = this.existingPlayerName;
            this.levelRoot.addChild(prefabNode);
            return { node: prefabNode, source: 'prefab' };
        }

        const dynamicNode = new Node(this.existingPlayerName);
        this.levelRoot.addChild(dynamicNode);
        return { node: dynamicNode, source: 'dynamic' };
    }

    private ensurePlayerRenderable(playerNode: Node): void {
        const visualNode = this.ensurePlayerVisualNode(playerNode);
        const rootSprite = playerNode.getComponent(Sprite);
        const rootSpriteFrame = rootSprite?.spriteFrame ?? null;
        if (rootSprite) {
            rootSprite.spriteFrame = null;
            rootSprite.enabled = false;
        }

        let transform = playerNode.getComponent(UITransform);
        if (!transform) {
            transform = playerNode.addComponent(UITransform);
        }
        transform.setContentSize(32, 32);

        let visualTransform = visualNode.getComponent(UITransform);
        if (!visualTransform) {
            visualTransform = visualNode.addComponent(UITransform);
        }
        visualTransform.setContentSize(32, 32);

        let sprite = visualNode.getComponent(Sprite);
        if (!sprite) {
            sprite = visualNode.addComponent(Sprite);
        }

        if (sprite.spriteFrame && this.isSuspiciouslyLargeSpriteFrame(sprite.spriteFrame, 'Visual spriteFrame')) {
            sprite.spriteFrame = null;
        }

        if (!sprite.spriteFrame && rootSpriteFrame && !this.isSuspiciouslyLargeSpriteFrame(rootSpriteFrame, 'Root spriteFrame')) {
            sprite.spriteFrame = rootSpriteFrame;
        }

        if (!sprite.spriteFrame && this.playerSprite && !this.isSuspiciouslyLargeSpriteFrame(this.playerSprite, 'TileMapLevelLoader.playerSprite')) {
            sprite.spriteFrame = this.playerSprite;
        }

        if (!sprite.spriteFrame) {
            sprite.enabled = false;
            this.createPlayerFallbackGraphic(visualNode);
        } else {
            sprite.enabled = true;
        }

        console.log(`[TileMapLevelLoader] Player Visual spriteFrame=${sprite.spriteFrame ? 'assigned' : 'missing'}`);
    }

    private isSuspiciouslyLargeSpriteFrame(spriteFrame: SpriteFrame, label: string): boolean {
        const size = this.getSpriteFrameDebugSize(spriteFrame);
        if (!size) {
            return false;
        }

        const suspicious = size.width > 96 || size.height > 96;
        if (suspicious) {
            console.warn(
                `[TileMapLevelLoader] ${label} is ${size.width}x${size.height}, which looks like a sheet/atlas region. `
                + 'Use a single frame such as mario_small_0.',
            );
        }
        return suspicious;
    }

    private getSpriteFrameDebugSize(spriteFrame: SpriteFrame): { width: number; height: number } | null {
        const frame = spriteFrame as unknown as {
            width?: number;
            height?: number;
            rect?: { width?: number; height?: number };
            originalSize?: { width?: number; height?: number };
            getRect?: () => { width?: number; height?: number };
            getOriginalSize?: () => { width?: number; height?: number };
        };

        const rect = frame.getRect?.() ?? frame.rect;
        if (rect?.width && rect?.height) {
            return { width: rect.width, height: rect.height };
        }

        const originalSize = frame.getOriginalSize?.() ?? frame.originalSize;
        if (originalSize?.width && originalSize?.height) {
            return { width: originalSize.width, height: originalSize.height };
        }

        if (frame.width && frame.height) {
            return { width: frame.width, height: frame.height };
        }

        return null;
    }

    private ensurePlayerVisualNode(playerNode: Node): Node {
        let visualNode = playerNode.getChildByName(this.playerVisualName);
        if (!visualNode) {
            visualNode = new Node(this.playerVisualName);
            playerNode.addChild(visualNode);
        }

        visualNode.setPosition(0, 16, 0);
        visualNode.active = true;
        return visualNode;
    }

    private ensurePlayerController(playerNode: Node): void {
        if (!playerNode.getComponent(PlayerController)) {
            playerNode.addComponent(PlayerController);
        }
    }

    private createPlayerFallbackGraphic(playerNode: Node): void {
        const existing = playerNode.getChildByName('PlayerFallbackGraphic');
        if (existing) {
            return;
        }

        const fallbackNode = new Node('PlayerFallbackGraphic');
        playerNode.addChild(fallbackNode);
        fallbackNode.setPosition(0, 0, 0);

        const transform = fallbackNode.addComponent(UITransform);
        transform.setContentSize(32, 32);

        const graphics = fallbackNode.addComponent(Graphics);
        graphics.fillColor = new Color(255, 48, 48, 255);
        graphics.strokeColor = new Color(255, 255, 255, 255);
        graphics.lineWidth = 2;
        graphics.rect(-16, 0, 32, 32);
        graphics.fill();
        graphics.stroke();
    }

    private ensurePlayerDebugMarker(playerNode: Node): void {
        if (!this.showPlayerDebugMarker) {
            return;
        }

        const visualNode = this.ensurePlayerVisualNode(playerNode);

        if (visualNode.getChildByName('PlayerDebugMarker')) {
            return;
        }

        const markerNode = new Node('PlayerDebugMarker');
        visualNode.addChild(markerNode);
        const markerTransform = markerNode.addComponent(UITransform);
        markerTransform.setContentSize(40, 40);
        markerNode.setPosition(0, 0, 0);

        const graphics = markerNode.addComponent(Graphics);
        graphics.strokeColor = new Color(255, 0, 0, 255);
        graphics.fillColor = new Color(255, 0, 0, 90);
        graphics.lineWidth = 3;
        graphics.rect(-20, -20, 40, 40);
        graphics.fill();
        graphics.stroke();
    }

    private findSpawnObject(): TiledObject | null {
        if (!this.tiledMap) {
            return null;
        }

        const objectGroup = this.tiledMap.getObjectGroup(this.objectLayerName);
        if (!objectGroup) {
            console.error(`[TileMapLevelLoader] Missing "${this.objectLayerName}" object layer in TMX.`);
            return null;
        }

        const objectByName = objectGroup.getObject(this.spawnObjectName) as unknown as TiledObject | null;
        if (objectByName) {
            return objectByName;
        }

        return ((objectGroup.getObjects() as unknown) as TiledObject[]).find((object) => object.type === 'spawn') ?? null;
    }

    private getPlayerVisualSprite(playerNode: Node): Sprite | null {
        return playerNode.getChildByName(this.playerVisualName)?.getComponent(Sprite) ?? null;
    }

    private followPlayer(): void {
        if (!this.followCamera) {
            return;
        }

        if (!this.camera || !this.tiledMap || !this.player) {
            if (!this.warnedMissingFollowTarget) {
                console.warn('[TileMapLevelLoader] Camera follow skipped. Assign Camera and make sure TiledMap/player are available.');
                this.warnedMissingFollowTarget = true;
            }
            return;
        }

        const visibleHalfSize = this.getCameraVisibleHalfSize();
        const mapBottomLeft = this.getMapBottomLeftWorld();
        const mapMinX = mapBottomLeft.x;
        const mapMinY = mapBottomLeft.y;
        const mapMaxX = mapMinX + this.mapPixelSize.x;
        const mapMaxY = mapMinY + this.mapPixelSize.y;

        const cameraNode = this.camera.node;
        const current = cameraNode.worldPosition;
        const target = this.player.worldPosition;

        const targetX = this.followX ? target.x + this.cameraOffset.x : current.x;
        const targetY = this.followY ? target.y + this.cameraOffset.y : current.y;
        const cameraX = this.clampCameraAxis(targetX, mapMinX, mapMaxX, visibleHalfSize.x);
        const cameraY = this.clampCameraAxis(targetY, mapMinY, mapMaxY, visibleHalfSize.y);

        cameraNode.setWorldPosition(cameraX, cameraY, current.z);
    }

    private getCameraVisibleHalfSize(): Vec2 {
        if (!this.camera) {
            return new Vec2(480, 320);
        }

        const canvasTransform = this.node.getComponent(UITransform);
        const aspect = canvasTransform && canvasTransform.height !== 0
            ? canvasTransform.width / canvasTransform.height
            : 16 / 9;
        const halfHeight = this.camera.orthoHeight;

        return new Vec2(halfHeight * aspect, halfHeight);
    }

    private clampCameraAxis(target: number, min: number, max: number, halfVisibleSize: number): number {
        const mapSize = max - min;
        if (mapSize <= halfVisibleSize * 2) {
            return min + mapSize * 0.5;
        }

        return Math.min(Math.max(target, min + halfVisibleSize), max - halfVisibleSize);
    }

    private getMapBottomLeftWorld(): Vec3 {
        if (!this.tiledMap) {
            return new Vec3();
        }

        const transform = this.tiledMap.node.getComponent(UITransform);
        if (!transform) {
            return this.tiledMap.node.worldPosition.clone();
        }

        const anchor = transform.anchorPoint;
        const origin = this.tiledMap.node.worldPosition.clone();
        origin.x -= transform.width * anchor.x;
        origin.y -= transform.height * anchor.y;
        return origin;
    }

    private tiledObjectToWorld(tiledX: number, tiledY: number): Vec3 {
        const bottomLeft = this.getMapBottomLeftWorld();
        return new Vec3(
            bottomLeft.x + tiledX,
            bottomLeft.y + this.mapPixelSize.y - tiledY,
            0,
        );
    }

    private tileCellToWorldCenter(tileX: number, tileY: number, tileWidth: number, tileHeight: number): Vec3 {
        const bottomLeft = this.getMapBottomLeftWorld();
        const mapRows = this.tiledMap?.getMapSize().height ?? 0;
        return new Vec3(
            bottomLeft.x + tileX * tileWidth + tileWidth * 0.5,
            bottomLeft.y + (mapRows - tileY - 1) * tileHeight + tileHeight * 0.5,
            0,
        );
    }
}
