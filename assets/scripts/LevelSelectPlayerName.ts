import {
    _decorator,
    Component,
    Label,
    UITransform,
} from 'cc';
import { AuthSession } from './AuthSession';
import { FirestorePlayerService } from './FirestorePlayerService';

const { ccclass, property } = _decorator;

@ccclass('LevelSelectPlayerName')
export class LevelSelectPlayerName extends Component {
    @property(Label)
    public playerNameLabel: Label | null = null;

    @property
    public fallbackName = 'PLAYER';

    @property
    public prefix = '';

    @property(Label)
    public highScoreLabel: Label | null = null;

    @property
    public highScorePrefix = 'HIGH SCORE ';

    @property
    public highScoreDigits = 8;

    @property
    public lockPlayerNameX = true;

    @property
    public playerNameLeftX = 0;

    @property
    public lockHighScoreX = true;

    @property
    public highScoreLeftX = 0;

    protected onLoad(): void {
        void this.refresh();
    }

    protected onEnable(): void {
        void this.refresh();
    }

    public async refresh(): Promise<void> {
        const label = this.resolveLabel();
        if (!label) {
            return;
        }

        const user = AuthSession.getCurrentUser();
        const playerName = user?.username || user?.email || this.fallbackName;
        this.setPlayerName(label, playerName);
        this.setHighScore(0);

        if (!user) {
            return;
        }

        try {
            const profile = await FirestorePlayerService.getPlayerProfile(user);
            if (!profile) {
                return;
            }

            this.setPlayerName(label, profile.username || playerName);
            this.setHighScore(profile.highScore);
        } catch (error) {
            console.warn('[LevelSelectPlayerName] Failed to load Firestore player profile.', error);
        }
    }

    private resolveLabel(): Label | null {
        if (this.playerNameLabel) {
            return this.playerNameLabel;
        }

        this.playerNameLabel = this.node.getComponent(Label);
        return this.playerNameLabel;
    }

    private setHighScore(score: number): void {
        if (!this.highScoreLabel) {
            return;
        }

        this.highScoreLabel.string = `${this.highScorePrefix}${this.formatHighScore(score)}`;
        this.lockLabelX(this.highScoreLabel, this.lockHighScoreX, this.highScoreLeftX);
    }

    private setPlayerName(label: Label, playerName: string): void {
        label.string = `${this.prefix}${playerName}`;
        this.lockLabelLeftX(label, this.lockPlayerNameX, this.playerNameLeftX);
    }

    private lockLabelX(label: Label, enabled: boolean, x: number): void {
        if (!enabled) {
            return;
        }

        const currentPosition = label.node.position;
        label.node.setPosition(x, currentPosition.y, currentPosition.z);
    }

    private lockLabelLeftX(label: Label, enabled: boolean, leftX: number): void {
        if (!enabled) {
            return;
        }

        const transform = label.node.getComponent(UITransform);
        if (!transform) {
            this.lockLabelX(label, enabled, leftX);
            return;
        }

        const currentPosition = label.node.position;
        const nodeX = leftX + transform.width * transform.anchorPoint.x;
        label.node.setPosition(nodeX, currentPosition.y, currentPosition.z);
    }

    private formatHighScore(score: number): string {
        const width = Math.max(1, Math.trunc(this.highScoreDigits));
        let text = String(Math.max(0, Math.trunc(score)));
        while (text.length < width) {
            text = `0${text}`;
        }
        return text;
    }
}
