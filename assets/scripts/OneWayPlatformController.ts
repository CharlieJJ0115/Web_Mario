import {
    _decorator,
    BoxCollider2D,
    Collider2D,
    Component,
    Contact2DType,
    RigidBody2D,
    Size,
} from 'cc';
import type { IPhysics2DContact } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('OneWayPlatformController')
export class OneWayPlatformController extends Component {
    @property
    public platformHeight = 16;

    @property
    public surfaceTolerance = 2;

    @property
    public horizontalTolerance = 1;

    @property
    public topColliderHeight = 2;

    @property
    public stickTolerance = 4;

    private collider: BoxCollider2D | null = null;
    private landedBodies = new Set<RigidBody2D>();

    protected onLoad(): void {
        this.resolveCollider();
        this.configureAsSolidPlatform();
        this.registerContactListener();
    }

    protected onDestroy(): void {
        this.collider?.off(Contact2DType.PRE_SOLVE, this.onPreSolve, this);
        this.collider?.off(Contact2DType.END_CONTACT, this.onEndContact, this);
        this.landedBodies.clear();
    }

    public configure(size: Size): void {
        this.platformHeight = size.height;
        this.configureAsSolidPlatform();
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

    private configureAsSolidPlatform(): void {
        const collider = this.resolveCollider();
        if (!collider) {
            console.warn('[OneWayPlatformController] Missing BoxCollider2D.');
            return;
        }

        collider.sensor = false;
        collider.density = 1;
        collider.friction = 0;
        collider.restitution = 0;
        collider.apply();
    }

    private registerContactListener(): void {
        const collider = this.resolveCollider();
        if (!collider) {
            return;
        }

        collider.off(Contact2DType.PRE_SOLVE, this.onPreSolve, this);
        collider.on(Contact2DType.PRE_SOLVE, this.onPreSolve, this);
        collider.off(Contact2DType.END_CONTACT, this.onEndContact, this);
        collider.on(Contact2DType.END_CONTACT, this.onEndContact, this);
    }

    private onPreSolve(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null): void {
        if (!contact || selfCollider !== this.collider) {
            return;
        }

        const body = otherCollider.node.getComponent(RigidBody2D);
        if (otherCollider.sensor) {
            contact.disabledOnce = true;
            return;
        }

        if (!body || !this.shouldCollideWith(otherCollider, body)) {
            if (body) {
                this.landedBodies.delete(body);
            }
            contact.disabledOnce = true;
        }
    }

    private onEndContact(_selfCollider: Collider2D, otherCollider: Collider2D): void {
        if (otherCollider.sensor) {
            return;
        }

        const body = otherCollider.node.getComponent(RigidBody2D);
        if (body) {
            this.landedBodies.delete(body);
        }
    }

    private shouldCollideWith(otherCollider: Collider2D, body: RigidBody2D): boolean {
        if (body.linearVelocity.y > 0) {
            this.landedBodies.delete(body);
            return false;
        }

        const bottomY = this.getOtherColliderBottomWorldY(otherCollider);
        const platformTopY = this.getPlatformTopWorldY();
        if (this.landedBodies.has(body)) {
            const stillOnTop = bottomY >= platformTopY - Math.max(this.stickTolerance, this.surfaceTolerance);
            if (!stillOnTop) {
                this.landedBodies.delete(body);
            }
            return stillOnTop;
        }

        const canLand = bottomY >= platformTopY - this.surfaceTolerance;
        if (canLand) {
            this.landedBodies.add(body);
        }
        return canLand;
    }

    private getOtherColliderBottomWorldY(otherCollider: Collider2D): number {
        if (otherCollider instanceof BoxCollider2D) {
            return otherCollider.node.worldPosition.y + otherCollider.offset.y - otherCollider.size.height * 0.5;
        }

        return otherCollider.node.worldPosition.y;
    }
}
