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
    public showPlayerDebugMarker = true;

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

        for (let y = 0; y < mapSize.height; y += 1) {
            for (let x = 0; x < mapSize.width; x += 1) {
                const gid = solidLayer.getTileGIDAt(x, y);
                if (!gid) {
                    continue;
                }
                this.createStaticTileCollider(solidLayer, x, y, tileSize.width, tileSize.height);
            }
        }
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
        collider.size = new Vec2(tileWidth, tileHeight);
        collider.friction = 0;
        collider.restitution = 0;
        collider.apply();
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
        const mapBottomLeft = this.getMapBottomLeftWorld();
        console.log(
            `[TileMapLevelLoader] Spawned Player world=(${playerNode.worldPosition.x.toFixed(1)}, ${playerNode.worldPosition.y.toFixed(1)}, ${playerNode.worldPosition.z.toFixed(1)}) `
            + `local=(${playerNode.position.x.toFixed(1)}, ${playerNode.position.y.toFixed(1)}, ${playerNode.position.z.toFixed(1)}) `
            + `spawn=${spawnX === null || spawnY === null ? 'editor-position' : `(${spawnX.toFixed(1)}, ${spawnY.toFixed(1)})`} `
            + `mapBottomLeft=(${mapBottomLeft.x.toFixed(1)}, ${mapBottomLeft.y.toFixed(1)}) `
            + `source=${source} useTmxSpawnPosition=${this.useTmxSpawnPosition} `
            + `sprite=${this.playerSprite || playerNode.getComponent(Sprite)?.spriteFrame ? 'assigned' : 'missing-fallback'}`,
        );
        this.followPlayer();
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
        let transform = playerNode.getComponent(UITransform);
        if (!transform) {
            transform = playerNode.addComponent(UITransform);
        }
        transform.setContentSize(32, 32);

        let sprite = playerNode.getComponent(Sprite);
        if (!sprite) {
            sprite = playerNode.addComponent(Sprite);
        }

        if (!sprite.spriteFrame && this.playerSprite) {
            sprite.spriteFrame = this.playerSprite;
        }

        if (!sprite.spriteFrame) {
            sprite.enabled = false;
            this.createPlayerFallbackGraphic(playerNode);
        } else {
            sprite.enabled = true;
        }
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
        fallbackNode.setPosition(0, 16, 0);

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

        if (playerNode.getChildByName('PlayerDebugMarker')) {
            return;
        }

        const markerNode = new Node('PlayerDebugMarker');
        playerNode.addChild(markerNode);
        const markerTransform = markerNode.addComponent(UITransform);
        markerTransform.setContentSize(40, 40);
        markerNode.setPosition(0, 16, 0);

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

        const objectByName = objectGroup.getObject(this.spawnObjectName) as TiledObject | null;
        if (objectByName) {
            return objectByName;
        }

        return (objectGroup.getObjects() as TiledObject[]).find((object) => object.type === 'spawn') ?? null;
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
