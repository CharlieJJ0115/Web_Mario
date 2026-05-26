import {
    _decorator,
    BitmapFont,
    Component,
    Label,
} from 'cc';

const { ccclass, executeInEditMode, property } = _decorator;

@ccclass('ScoreHudText')
@executeInEditMode
export class ScoreHudText extends Component {
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

    protected onLoad(): void {
        this.refresh();
    }

    protected onEnable(): void {
        this.refresh();
    }

    protected start(): void {
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
        return String(value).padStart(width, '0');
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
