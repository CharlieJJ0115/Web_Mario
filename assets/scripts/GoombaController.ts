import {
    _decorator,
    BoxCollider2D,
    Collider2D,
    Color,
    Component,
    Contact2DType,
    ERigidBody2DType,
    Graphics,
    Node,
    RigidBody2D,
    Size,
    Sprite,
    SpriteFrame,
    UITransform,
    Vec2,
    isValid,
} from 'cc';
import { EDITOR } from 'cc/env';
import { PlayerController } from './PlayerController';

const { ccclass, executeInEditMode, property } = _decorator;

@ccclass('GoombaController')
@executeInEditMode
export class GoombaController extends Component {
    @property
    public moveSpeed = 50;

    @property
    public walkFrameInterval = 0.18;

    @property
    public startDirection = -1;

    @property(Node)
    public leftWaypoint: Node | null = null;

    @property(Node)
    public rightWaypoint: Node | null = null;

    @property
    public useWaypoints = true;

    @property
    public waypointTolerance = 1;

    @property
    public showColliderDebug = false;

    @property(SpriteFrame)
    public deadFrame: SpriteFrame | null = null;

    @property
    public stompTolerance = 3;

    @property
    public stompBounceSpeed = 180;

    @property
    public destroyBelowY = -300;

    private body: RigidBody2D | null = null;
    private collider: BoxCollider2D | null = null;
    private sprite: Sprite | null = null;
    private colliderDebugNode: Node | null = null;
    private walkElapsed = 0;
    private mirrorFrame = false;
    private baseVisualScaleX = 1;
    private moveDirection = -1;
    private isDead = false;
    private stompDeathQueued = false;
    private pendingStompPlayer: PlayerController | null = null;

    protected onLoad(): void {
        this.moveDirection = this.normalizeDirection(this.startDirection);
        this.setupComponents();
    }

    protected onValidate(): void {
        this.resolveCollider();
        this.updateColliderDebug();
    }

    protected update(deltaTime: number): void {
        if (EDITOR) {
            this.resolveCollider();
            this.updateColliderDebug();
            return;
        }

        if (this.isDead) {
            this.destroyIfBelowScreen();
            return;
        }

        this.updateDirectionFromWaypoints();
        this.applyMovement();
        this.updateWalkMirrorAnimation(deltaTime);
        this.updateColliderDebug();
    }

    protected onDestroy(): void {
        this.collider?.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        this.pendingStompPlayer = null;
    }

    private setupComponents(): void {
        this.sprite = this.node.getComponent(Sprite);
        if (!this.sprite) {
            this.sprite = this.node.addComponent(Sprite);
        }

        this.baseVisualScaleX = Math.abs(this.node.scale.x || 1);

        this.ensureVisualTransform();

        this.body = this.node.getComponent(RigidBody2D);
        if (!this.body) {
            this.body = this.node.addComponent(RigidBody2D);
        }
        this.body.type = ERigidBody2DType.Dynamic;
        this.body.enabledContactListener = true;
        this.body.fixedRotation = true;
        this.body.gravityScale = 1;

        this.resolveCollider();
        this.registerContactListener();
        this.updateColliderDebug();
    }

    private ensureVisualTransform(): void {
        if (!this.node.getComponent(UITransform)) {
            this.node.addComponent(UITransform);
        }
    }

    private resolveCollider(): BoxCollider2D | null {
        if (this.collider && isValid(this.collider)) {
            return this.collider;
        }

        this.collider = this.node.getComponent(BoxCollider2D);
        if (!this.collider && !EDITOR) {
            this.collider = this.node.addComponent(BoxCollider2D);
            this.collider.sensor = false;
            this.collider.size = new Size(14, 14);
            this.collider.offset = new Vec2(0, -5);
            this.collider.density = 1;
            this.collider.friction = 0;
            this.collider.restitution = 0;
            this.collider.apply();
        }

        return this.collider;
    }

    private registerContactListener(): void {
        if (!this.collider) {
            return;
        }

        this.collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        this.collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
    }

    private onBeginContact(_selfCollider: Collider2D, otherCollider: Collider2D): void {
        if (this.isDead || this.stompDeathQueued || otherCollider.sensor) {
            return;
        }

        const player = otherCollider.node.getComponent(PlayerController);
        if (!player) {
            return;
        }

        if (this.isStompedBy(player)) {
            this.queueStompDeath(player);
            return;
        }

        player.takeDamage();
    }

    private isStompedBy(player: PlayerController): boolean {
        if (!this.collider || player.getVerticalVelocity() > 0) {
            return false;
        }

        const goombaTopY = this.node.worldPosition.y + this.collider.offset.y + this.collider.size.height * 0.5;
        return player.getFootWorldY() >= goombaTopY - Math.max(this.stompTolerance, 0);
    }

    private queueStompDeath(player: PlayerController): void {
        if (this.isDead || this.stompDeathQueued) {
            return;
        }

        this.stompDeathQueued = true;
        this.pendingStompPlayer = player;
        this.scheduleOnce(this.applyStompDeath, 0);
    }

    private readonly applyStompDeath = (): void => {
        if (this.isDead) {
            return;
        }

        const player = this.pendingStompPlayer;
        this.pendingStompPlayer = null;
        this.isDead = true;
        player?.bounceAfterStomp(this.stompBounceSpeed);

        if (this.sprite && this.deadFrame) {
            this.sprite.spriteFrame = this.deadFrame;
        }

        this.collider?.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        if (this.collider) {
            this.collider.enabled = false;
        }
        if (this.colliderDebugNode) {
            this.colliderDebugNode.active = false;
        }

        if (this.body) {
            this.body.gravityScale = 1;
            this.body.fixedRotation = true;
            this.setBodyVelocity(new Vec2(0, 0));
        }
    };

    private destroyIfBelowScreen(): void {
        if (this.node.worldPosition.y < this.destroyBelowY) {
            this.node.destroy();
        }
    }

    private applyMovement(): void {
        if (!this.body) {
            return;
        }

        const velocity = this.body.linearVelocity.clone();
        velocity.x = this.moveDirection * Math.abs(this.moveSpeed);
        this.setBodyVelocity(velocity);
    }

    private updateDirectionFromWaypoints(): void {
        if (!this.useWaypoints || !this.leftWaypoint || !this.rightWaypoint) {
            return;
        }

        const leftX = this.leftWaypoint.worldPosition.x;
        const rightX = this.rightWaypoint.worldPosition.x;
        const minX = Math.min(leftX, rightX);
        const maxX = Math.max(leftX, rightX);
        const tolerance = Math.max(this.waypointTolerance, 0);
        const currentX = this.node.worldPosition.x;

        if (currentX <= minX + tolerance) {
            this.moveDirection = 1;
            return;
        }

        if (currentX >= maxX - tolerance) {
            this.moveDirection = -1;
        }
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

    private updateWalkMirrorAnimation(deltaTime: number): void {
        const interval = Math.max(this.walkFrameInterval, 0.01);
        this.walkElapsed += deltaTime;

        while (this.walkElapsed >= interval) {
            this.walkElapsed -= interval;
            this.mirrorFrame = !this.mirrorFrame;
        }

        const scale = this.node.scale.clone();
        scale.x = this.baseVisualScaleX * (this.mirrorFrame ? -1 : 1);
        this.node.setScale(scale);
    }

    private normalizeDirection(direction: number): number {
        if (direction === 0) {
            return -1;
        }

        return direction < 0 ? -1 : 1;
    }

    private updateColliderDebug(): void {
        if (!this.collider) {
            if (this.colliderDebugNode) {
                this.colliderDebugNode.active = false;
            }
            return;
        }

        let debugNode = this.colliderDebugNode;
        if (!debugNode || !isValid(debugNode)) {
            debugNode = this.node.getChildByName('GoombaColliderDebug');
            if (!debugNode) {
                debugNode = new Node('GoombaColliderDebug');
                this.node.addChild(debugNode);
            }
            this.colliderDebugNode = debugNode;
        }

        debugNode.active = this.showColliderDebug;
        if (!this.showColliderDebug) {
            return;
        }

        debugNode.setPosition(this.collider.offset.x, this.collider.offset.y, 0);

        let transform = debugNode.getComponent(UITransform);
        if (!transform) {
            transform = debugNode.addComponent(UITransform);
        }
        transform.setContentSize(this.collider.size.width, this.collider.size.height);

        let graphics = debugNode.getComponent(Graphics);
        if (!graphics) {
            graphics = debugNode.addComponent(Graphics);
        }

        graphics.clear();
        graphics.strokeColor = new Color(255, 180, 0, 255);
        graphics.fillColor = new Color(255, 180, 0, 45);
        graphics.lineWidth = 1;
        graphics.rect(
            -this.collider.size.width * 0.5,
            -this.collider.size.height * 0.5,
            this.collider.size.width,
            this.collider.size.height,
        );
        graphics.fill();
        graphics.stroke();
    }
}
