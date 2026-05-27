import {
    _decorator,
    AudioClip,
    AudioSource,
    BitmapFont,
    Camera,
    Color,
    Component,
    director,
    Label,
    LabelOutline,
    Node,
    Sprite,
    SpriteFrame,
    UITransform,
    Vec2,
    Vec3,
} from 'cc';
import { GameFlowState } from './GameFlowState';
import { AuthSession } from './AuthSession';
import { FirestorePlayerService } from './FirestorePlayerService';
import { PlayerController } from './PlayerController';
import { ScoreHudText } from './ScoreHudText';
import { TimerHudText } from './TimerHudText';

const { ccclass, property } = _decorator;

@ccclass('LevelClearFlagController')
export class LevelClearFlagController extends Component {
    @property
    public redirectSceneName = 'LevelSelect';

    @property
    public redirectDelaySeconds = 4;

    @property(AudioClip)
    public levelClearSound: AudioClip | null = null;

    @property
    public sfxVolume = 1;

    @property(Node)
    public overlayRoot: Node | null = null;

    @property(Camera)
    public camera: Camera | null = null;

    @property(PlayerController)
    public player: PlayerController | null = null;

    @property(Node)
    public spriteNode: Node | null = null;

    @property
    public applySpriteOffset = false;

    @property(Vec2)
    public spriteOffset = new Vec2(0, 0);

    @property
    public levelClearText = 'LEVEL CLEARED!';

    @property(BitmapFont)
    public whiteFont: BitmapFont | null = null;

    @property(Vec2)
    public overlayOffset = new Vec2(0, 88);

    @property(SpriteFrame)
    public timerSpriteFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public multipleSpriteFrame: SpriteFrame | null = null;

    @property(Vec2)
    public titlePosition = new Vec2(0, 40);

    @property(Vec2)
    public bonusRowPosition = new Vec2(0, -20);

    @property
    public bonusIconScale = 1;

    @property(Vec2)
    public timerIconPosition = new Vec2(-95, 0);

    @property(Vec2)
    public timerTextPosition = new Vec2(-55, 0);

    @property(Vec2)
    public multipleIconPosition = new Vec2(0, 0);

    @property(Vec2)
    public multiplierTextPosition = new Vec2(38, 0);

    @property(Vec2)
    public equalsTextPosition = new Vec2(76, 0);

    @property
    public equalsFontSize = 20;

    @property
    public equalsTextWidth = 32;

    @property(Vec2)
    public bonusScoreTextPosition = new Vec2(135, 0);

    @property
    public titleFontSize = 36;

    @property
    public bonusFontSize = 28;

    @property
    public awardTimerBonus = true;

    @property
    public timerBonusMultiplier = 50;

    private sfxSource: AudioSource | null = null;
    private triggered = false;

    protected onLoad(): void {
        this.setupSfxSource();
        this.syncSpriteOffset();
    }

    protected onValidate(): void {
        this.syncSpriteOffset();
    }

    protected update(): void {
        if (this.triggered) {
            return;
        }

        const player = this.resolvePlayer();
        if (!player) {
            return;
        }

        if (player.node.worldPosition.x >= this.node.worldPosition.x) {
            this.triggerLevelClear(player);
        }
    }

    private setupSfxSource(): void {
        this.sfxSource = this.node.getComponent(AudioSource);
        if (!this.sfxSource) {
            this.sfxSource = this.node.addComponent(AudioSource);
        }
    }

    private syncSpriteOffset(): void {
        const sprite = this.resolveSpriteNode();
        if (!sprite || !this.applySpriteOffset) {
            return;
        }

        const currentPosition = sprite.position;
        sprite.setPosition(this.spriteOffset.x, this.spriteOffset.y, currentPosition.z);
    }

    private resolveSpriteNode(): Node | null {
        if (this.spriteNode) {
            return this.spriteNode;
        }

        this.spriteNode = this.node.getChildByName('FlagSprite')
            ?? this.node.getChildByName('Visual')
            ?? this.node.getChildByName('sprite');
        return this.spriteNode;
    }

    private triggerLevelClear(player: PlayerController): void {
        if (this.triggered) {
            return;
        }

        if (!player.enterLevelClearState()) {
            return;
        }

        this.triggered = true;

        const timer = this.findActiveTimer();
        const remainingSeconds = timer?.getRemainingSeconds() ?? 0;
        timer?.pauseTimer();

        const bonusScore = this.applyTimerBonus(remainingSeconds);
        this.saveHighScoreIfNeeded();
        this.playLevelClearSound();
        this.showLevelClearOverlay(remainingSeconds, bonusScore);
        this.scheduleOnce(this.redirectAfterClear, Math.max(this.redirectDelaySeconds, 0));
    }

    private resolvePlayer(): PlayerController | null {
        if (this.player) {
            return this.player;
        }

        const scene = director.getScene();
        this.player = scene ? this.findPlayerInChildren(scene) : null;
        return this.player;
    }

    private applyTimerBonus(remainingSeconds: number): number {
        if (!this.awardTimerBonus) {
            return 0;
        }

        const multiplier = Math.max(0, Math.trunc(this.timerBonusMultiplier));
        const bonus = Math.max(0, Math.trunc(remainingSeconds)) * multiplier;
        if (bonus > 0) {
            ScoreHudText.addToActiveScoreAmount(bonus);
        }
        return bonus;
    }

    private saveHighScoreIfNeeded(): void {
        const session = AuthSession.getCurrentUser();
        if (!session) {
            return;
        }

        const finalScore = ScoreHudText.getActiveScore()?.getScore() ?? 0;
        void FirestorePlayerService.updateHighScoreIfBetter(session, finalScore).catch((error: unknown) => {
            console.warn('[LevelClearFlagController] Failed to update Firestore high score.', error);
        });
    }

    private playLevelClearSound(): void {
        if (!this.levelClearSound) {
            return;
        }

        if (!this.sfxSource) {
            this.setupSfxSource();
        }

        this.sfxSource?.playOneShot(this.levelClearSound, Math.max(this.sfxVolume, 0));
    }

    private showLevelClearOverlay(remainingSeconds: number, bonusScore: number): void {
        const parent = this.resolveOverlayParent();
        if (!parent) {
            return;
        }

        const existing = parent.getChildByName('LevelClearOverlay');
        if (existing) {
            existing.destroy();
        }

        const overlayNode = new Node('LevelClearOverlay');
        parent.addChild(overlayNode);
        const overlayTransform = overlayNode.addComponent(UITransform);
        overlayTransform.setContentSize(480, 160);
        this.positionOverlayNode(overlayNode, parent);

        this.createLabelNode(
            overlayNode,
            this.levelClearText,
            new Vec3(this.titlePosition.x, this.titlePosition.y, 0),
            this.titleFontSize,
            460,
        );

        if (this.awardTimerBonus) {
            this.createBonusRow(overlayNode, remainingSeconds, bonusScore);
        }
    }

    private createBonusRow(parent: Node, remainingSeconds: number, bonusScore: number): void {
        const secondsText = String(Math.max(0, Math.trunc(remainingSeconds)));
        const multiplierText = String(Math.max(0, Math.trunc(this.timerBonusMultiplier)));
        const scoreText = String(Math.max(0, Math.trunc(bonusScore)));
        const rowPosition = new Vec3(this.bonusRowPosition.x, this.bonusRowPosition.y, 0);

        if (!this.timerSpriteFrame || !this.multipleSpriteFrame) {
            this.createLabelNode(
                parent,
                `${secondsText} x ${multiplierText} = ${scoreText}`,
                rowPosition,
                this.bonusFontSize,
                460,
            );
            return;
        }

        const rowNode = new Node('LevelClearBonusRow');
        parent.addChild(rowNode);
        rowNode.setPosition(rowPosition);
        const rowTransform = rowNode.addComponent(UITransform);
        rowTransform.setContentSize(460, Math.max(this.bonusFontSize + 16, 48));

        this.createSpriteNode(rowNode, 'TimerIcon', this.timerSpriteFrame, this.toVec3(this.timerIconPosition));
        this.createLabelNode(rowNode, secondsText, this.toVec3(this.timerTextPosition), this.bonusFontSize, 76);
        this.createSpriteNode(rowNode, 'MultipleIcon', this.multipleSpriteFrame, this.toVec3(this.multipleIconPosition));
        this.createLabelNode(rowNode, multiplierText, this.toVec3(this.multiplierTextPosition), this.bonusFontSize, 64);
        this.createPlainLabelNode(
            rowNode,
            '=',
            this.toVec3(this.equalsTextPosition),
            this.equalsFontSize,
            this.equalsTextWidth,
        );
        this.createLabelNode(rowNode, scoreText, this.toVec3(this.bonusScoreTextPosition), this.bonusFontSize, 132);
    }

    private toVec3(position: Vec2): Vec3 {
        return new Vec3(position.x, position.y, 0);
    }

    private createSpriteNode(parent: Node, name: string, spriteFrame: SpriteFrame, position: Vec3): void {
        const spriteNode = new Node(name);
        parent.addChild(spriteNode);
        spriteNode.setPosition(position);

        const transform = spriteNode.addComponent(UITransform);
        const size = this.getSpriteFrameSize(spriteFrame);
        const scale = Math.max(this.bonusIconScale, 0.01);
        transform.setContentSize(size.x, size.y);
        spriteNode.setScale(scale, scale, 1);

        const sprite = spriteNode.addComponent(Sprite);
        sprite.spriteFrame = spriteFrame;
    }

    private getSpriteFrameSize(spriteFrame: SpriteFrame): Vec2 {
        const frame = spriteFrame as unknown as {
            rect?: { width?: number; height?: number };
            originalSize?: { width?: number; height?: number };
            getRect?: () => { width?: number; height?: number };
            getOriginalSize?: () => { width?: number; height?: number };
        };
        const rect = frame.getRect?.() ?? frame.rect;
        if (rect?.width && rect?.height) {
            return new Vec2(rect.width, rect.height);
        }
        const originalSize = frame.getOriginalSize?.() ?? frame.originalSize;
        if (originalSize?.width && originalSize?.height) {
            return new Vec2(originalSize.width, originalSize.height);
        }
        return new Vec2(24, 24);
    }

    private createLabelNode(parent: Node, text: string, position: Vec3, fontSize: number, width: number): void {
        const labelNode = new Node(text);
        parent.addChild(labelNode);
        labelNode.setPosition(position);

        const transform = labelNode.addComponent(UITransform);
        transform.setContentSize(width, Math.max(fontSize + 12, 40));

        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 8;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = Color.WHITE;
        const whiteFont = this.resolveWhiteFont();
        if (whiteFont) {
            this.disableSystemFontIfAvailable(label);
            label.font = whiteFont;
        }

        const outline = labelNode.addComponent(LabelOutline);
        outline.color = Color.BLACK;
        outline.width = 4;
    }

    private createPlainLabelNode(parent: Node, text: string, position: Vec3, fontSize: number, width: number): void {
        const labelNode = new Node(text);
        parent.addChild(labelNode);
        labelNode.setPosition(position);

        const transform = labelNode.addComponent(UITransform);
        transform.setContentSize(width, Math.max(fontSize + 12, 40));

        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 8;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = Color.WHITE;

        const outline = labelNode.addComponent(LabelOutline);
        outline.color = Color.BLACK;
        outline.width = 2;
    }

    private resolveWhiteFont(): BitmapFont | null {
        return this.whiteFont
            ?? ScoreHudText.getActiveScore()?.whiteFont
            ?? TimerHudText.getActiveTimer()?.whiteFont
            ?? null;
    }

    private disableSystemFontIfAvailable(label: Label): void {
        const labelWithSystemFontFlag = label as unknown as {
            useSystemFont?: boolean;
            isSystemFontUsed?: boolean;
            _useSystemFont?: boolean;
            _isSystemFontUsed?: boolean;
        };

        if ('useSystemFont' in labelWithSystemFontFlag) {
            labelWithSystemFontFlag.useSystemFont = false;
        }
        if ('isSystemFontUsed' in labelWithSystemFontFlag) {
            labelWithSystemFontFlag.isSystemFontUsed = false;
        }
        if ('_useSystemFont' in labelWithSystemFontFlag) {
            labelWithSystemFontFlag._useSystemFont = false;
        }
        if ('_isSystemFontUsed' in labelWithSystemFontFlag) {
            labelWithSystemFontFlag._isSystemFontUsed = false;
        }
    }

    private positionOverlayNode(overlayNode: Node, parent: Node): void {
        if (this.overlayRoot) {
            overlayNode.setPosition(this.overlayOffset.x, this.overlayOffset.y, 0);
            return;
        }

        const camera = this.resolveCamera();
        if (camera) {
            const cameraPosition = camera.node.worldPosition;
            overlayNode.setWorldPosition(
                cameraPosition.x + this.overlayOffset.x,
                cameraPosition.y + this.overlayOffset.y,
                parent.worldPosition.z,
            );
            return;
        }

        overlayNode.setPosition(this.overlayOffset.x, this.overlayOffset.y, 0);
    }

    private resolveOverlayParent(): Node | null {
        if (this.overlayRoot) {
            return this.overlayRoot;
        }

        const scene = director.getScene();
        if (!scene) {
            return this.node.parent ?? this.node;
        }

        return this.findNodeByName(scene, 'HUD')
            ?? this.findNodeByName(scene, 'Canvas')
            ?? scene;
    }

    private resolveCamera(): Camera | null {
        if (this.camera) {
            return this.camera;
        }

        const scene = director.getScene();
        if (!scene) {
            return null;
        }

        return this.findCameraInChildren(scene);
    }

    private findActiveTimer(): TimerHudText | null {
        const activeTimer = TimerHudText.getActiveTimer();
        if (activeTimer) {
            return activeTimer;
        }

        const scene = director.getScene();
        return scene ? this.findTimerInChildren(scene) : null;
    }

    private findNodeByName(node: Node, name: string): Node | null {
        if (node.name === name) {
            return node;
        }

        for (const child of node.children) {
            const found = this.findNodeByName(child, name);
            if (found) {
                return found;
            }
        }

        return null;
    }

    private findPlayerInChildren(node: Node): PlayerController | null {
        const player = node.getComponent(PlayerController);
        if (player) {
            return player;
        }

        for (const child of node.children) {
            const found = this.findPlayerInChildren(child);
            if (found) {
                return found;
            }
        }

        return null;
    }

    private findCameraInChildren(node: Node): Camera | null {
        const camera = node.getComponent(Camera);
        if (camera) {
            return camera;
        }

        for (const child of node.children) {
            const found = this.findCameraInChildren(child);
            if (found) {
                return found;
            }
        }

        return null;
    }

    private findTimerInChildren(node: Node): TimerHudText | null {
        const timer = node.getComponent(TimerHudText);
        if (timer) {
            return timer;
        }

        for (const child of node.children) {
            const found = this.findTimerInChildren(child);
            if (found) {
                return found;
            }
        }

        return null;
    }

    private readonly redirectAfterClear = (): void => {
        GameFlowState.resetForLevelSelect();
        director.loadScene(this.redirectSceneName || GameFlowState.levelSelectSceneName);
    };
}
