import {
    _decorator,
    BoxCollider2D,
    Camera,
    Collider2D,
    Component,
    Contact2DType,
    ERigidBody2DType,
    RigidBody2D,
    Size,
    Sprite,
    UITransform,
    Vec2,
} from 'cc';
import { PlayerController } from './PlayerController';

const { ccclass, property } = _decorator;

@ccclass('MushroomController')
export class MushroomController extends Component {
    @property
    public moveSpeed = 60;

    @property(Vec2)
    public bodySize = new Vec2(16, 16);

    @property
    public destroyMargin = 64;

    @property(Camera)
    public camera: Camera | null = null;

    @property
    public fallbackDestroyY = -300;

    private body: RigidBody2D | null = null;
    private collider: BoxCollider2D | null = null;
    private consumed = false;

    protected onLoad(): void {
        this.setupComponents();
    }

    protected onDestroy(): void {
        this.collider?.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
    }

    protected update(): void {
        this.applyMovement();
        this.destroyIfOutOfFrame();
    }

    private setupComponents(): void {
        let transform = this.node.getComponent(UITransform);
        if (!transform) {
            transform = this.node.addComponent(UITransform);
        }
        transform.setContentSize(this.bodySize.x, this.bodySize.y);

        if (!this.node.getComponent(Sprite)) {
            this.node.addComponent(Sprite);
        }

        this.body = this.node.getComponent(RigidBody2D);
        if (!this.body) {
            this.body = this.node.addComponent(RigidBody2D);
        }
        this.body.type = ERigidBody2DType.Dynamic;
        this.body.enabledContactListener = true;
        this.body.fixedRotation = true;
        this.body.gravityScale = 1;

        this.collider = this.node.getComponent(BoxCollider2D);
        if (!this.collider) {
            this.collider = this.node.addComponent(BoxCollider2D);
        }
        this.collider.sensor = false;
        this.collider.size = new Size(this.bodySize.x, this.bodySize.y);
        this.collider.apply();
        this.collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        this.collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
    }

    private onBeginContact(_selfCollider: Collider2D, otherCollider: Collider2D): void {
        if (this.consumed) {
            return;
        }
        if (otherCollider.sensor) {
            return;
        }

        const player = otherCollider.node.getComponent(PlayerController);
        if (!player) {
            return;
        }

        this.consumed = true;
        player.tryGrowBig();
        this.hideImmediately();
        this.scheduleOnce(this.destroyConsumedMushroom, 0);
    }

    private hideImmediately(): void {
        const sprite = this.node.getComponent(Sprite);
        if (sprite) {
            sprite.enabled = false;
        }
    }

    private readonly destroyConsumedMushroom = (): void => {
        this.node.destroy();
    };

    private applyMovement(): void {
        if (this.consumed || !this.body) {
            return;
        }

        const velocity = this.body.linearVelocity.clone();
        velocity.x = -Math.abs(this.moveSpeed);
        this.setBodyVelocity(velocity);
    }

    private setBodyVelocity(velocity: Vec2): void {
        if (!this.body) {
            return;
        }

        const bodyWithMethods = this.body as unknown as {
            setLinearVelocity?: (value: Vec2) => void;
            wakeUp?: () => void;
        };

        if (bodyWithMethods.setLinearVelocity) {
            bodyWithMethods.setLinearVelocity(velocity);
        } else {
            this.body.linearVelocity = velocity;
        }

        bodyWithMethods.wakeUp?.();
    }

    private destroyIfOutOfFrame(): void {
        if (this.consumed) {
            return;
        }

        const worldPosition = this.node.worldPosition;
        if (worldPosition.y < this.fallbackDestroyY) {
            this.node.destroy();
            return;
        }

        if (!this.camera) {
            return;
        }

        const visibleHalfSize = this.getCameraVisibleHalfSize();
        const cameraPosition = this.camera.node.worldPosition;
        const minVisibleX = cameraPosition.x - visibleHalfSize.x - this.destroyMargin;
        const minVisibleY = cameraPosition.y - visibleHalfSize.y - this.destroyMargin;

        if (worldPosition.x < minVisibleX || worldPosition.y < minVisibleY) {
            this.node.destroy();
        }
    }

    private getCameraVisibleHalfSize(): Vec2 {
        if (!this.camera) {
            return new Vec2(480, 320);
        }

        const halfHeight = this.camera.orthoHeight;
        const canvasTransform = this.camera.node.parent?.getComponent(UITransform);
        const aspect = canvasTransform && canvasTransform.height !== 0
            ? canvasTransform.width / canvasTransform.height
            : 16 / 9;

        return new Vec2(halfHeight * aspect, halfHeight);
    }
}
