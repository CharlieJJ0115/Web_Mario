import {
    _decorator,
    Button,
    Component,
    Label,
    Node,
} from 'cc';
import { AuthSession } from './AuthSession';
import { FirestorePlayerService, LeaderboardEntry } from './FirestorePlayerService';

const { ccclass, property } = _decorator;

@ccclass('LeaderBoardController')
export class LeaderBoardController extends Component {
    @property(Node)
    public panel: Node | null = null;

    @property(Button)
    public openButton: Button | null = null;

    @property(Button)
    public closeButton: Button | null = null;

    @property([Button])
    public blockingButtons: Button[] = [];

    @property([Label])
    public usernameLabels: Label[] = [];

    @property([Label])
    public scoreLabels: Label[] = [];

    @property
    public scoreDigits = 8;

    @property
    public emptyUsernameText = '---';

    @property
    public emptyScoreText = '00000000';

    private loading = false;

    protected onLoad(): void {
        this.closePanel();
    }

    public openPanel(): void {
        this.setPanelActive(true);
        this.setOpenButtonInteractable(false);
        this.setBlockingButtonsInteractable(false);
        this.clearRows();
        void this.loadLeaderboard();
    }

    public closePanel(): void {
        this.setPanelActive(false);
        this.setOpenButtonInteractable(true);
        this.setBlockingButtonsInteractable(true);
    }

    private async loadLeaderboard(): Promise<void> {
        if (this.loading) {
            return;
        }

        this.loading = true;
        this.setCloseButtonInteractable(false);

        try {
            const session = AuthSession.getCurrentUser();
            if (!session) {
                throw new Error('Player is not signed in.');
            }

            const rows = await FirestorePlayerService.getLeaderboard(session, this.getRowCount());
            this.setRows(rows);
        } catch (error) {
            console.warn('[LeaderBoardController] Failed to load leaderboard.', error);
            this.clearRows();
        } finally {
            this.loading = false;
            this.setCloseButtonInteractable(true);
        }
    }

    private setRows(rows: LeaderboardEntry[]): void {
        const count = this.getRowCount();
        for (let index = 0; index < count; index += 1) {
            const row = rows[index];
            this.setUsername(index, row?.username ?? this.emptyUsernameText);
            this.setScore(index, row ? this.formatScore(row.highScore) : this.emptyScoreText);
        }
    }

    private clearRows(): void {
        const count = this.getRowCount();
        for (let index = 0; index < count; index += 1) {
            this.setUsername(index, this.emptyUsernameText);
            this.setScore(index, this.emptyScoreText);
        }
    }

    private getRowCount(): number {
        return Math.max(this.usernameLabels.length, this.scoreLabels.length, 3);
    }

    private setUsername(index: number, value: string): void {
        const label = this.usernameLabels[index];
        if (label) {
            label.string = value;
        }
    }

    private setScore(index: number, value: string): void {
        const label = this.scoreLabels[index];
        if (label) {
            label.string = value;
        }
    }

    private formatScore(score: number): string {
        const width = Math.max(1, Math.trunc(this.scoreDigits));
        let text = String(Math.max(0, Math.trunc(score)));
        while (text.length < width) {
            text = `0${text}`;
        }
        return text;
    }

    private setPanelActive(active: boolean): void {
        if (this.panel) {
            this.panel.active = active;
        }
    }

    private setOpenButtonInteractable(interactable: boolean): void {
        if (this.openButton) {
            this.openButton.interactable = interactable;
        }
    }

    private setCloseButtonInteractable(interactable: boolean): void {
        if (this.closeButton) {
            this.closeButton.interactable = interactable;
        }
    }

    private setBlockingButtonsInteractable(interactable: boolean): void {
        this.blockingButtons.forEach((button) => {
            if (button) {
                button.interactable = interactable;
            }
        });
    }
}
