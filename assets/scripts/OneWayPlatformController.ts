import {
    _decorator,
    BoxCollider2D,
    Component,
    Size,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('OneWayPlatformController')
export class OneWayPlatformController extends Component {
    @property
    public platformHeight = 16;

    @property
    public surfaceTolerance = 2;

    @property
    public horizontalTolerance = 1;

    private collider: BoxCollider2D | null = null;

    protected onLoad(): void {
        this.resolveCollider();
        this.configureAsSensor();
    }

    public configure(size: Size): void {
        this.platformHeight = size.height;
        this.configureAsSensor();
    }

    public getPlatformTopWorldY(): number {
        const collider = this.resolveCollider();
        if (!collider) {
            return this.node.worldPosition.y + this.platformHeight * 0.5;
        }

        return this.node.worldPosition.y + collider.offset.y + collider.size.height * 0.5;
    }

    public containsWorldX(worldX: number): boolean {
        const collider = this.resolveCollider();
        if (!collider) {
            return false;
        }

        const halfWidth = collider.size.width * 0.5 + this.horizontalTolerance;
        const centerX = this.node.worldPosition.x + collider.offset.x;
        return worldX >= centerX - halfWidth && worldX <= centerX + halfWidth;
    }

    private resolveCollider(): BoxCollider2D | null {
        if (!this.collider) {
            this.collider = this.node.getComponent(BoxCollider2D);
        }
        return this.collider;
    }

    private configureAsSensor(): void {
        const collider = this.resolveCollider();
        if (!collider) {
            console.warn('[OneWayPlatformController] Missing BoxCollider2D.');
            return;
        }

        collider.sensor = true;
        collider.density = 0;
        collider.friction = 0;
        collider.restitution = 0;
        collider.apply();
    }
}
