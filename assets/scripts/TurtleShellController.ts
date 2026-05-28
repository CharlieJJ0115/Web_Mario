import {
    _decorator,
    BoxCollider2D,
    Collider2D,
    Component,
    Contact2DType,
    ERigidBody2DType,
    RigidBody2D,
    Size,
    Sprite,
    SpriteFrame,
    UITransform,
    Vec2,
    Vec3,
} from 'cc';
import { GoombaController } from './GoombaController';
import { PlayerController } from './PlayerController';
import { ScoreHudText } from './ScoreHudText';

const { ccclass, property } = _decorator;

type ShellState = 'Idle' | 'Sliding';

type ShellDefeatable = Component & {
    defeatByShell?: () => boolean;
};

@ccclass('TurtleShellController')
export class TurtleShellController extends Component {
    @property
    public slideSpeed = 220;

    @property([SpriteFrame])
    public shellFrames: SpriteFrame[] = [];

    @property
    public slideFrameInterval = 0.08;

    @property
    public movingDamageMinSpeed = 0;

    @property
    public wallBounceCooldown = 0.08;

    @property
    public wallBounceMinHorizontalGap = 1;

    @property
    public kickMinPlayerXDistance = 2;

    @property
    public stompTolerance = 3;

    @property
    public stompBounceSpeed = 180;

    @property
    public kickScoreValue = 100;

    @property
    public enemyHitScoreValue = 200;

    @property(Vec2)
    public bodySize = new Vec2(16, 16);

    @property
    public density = 0.2;

    @property
    public friction = 0.05;

    @property
    public restitution = 0;

    @property
    public destroyBelowY = -300;

    private body: RigidBody2D | null = null;
    private collider: BoxCollider2D | null = null;
    private sprite: Sprite | null = null;
    private state: ShellState = 'Idle';
    private slideDirection = 1;
    private slideFrameElapsed = 0;
    private slideFrameIndex = 0;
    private wallBounceCooldownRemaining = 0;
    private playerContactQueued = false;
    private enemyContactQueued = false;
    private pendingEnemyColliders: Collider2D[] = [];

    protected onLoad(): void {
        this.setupComponents();
    }

    protected onDestroy(): void {
        this.collider?.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
    }

    protected update(deltaTime: number): void {
        this.wallBounceCooldownRemaining = Math.max(0, this.wallBounceCooldownRemaining - deltaTime);

        if (this.state === 'Sliding') {
            this.applySlidingVelocity();
            this.updateSlidingAnimation(deltaTime);
        }

        if (this.node.worldPosition.y < this.destroyBelowY) {
            this.node.destroy();
        }
    }

    public stopSliding(): void {
        this.state = 'Idle';
        this.slideFrameElapsed = 0;
        this.slideFrameIndex = 0;
        this.applyShellFrame(0);
        this.setBodyVelocity(new Vec2(0, this.body?.linearVelocity.y ?? 0));
    }

    public startSliding(direction: number): void {
        this.state = 'Sliding';
        this.slideDirection = direction < 0 ? -1 : 1;
        this.slideFrameElapsed = 0;
        this.applySlidingVelocity();
        this.applyShellFrame(this.slideFrameIndex);
    }

    private setupComponents(): void {
        let transform = this.node.getComponent(UITransform);
        if (!transform) {
            transform = this.node.addComponent(UITransform);
        }
        transform.setContentSize(this.bodySize.x, this.bodySize.y);

        this.sprite = this.node.getComponent(Sprite);
        if (!this.sprite) {
            this.sprite = this.node.addComponent(Sprite);
        }
        this.applyShellFrame(0);

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
        this.collider.density = Math.max(this.density, 0.01);
        this.collider.friction = Math.max(this.friction, 0);
        this.collider.restitution = Math.max(this.restitution, 0);
        this.collider.apply();

        this.collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        this.collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
    }

    private onBeginContact(_selfCollider: Collider2D, otherCollider: Collider2D): void {
        if (otherCollider.sensor) {
            return;
        }

        const player = otherCollider.node.getComponent(PlayerController);
        if (player) {
            this.queuePlayerContact(player);
            return;
        }

        if (this.state !== 'Sliding') {
            return;
        }

        if (this.hasShellDefeatable(otherCollider)) {
            this.queueEnemyContact(otherCollider);
            return;
        }

        this.tryBounceFromWall(otherCollider);
    }

    private queuePlayerContact(player: PlayerController): void {
        if (this.playerContactQueued) {
            return;
        }

        this.playerContactQueued = true;
        this.scheduleOnce(() => {
            this.playerContactQueued = false;
            this.handlePlayerContact(player);
        }, 0);
    }

    private handlePlayerContact(player: PlayerController): void {
        if (this.state === 'Idle') {
            const direction = this.getKickDirection(player);
            this.startSliding(direction);
            ScoreHudText.addToActiveScore(this.kickScoreValue, this.getScorePopupWorldPosition(player));
            return;
        }

        if (this.isStompedBy(player)) {
            this.stopSliding();
            player.bounceAfterStomp(this.stompBounceSpeed);
            return;
        }

        if (this.canDamageWhileMoving()) {
            player.takeDamage();
        }
    }

    private hasShellDefeatable(otherCollider: Collider2D): boolean {
        if (otherCollider.node.getComponent(GoombaController)) {
            return true;
        }

        const turtle = otherCollider.node.getComponent('TurtleController') as ShellDefeatable | null;
        return !!turtle?.defeatByShell;
    }

    private queueEnemyContact(otherCollider: Collider2D): void {
        this.pendingEnemyColliders.push(otherCollider);

        if (this.enemyContactQueued) {
            return;
        }

        this.enemyContactQueued = true;
        this.scheduleOnce(() => {
            this.enemyContactQueued = false;
            const colliders = this.pendingEnemyColliders.splice(0);
            colliders.forEach((collider) => this.handleEnemyContact(collider));
        }, 0);
    }

    private handleEnemyContact(otherCollider: Collider2D): void {
        if (this.state !== 'Sliding' || !this.canDamageWhileMoving()) {
            return;
        }

        const defeated = this.defeatEnemy(otherCollider);
        if (defeated) {
            ScoreHudText.addToActiveScore(this.enemyHitScoreValue, this.node.worldPosition.clone());
            this.applySlidingVelocity();
        }
    }

    private defeatEnemy(otherCollider: Collider2D): boolean {
        const goomba = otherCollider.node.getComponent(GoombaController);
        if (goomba?.defeatByShell()) {
            return true;
        }

        const turtle = otherCollider.node.getComponent('TurtleController') as ShellDefeatable | null;
        return turtle?.defeatByShell?.() ?? false;
    }

    private tryBounceFromWall(otherCollider: Collider2D): void {
        if (this.state !== 'Sliding' || this.wallBounceCooldownRemaining > 0) {
            return;
        }

        const deltaX = otherCollider.node.worldPosition.x - this.node.worldPosition.x;
        if (Math.abs(deltaX) < Math.max(this.wallBounceMinHorizontalGap, 0)) {
            return;
        }

        this.slideDirection = deltaX > 0 ? -1 : 1;
        this.wallBounceCooldownRemaining = Math.max(this.wallBounceCooldown, 0);
        this.applySlidingVelocity();
    }

    private isStompedBy(player: PlayerController): boolean {
        if (!this.collider || player.getVerticalVelocity() > 0) {
            return false;
        }

        const shellTopY = this.node.worldPosition.y + this.collider.offset.y + this.collider.size.height * 0.5;
        return player.getFootWorldY() >= shellTopY - Math.max(this.stompTolerance, 0);
    }

    private getKickDirection(player: PlayerController): number {
        const deltaX = this.node.worldPosition.x - player.node.worldPosition.x;
        if (Math.abs(deltaX) >= Math.max(this.kickMinPlayerXDistance, 0)) {
            return deltaX < 0 ? -1 : 1;
        }

        return this.slideDirection;
    }

    private getScorePopupWorldPosition(player: PlayerController): Vec3 {
        const position = player.node.worldPosition.clone();
        position.y += 28;
        return position;
    }

    private applySlidingVelocity(): void {
        if (!this.body) {
            return;
        }

        const velocity = this.body.linearVelocity.clone();
        velocity.x = this.slideDirection * Math.abs(this.slideSpeed);
        this.setBodyVelocity(velocity);
    }

    private updateSlidingAnimation(deltaTime: number): void {
        const frameCount = this.getShellFrameCount();
        if (frameCount <= 1) {
            return;
        }

        const interval = Math.max(this.slideFrameInterval, 0.01);
        this.slideFrameElapsed += deltaTime;
        while (this.slideFrameElapsed >= interval) {
            this.slideFrameElapsed -= interval;
            this.slideFrameIndex = (this.slideFrameIndex + 1) % frameCount;
            this.applyShellFrame(this.slideFrameIndex);
        }
    }

    private applyShellFrame(index: number): void {
        if (!this.sprite || this.shellFrames.length === 0) {
            return;
        }

        const frameCount = this.getShellFrameCount();
        this.sprite.spriteFrame = this.shellFrames[index % frameCount];
    }

    private getShellFrameCount(): number {
        return Math.min(this.shellFrames.length, 4);
    }

    private canDamageWhileMoving(): boolean {
        return this.state === 'Sliding'
            && Math.abs(this.body?.linearVelocity.x ?? 0) >= Math.max(this.movingDamageMinSpeed, 0);
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
}
