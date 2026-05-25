import {
    _decorator,
    Camera,
    Component,
    Node,
    TiledMap,
    UITransform,
    Vec2,
    Vec3,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('CameraFollow')
export class CameraFollow extends Component {
    @property(Camera)
    public camera: Camera | null = null;

    @property(Node)
    public target: Node | null = null;

    @property(TiledMap)
    public tiledMap: TiledMap | null = null;

    @property
    public followX = true;

    @property
    public followY = false;

    @property(Vec2)
    public offset = new Vec2(0, 0);

    @property
    public smoothTime = 0;

    @property
    public clampToMap = true;

    protected lateUpdate(deltaTime: number): void {
        const camera = this.camera ?? this.node.getComponent(Camera);
        if (!camera || !this.target) {
            return;
        }

        const cameraNode = camera.node;
        const current = cameraNode.worldPosition;
        const target = this.target.worldPosition;
        const desired = new Vec3(
            this.followX ? target.x + this.offset.x : current.x,
            this.followY ? target.y + this.offset.y : current.y,
            current.z,
        );

        if (this.clampToMap && this.tiledMap) {
            this.clampDesiredPositionToMap(camera, desired);
        }

        if (this.smoothTime <= 0) {
            cameraNode.setWorldPosition(desired);
            return;
        }

        const alpha = Math.min(1, deltaTime / Math.max(this.smoothTime, 0.0001));
        cameraNode.setWorldPosition(
            current.x + (desired.x - current.x) * alpha,
            current.y + (desired.y - current.y) * alpha,
            current.z,
        );
    }

    private clampDesiredPositionToMap(camera: Camera, desired: Vec3): void {
        if (!this.tiledMap) {
            return;
        }

        const mapSize = this.tiledMap.getMapSize();
        const tileSize = this.tiledMap.getTileSize();
        const mapWidth = mapSize.width * tileSize.width;
        const mapHeight = mapSize.height * tileSize.height;
        const mapBottomLeft = this.getMapBottomLeftWorld();
        const mapMinX = mapBottomLeft.x;
        const mapMaxX = mapBottomLeft.x + mapWidth;
        const mapMinY = mapBottomLeft.y;
        const mapMaxY = mapBottomLeft.y + mapHeight;
        const visibleHalfSize = this.getCameraVisibleHalfSize(camera);

        if (this.followX) {
            desired.x = this.clampAxis(desired.x, mapMinX, mapMaxX, visibleHalfSize.x);
        }

        if (this.followY) {
            desired.y = this.clampAxis(desired.y, mapMinY, mapMaxY, visibleHalfSize.y);
        }
    }

    private clampAxis(target: number, min: number, max: number, halfVisibleSize: number): number {
        const size = max - min;
        if (size <= halfVisibleSize * 2) {
            return min + size * 0.5;
        }

        return Math.min(Math.max(target, min + halfVisibleSize), max - halfVisibleSize);
    }

    private getMapBottomLeftWorld(): Vec3 {
        if (!this.tiledMap) {
            return new Vec3();
        }

        const mapNode = this.tiledMap.node;
        const transform = mapNode.getComponent(UITransform);
        if (!transform) {
            return mapNode.worldPosition.clone();
        }

        const origin = mapNode.worldPosition.clone();
        origin.x -= transform.width * transform.anchorPoint.x;
        origin.y -= transform.height * transform.anchorPoint.y;
        return origin;
    }

    private getCameraVisibleHalfSize(camera: Camera): Vec2 {
        const halfHeight = camera.orthoHeight;
        const aspect = this.getCameraAspect(camera);
        return new Vec2(halfHeight * aspect, halfHeight);
    }

    private getCameraAspect(camera: Camera): number {
        const cameraParentTransform = camera.node.parent?.getComponent(UITransform);
        if (cameraParentTransform && cameraParentTransform.height !== 0) {
            return cameraParentTransform.width / cameraParentTransform.height;
        }

        const ownTransform = this.node.getComponent(UITransform);
        if (ownTransform && ownTransform.height !== 0) {
            return ownTransform.width / ownTransform.height;
        }

        return 16 / 9;
    }
}
