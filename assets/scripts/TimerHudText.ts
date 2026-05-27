import {
    _decorator,
    BitmapFont,
    Component,
    director,
    Label,
} from 'cc';
import { EDITOR } from 'cc/env';

const { ccclass, executeInEditMode, property } = _decorator;

@ccclass('TimerHudText')
@executeInEditMode
export class TimerHudText extends Component {
    private static activeInstance: TimerHudText | null = null;

    @property(Label)
    public timerLabel: Label | null = null;

    @property(BitmapFont)
    public whiteFont: BitmapFont | null = null;

    @property
    public startSeconds = 300;

    @property
    public gameOverSceneName = 'GameOver';

    private remainingSeconds = 300;
    private elapsed = 0;
    private gameOverTriggered = false;
    private paused = false;

    public static getActiveTimer(): TimerHudText | null {
        return this.activeInstance;
    }

    protected onLoad(): void {
        this.resetTimer();
        this.refresh();
    }

    protected onEnable(): void {
        TimerHudText.activeInstance = this;
        this.refresh();
    }

    protected onDisable(): void {
        if (TimerHudText.activeInstance === this) {
            TimerHudText.activeInstance = null;
        }
    }

    protected start(): void {
        if (EDITOR) {
            this.resetTimer();
            this.refresh();
            return;
        }

        this.resetTimer();
        this.refresh();
        TimerHudText.activeInstance = this;
    }

    protected onValidate(): void {
        this.resetTimer();
        this.refresh();
    }

    protected update(deltaTime: number): void {
        if (EDITOR || this.paused || this.gameOverTriggered || this.remainingSeconds <= 0) {
            return;
        }

        this.elapsed += deltaTime;
        while (this.elapsed >= 1 && this.remainingSeconds > 0) {
            this.elapsed -= 1;
            this.remainingSeconds -= 1;
        }

        this.refresh();

        if (this.remainingSeconds <= 0) {
            this.triggerGameOver();
        }
    }

    private resetTimer(): void {
        this.remainingSeconds = Math.max(0, Math.trunc(this.startSeconds));
        this.elapsed = 0;
        this.gameOverTriggered = false;
        this.paused = false;
    }

    public pauseTimer(): void {
        this.paused = true;
        this.elapsed = 0;
        this.refresh();
    }

    public getRemainingSeconds(): number {
        return Math.max(0, Math.trunc(this.remainingSeconds));
    }

    private refresh(): void {
        const label = this.resolveTimerLabel();
        if (!label) {
            return;
        }

        if (this.whiteFont) {
            this.disableSystemFontIfAvailable(label);
            label.font = this.whiteFont;
        }

        label.string = String(Math.max(0, this.remainingSeconds));
    }

    private triggerGameOver(): void {
        if (this.gameOverTriggered) {
            return;
        }

        this.gameOverTriggered = true;
        director.loadScene(this.gameOverSceneName);
    }

    private resolveTimerLabel(): Label | null {
        if (this.timerLabel) {
            return this.timerLabel;
        }

        this.timerLabel = this.node.getComponent(Label);
        return this.timerLabel;
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
