import {
    _decorator,
    BitmapFont,
    Component,
    Label,
} from 'cc';

const { ccclass, executeInEditMode, property } = _decorator;

@ccclass('LifeHudText')
@executeInEditMode
export class LifeHudText extends Component {
    @property(Label)
    public lifeLabel: Label | null = null;

    @property(BitmapFont)
    public whiteFont: BitmapFont | null = null;

    @property
    public lives = 5;

    @property
    public minLives = 0;

    @property
    public maxLives = 9;

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

    public setLives(value: number): void {
        this.lives = this.clampLives(value);
        this.refresh();
    }

    public addLives(delta: number): void {
        this.setLives(this.lives + delta);
    }

    public getLives(): number {
        return this.clampLives(this.lives);
    }

    public refresh(): void {
        const label = this.resolveLifeLabel();
        if (!label) {
            return;
        }

        this.lives = this.clampLives(this.lives);
        if (this.whiteFont) {
            this.disableSystemFontIfAvailable(label);
            label.font = this.whiteFont;
        }

        label.string = String(this.lives);
    }

    private resolveLifeLabel(): Label | null {
        if (this.lifeLabel) {
            return this.lifeLabel;
        }

        this.lifeLabel = this.node.getComponent(Label);
        return this.lifeLabel;
    }

    private clampLives(value: number): number {
        const min = Math.min(this.minLives, this.maxLives);
        const max = Math.max(this.minLives, this.maxLives);
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
