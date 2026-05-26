import {
    _decorator,
    AudioClip,
    AudioSource,
    BoxCollider2D,
    Collider2D,
    Component,
    Contact2DType,
    ERigidBody2DType,
    Node,
    RigidBody2D,
    Size,
    Sprite,
    SpriteFrame,
    tween,
    UITransform,
    Vec3,
} from 'cc';
import { MushroomController } from './MushroomController';
import { PlayerController } from './PlayerController';
import { ScoreHudText } from './ScoreHudText';

const { ccclass, property } = _decorator;

@ccclass('QuestionBlockController')
export class QuestionBlockController extends Component {
    @property([SpriteFrame])
    public animationFrames: SpriteFrame[] = [];

    @property(SpriteFrame)
    public usedFrame: SpriteFrame | null = null;

    @property
    public frameInterval = 0.12;

    @property
    public bounceHeight = 8;

    @property
    public bounceDuration = 0.08;

    @property
    public spawnMushroom = true;

    @property(SpriteFrame)
    public mushroomSpriteFrame: SpriteFrame | null = null;

    @property
    public mushroomRiseHeight = 16;

    @property
    public mushroomRiseDuration = 0.35;

    @property
    public mushroomMoveSpeed = 3;

    @property
    public scoreValue = 100;

    @property(AudioClip)
    public mushroomAppearSound: AudioClip | null = null;

    @property
    public sfxVolume = 1;

    private sprite: Sprite | null = null;
    private body: RigidBody2D | null = null;
    private collider: BoxCollider2D | null = null;
    private sfxSource: AudioSource | null = null;
    private frameIndex = 0;
    private frameElapsed = 0;
    private used = false;
    private bouncing = false;

    protected onLoad(): void {
        this.setupComponents();
    }

    protected onDestroy(): void {
        this.collider?.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
    }

    protected update(deltaTime: number): void {
        this.updateAnimation(deltaTime);
    }

    private setupComponents(): void {
        let transform = this.node.getComponent(UITransform);
        if (!transform) {
            transform = this.node.addComponent(UITransform);
        }
        transform.setContentSize(16, 16);

        this.sprite = this.node.getComponent(Sprite);
        if (!this.sprite) {
            this.sprite = this.node.addComponent(Sprite);
        }

        if (!this.sprite.spriteFrame && this.animationFrames.length > 0) {
            this.sprite.spriteFrame = this.animationFrames[0];
        }
        this.syncAnimationFrameIndexWithSprite();

        this.body = this.node.getComponent(RigidBody2D);
        if (!this.body) {
            this.body = this.node.addComponent(RigidBody2D);
        }
        this.body.type = ERigidBody2DType.Static;
        this.body.enabledContactListener = true;

        this.collider = this.node.getComponent(BoxCollider2D);
        if (!this.collider) {
            this.collider = this.node.addComponent(BoxCollider2D);
        }
        this.collider.sensor = false;
        this.collider.size = new Size(16, 16);
        this.collider.apply();
        this.collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        this.setupSfxSource();
    }

    private syncAnimationFrameIndexWithSprite(): void {
        if (!this.sprite?.spriteFrame) {
            return;
        }

        const currentFrameIndex = this.animationFrames.indexOf(this.sprite.spriteFrame);
        if (currentFrameIndex >= 0) {
            this.frameIndex = currentFrameIndex;
        }
    }

    private updateAnimation(deltaTime: number): void {
        if (this.used || this.animationFrames.length === 0 || !this.sprite) {
            return;
        }

        const interval = Math.max(this.frameInterval, 0.01);
        this.frameElapsed += deltaTime;
        while (this.frameElapsed >= interval) {
            this.frameElapsed -= interval;
            this.frameIndex = (this.frameIndex + 1) % this.animationFrames.length;
        }

        this.sprite.spriteFrame = this.animationFrames[this.frameIndex];
    }

    private onBeginContact(_selfCollider: Collider2D, otherCollider: Collider2D): void {
        if (this.used || this.bouncing || otherCollider.sensor) {
            return;
        }

        const player = otherCollider.node.getComponent(PlayerController);
        const playerBody = otherCollider.node.getComponent(RigidBody2D);
        if (!player || !playerBody) {
            return;
        }

        const playerIsBelowBlock = player.node.worldPosition.y < this.node.worldPosition.y;
        const playerIsMovingUp = playerBody.linearVelocity.y > 0;
        if (!playerIsBelowBlock || !playerIsMovingUp) {
            return;
        }

        this.activateBlock(player);
    }

    private activateBlock(player: PlayerController): void {
        this.used = true;
        this.bouncing = true;
        this.spawnMushroomFromBlock();
        ScoreHudText.addToActiveScore(this.scoreValue, this.getScorePopupWorldPosition(player));

        if (this.sprite && this.usedFrame) {
            this.sprite.spriteFrame = this.usedFrame;
        }

        const originalPosition = this.node.position.clone();
        const raisedPosition = new Vec3(
            originalPosition.x,
            originalPosition.y + this.bounceHeight,
            originalPosition.z,
        );
        const duration = Math.max(this.bounceDuration, 0.01);

        tween(this.node)
            .to(duration, { position: raisedPosition })
            .to(duration, { position: originalPosition })
            .call(() => {
                this.node.setPosition(originalPosition);
                this.bouncing = false;
            })
            .start();
    }

    private getScorePopupWorldPosition(player: PlayerController): Vec3 {
        const position = player.node.worldPosition.clone();
        position.y += 28;
        return position;
    }

    private spawnMushroomFromBlock(): void {
        if (!this.spawnMushroom || !this.node.parent) {
            return;
        }

        this.playSfx(this.mushroomAppearSound);

        const mushroomNode = new Node('Mushroom');
        this.node.parent.addChild(mushroomNode);

        const blockPosition = this.node.position;
        const startPosition = new Vec3(
            blockPosition.x,
            blockPosition.y,
            blockPosition.z,
        );
        const endPosition = new Vec3(
            blockPosition.x,
            blockPosition.y + Math.max(this.mushroomRiseHeight, 0),
            blockPosition.z,
        );

        mushroomNode.setPosition(startPosition);

        const transform = mushroomNode.addComponent(UITransform);
        transform.setContentSize(16, 16);

        const sprite = mushroomNode.addComponent(Sprite);
        if (this.mushroomSpriteFrame) {
            sprite.spriteFrame = this.mushroomSpriteFrame;
        }

        tween(mushroomNode)
            .to(Math.max(this.mushroomRiseDuration, 0.01), { position: endPosition })
            .call(() => {
                const mushroom = mushroomNode.addComponent(MushroomController);
                mushroom.moveSpeed = this.mushroomMoveSpeed;
                mushroom.startMoving();
            })
            .start();
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

        this.sfxSource?.playOneShot(clip, this.normalizeSfxVolume(this.sfxVolume));
    }

    private normalizeSfxVolume(value: number): number {
        return Math.max(value, 0);
    }
}
