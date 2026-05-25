import {
    _decorator,
    BitmapFont,
    Component,
    Label,
} from 'cc';

const { ccclass, executeInEditMode, property } = _decorator;

@ccclass('LevelHudText')
@executeInEditMode
export class LevelHudText extends Component {
    @property(Label)
    public label: Label | null = null;

    @property(Label)
    public prefixLabel: Label | null = null;

    @property(Label)
    public levelLabel: Label | null = null;

    @property(BitmapFont)
    public yellowFont: BitmapFont | null = null;

    @property
    public useSplitLabels = true;

    @property
    public prefix = 'LEVEL';

    @property
    public level = 1;

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

    public refresh(): void {
        if (this.useSplitLabels && this.prefixLabel && this.levelLabel) {
            this.refreshSplitLabels();
            return;
        }

        const label = this.resolveLabel();
        if (!label) {
            return;
        }

        if (this.yellowFont) {
            this.disableSystemFontIfAvailable(label);
            label.font = this.yellowFont;
        }

        label.string = `${this.normalizedPrefix()}${this.level}`;
    }

    private refreshSplitLabels(): void {
        if (!this.prefixLabel || !this.levelLabel) {
            return;
        }

        this.applyFontIfAssigned(this.prefixLabel);
        this.applyFontIfAssigned(this.levelLabel);

        this.prefixLabel.string = this.normalizedPrefix();
        this.levelLabel.string = String(this.level);
    }

    private applyFontIfAssigned(label: Label): void {
        if (!this.yellowFont) {
            return;
        }

        this.disableSystemFontIfAvailable(label);
        label.font = this.yellowFont;
    }

    private normalizedPrefix(): string {
        return this.prefix.toUpperCase();
    }

    private resolveLabel(): Label | null {
        if (this.label) {
            return this.label;
        }

        this.label = this.node.getComponent(Label);
        return this.label;
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
