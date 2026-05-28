import {
    _decorator,
    AudioClip,
    AudioSource,
    BoxCollider2D,
    Collider2D,
    Component,
    Contact2DType,
    ERigidBody2DType,
    instantiate,
    Node,
    Prefab,
    RigidBody2D,
    Size,
    Sprite,
    SpriteFrame,
    UITransform,
    Vec2,
    Vec3,
    isValid,
} from 'cc';
import { PlayerController } from './PlayerController';
import { ScoreHudText } from './ScoreHudText';
import { TurtleShellController } from './TurtleShellController';

const { ccclass, property } = _decorator;

@ccclass('TurtleController')
export class TurtleController extends Component {
    @property
    public moveSpeed = 45;

    @property
    public walkFrameInterval = 0.18;

    @property([SpriteFrame])
    public walkFrames: SpriteFrame[] = [];

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
    public stompTolerance = 3;

    @property
    public stompMinTopRatio = 0.45;

    @property
    public stompBounceSpeed = 180;

    @property
    public stompScoreValue = 100;

    @property
    public shellDefeatBounceSpeed = 3;

    @property(SpriteFrame)
    public shellFrame: SpriteFrame | null = null;

    @property([SpriteFrame])
    public shellFrames: SpriteFrame[] = [];

    @property
    public shellSlideSpeed = 220;

    @property
    public shellMovingDamageMinSpeed = 0;

    @property(Prefab)
    public shellPrefab: Prefab | null = null;

    @property(Vec2)
    public turtleBodySize = new Vec2(14, 24);

    @property(Vec2)
    public turtleColliderOffset = new Vec2(0, -1);

    @property(Vec2)
    public shellBodySize = new Vec2(16, 16);

    @property
    public destroyBelowY = -300;

    @property(AudioClip)
    public stompSound: AudioClip | null = null;

    @property
    public sfxVolume = 1;

    private body: RigidBody2D | null = null;
    private collider: BoxCollider2D | null = null;
    private sprite: Sprite | null = null;
    private sfxSource: AudioSource | null = null;
    private moveDirection = -1;
    private walkElapsed = 0;
    private walkFrameIndex = 0;
    private baseVisualScaleX = 1;
    private defeated = false;
    private stompQueued = false;
    private pendingStompPlayer: PlayerController | null = null;

    protected onLoad(): void {
        this.moveDirection = this.normalizeDirection(this.startDirection);
        this.setupComponents();
    }

    protected onDestroy(): void {
        this.collider?.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        this.pendingStompPlayer = null;
    }

    protected update(deltaTime: number): void {
        if (this.defeated) {
            this.destroyIfBelowScreen();
            return;
        }

        this.updateDirectionFromWaypoints();
        this.applyMovement();
        this.updateWalkAnimation(deltaTime);
    }

    public defeatByShell(): boolean {
        if (this.defeated || this.stompQueued) {
            return false;
        }

        this.defeated = true;
        this.collider?.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        if (this.collider) {
            this.collider.enabled = false;
        }
        if (this.body) {
            this.body.gravityScale = 1;
            this.body.fixedRotation = true;
            this.setBodyVelocity(new Vec2(0, this.shellDefeatBounceSpeed));
        }
        this.scheduleOnce(() => this.node.destroy(), 0.25);
        return true;
    }

    private setupComponents(): void {
        this.sprite = this.node.getComponent(Sprite);
        if (!this.sprite) {
            this.sprite = this.node.addComponent(Sprite);
        }
        this.applyCurrentWalkFrame();

        this.baseVisualScaleX = Math.abs(this.node.scale.x || 1);

        if (!this.node.getComponent(UITransform)) {
            this.node.addComponent(UITransform);
        }

        this.body = this.node.getComponent(RigidBody2D);
        if (!this.body) {
            this.body = this.node.addComponent(RigidBody2D);
        }
        this.body.type = ERigidBody2DType.Dynamic;
        this.body.enabledContactListener = true;
        this.body.fixedRotation = true;
        this.body.gravityScale = 1;

        this.resolveCollider();
        this.setupSfxSource();
        this.registerContactListener();
    }

    private resolveCollider(): BoxCollider2D | null {
        if (this.collider && isValid(this.collider)) {
            return this.collider;
        }

        this.collider = this.node.getComponent(BoxCollider2D);
        if (!this.collider) {
            this.collider = this.node.addComponent(BoxCollider2D);
        }

        this.collider.sensor = false;
        this.collider.size = new Size(this.turtleBodySize.x, this.turtleBodySize.y);
        this.collider.offset = new Vec2(this.turtleColliderOffset.x, this.turtleColliderOffset.y);
        this.collider.density = 1;
        this.collider.friction = 0;
        this.collider.restitution = 0;
        this.collider.apply();

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
        if (this.defeated || this.stompQueued || otherCollider.sensor) {
            return;
        }

        const player = otherCollider.node.getComponent(PlayerController);
        if (!player) {
            return;
        }

        if (this.isStompedBy(player)) {
            this.queueStomp(player);
            return;
        }

        player.takeDamage();
    }

    private isStompedBy(player: PlayerController): boolean {
        if (!this.collider || player.getVerticalVelocity() > 0) {
            return false;
        }

        const turtleCenterY = this.node.worldPosition.y + this.collider.offset.y;
        const turtleHeight = this.collider.size.height;
        const turtleBottomY = turtleCenterY - turtleHeight * 0.5;
        const stompLineY = turtleBottomY + turtleHeight * Math.min(Math.max(this.stompMinTopRatio, 0), 1);
        return player.getFootWorldY() >= stompLineY - Math.max(this.stompTolerance, 0);
    }

    private queueStomp(player: PlayerController): void {
        if (this.defeated || this.stompQueued) {
            return;
        }

        this.stompQueued = true;
        this.pendingStompPlayer = player;
        this.scheduleOnce(this.applyStomp, 0);
    }

    private readonly applyStomp = (): void => {
        if (this.defeated) {
            return;
        }

        const player = this.pendingStompPlayer;
        this.pendingStompPlayer = null;
        this.defeated = true;
        this.playSfx(this.stompSound);
        player?.bounceAfterStomp(this.stompBounceSpeed);
        if (player) {
            ScoreHudText.addToActiveScore(this.stompScoreValue, this.getScorePopupWorldPosition(player));
        }

        this.spawnShell();
        this.node.destroy();
    };

    private spawnShell(): void {
        const shellNode = this.shellPrefab ? instantiate(this.shellPrefab) : new Node('TurtleShell');

        let sprite = shellNode.getComponent(Sprite);
        if (!sprite) {
            sprite = shellNode.addComponent(Sprite);
        }
        if (this.shellFrame) {
            sprite.spriteFrame = this.shellFrame;
        }

        let shell = shellNode.getComponent(TurtleShellController);
        if (!shell) {
            shell = shellNode.addComponent(TurtleShellController);
        }
        const shellFrames = this.resolveShellFrames();
        if (shellFrames.length > 0) {
            shell.shellFrames = shellFrames;
        }
        if (!this.shellPrefab) {
            shell.slideSpeed = Math.abs(this.shellSlideSpeed);
        }
        shell.movingDamageMinSpeed = Math.max(this.shellMovingDamageMinSpeed, 0);
        shell.bodySize = this.shellBodySize.clone();
        shell.destroyBelowY = this.destroyBelowY;

        const parent = this.node.parent;
        if (parent) {
            parent.addChild(shellNode);
        }
        shellNode.setWorldPosition(this.node.worldPosition);
        shell.stopSliding();
    }

    private resolveShellFrames(): SpriteFrame[] {
        if (this.shellFrames.length > 0) {
            return this.shellFrames.filter((frame) => !!frame);
        }

        return this.shellFrame ? [this.shellFrame] : [];
    }

    private getScorePopupWorldPosition(player: PlayerController): Vec3 {
        const position = player.node.worldPosition.clone();
        position.y += 28;
        return position;
    }

    private setupSfxSource(): void {
        this.sfxSource = this.node.getComponent(AudioSource);
        if (!this.sfxSource) {
            this.sfxSource = this.node.addComponent(AudioSource);
        }
    }

    private playSfx(clip: AudioClip | null): void {
        if (!clip) {
            return;
        }

        if (!this.sfxSource) {
            this.setupSfxSource();
        }

        this.sfxSource?.playOneShot(clip, Math.max(this.sfxVolume, 0));
    }

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

    private updateWalkAnimation(deltaTime: number): void {
        const frameCount = Math.min(this.walkFrames.length, 2);
        if (frameCount <= 0) {
            return;
        }

        const interval = Math.max(this.walkFrameInterval, 0.01);
        this.walkElapsed += deltaTime;
        while (this.walkElapsed >= interval) {
            this.walkElapsed -= interval;
            this.walkFrameIndex = (this.walkFrameIndex + 1) % frameCount;
            this.applyCurrentWalkFrame();
        }

        const scale = this.node.scale.clone();
        scale.x = this.baseVisualScaleX * (this.moveDirection < 0 ? 1 : -1);
        this.node.setScale(scale);
    }

    private applyCurrentWalkFrame(): void {
        if (!this.sprite || this.walkFrames.length === 0) {
            return;
        }

        const frameCount = Math.min(this.walkFrames.length, 2);
        this.sprite.spriteFrame = this.walkFrames[this.walkFrameIndex % frameCount];
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

    private normalizeDirection(direction: number): number {
        if (direction === 0) {
            return -1;
        }

        return direction < 0 ? -1 : 1;
    }
}
