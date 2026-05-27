import {
    _decorator,
    BitmapFont,
    Component,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    tween,
    UIOpacity,
    UITransform,
    Vec3,
} from 'cc';

const { ccclass, executeInEditMode, property } = _decorator;

@ccclass('ScoreHudText')
@executeInEditMode
export class ScoreHudText extends Component {
    private static activeInstance: ScoreHudText | null = null;

    @property(Label)
    public scoreLabel: Label | null = null;

    @property(BitmapFont)
    public whiteFont: BitmapFont | null = null;

    @property
    public score = 0;

    @property
    public digits = 8;

    @property
    public minScore = 0;

    @property
    public maxScore = 99999999;

    @property(SpriteFrame)
    public popupSpriteFrame: SpriteFrame | null = null;

    @property
    public popupDuration = 0.6;

    @property
    public popupRiseDistance = 24;

    @property
    public popupScale = 1;

    public static addToActiveScore(amount: number, worldPosition: Vec3): void {
        this.activeInstance?.addScoreWithPopup(amount, worldPosition);
    }

    public static addToActiveScoreAmount(amount: number): void {
        this.activeInstance?.addScore(amount);
    }

    public static getActiveScore(): ScoreHudText | null {
        return this.activeInstance;
    }

    protected onLoad(): void {
        this.refresh();
    }

    protected onEnable(): void {
        ScoreHudText.activeInstance = this;
        this.refresh();
    }

    protected onDisable(): void {
        if (ScoreHudText.activeInstance === this) {
            ScoreHudText.activeInstance = null;
        }
    }

    protected start(): void {
        ScoreHudText.activeInstance = this;
        this.refresh();
    }

    protected onValidate(): void {
        this.refresh();
    }

    public setScore(value: number): void {
        this.score = this.clampScore(value);
        this.refresh();
    }

    public addScore(delta: number): void {
        this.setScore(this.score + delta);
    }

    public addScoreWithPopup(amount: number, worldPosition: Vec3): void {
        this.addScore(amount);
        this.spawnScorePopup(worldPosition);
    }

    public getScore(): number {
        return this.clampScore(this.score);
    }

    public refresh(): void {
        const label = this.resolveScoreLabel();
        if (!label) {
            return;
        }

        this.score = this.clampScore(this.score);
        if (this.whiteFont) {
            this.disableSystemFontIfAvailable(label);
            label.font = this.whiteFont;
        }

        label.string = this.formatScore(this.score);
    }

    private resolveScoreLabel(): Label | null {
        if (this.scoreLabel) {
            return this.scoreLabel;
        }

        this.scoreLabel = this.node.getComponent(Label);
        return this.scoreLabel;
    }

    private formatScore(value: number): string {
        const width = Math.max(1, Math.trunc(this.digits));
        let text = String(value);
        while (text.length < width) {
            text = `0${text}`;
        }
        return text;
    }

    private spawnScorePopup(worldPosition: Vec3): void {
        if (!this.popupSpriteFrame) {
            return;
        }

        const parent = this.node.parent ?? this.node;
        const popupNode = new Node('ScorePopup');
        parent.addChild(popupNode);

        const transform = popupNode.addComponent(UITransform);
        const originalSize = (this.popupSpriteFrame as unknown as {
            originalSize?: { width: number; height: number };
            rect?: { width: number; height: number };
        }).originalSize ?? (this.popupSpriteFrame as unknown as {
            rect?: { width: number; height: number };
        }).rect;
        transform.setContentSize(originalSize?.width ?? 16, originalSize?.height ?? 12);

        const sprite = popupNode.addComponent(Sprite);
        sprite.spriteFrame = this.popupSpriteFrame;

        const opacity = popupNode.addComponent(UIOpacity);
        opacity.opacity = 255;

        const scale = Math.max(this.popupScale, 0.01);
        popupNode.setScale(scale, scale, 1);
        const popupWorldPosition = worldPosition.clone();
        popupWorldPosition.z = parent.worldPosition.z;
        popupNode.setWorldPosition(popupWorldPosition);

        const startPosition = popupNode.position.clone();
        const endPosition = new Vec3(
            startPosition.x,
            startPosition.y + Math.max(this.popupRiseDistance, 0),
            startPosition.z,
        );
        const duration = Math.max(this.popupDuration, 0.01);

        tween(popupNode)
            .to(duration, { position: endPosition })
            .call(() => popupNode.destroy())
            .start();
        tween(opacity)
            .to(duration, { opacity: 0 })
            .start();
    }

    private clampScore(value: number): number {
        const min = Math.min(this.minScore, this.maxScore);
        const max = Math.max(this.minScore, this.maxScore);
        return Math.min(Math.max(Math.trunc(value), min), max);
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
}
