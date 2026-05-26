export class GameFlowState {
    public static currentLives = 5;
    public static maxLives = 5;
    public static pendingLevelScene = 'Level_1';
    public static levelSelectSceneName = 'LevelSelect';
    public static gameStartSceneName = 'GameStart';
    public static gameOverSceneName = 'GameOver';

    private static activeRun = false;

    public static startNewGame(levelSceneName: string, initialLives: number): void {
        const lives = Math.max(1, Math.trunc(initialLives));
        this.currentLives = lives;
        this.maxLives = lives;
        this.pendingLevelScene = levelSceneName || this.pendingLevelScene;
        this.activeRun = true;
    }

    public static loseLifeAndCheckContinue(fallbackLives: number): boolean {
        if (!this.activeRun) {
            const lives = Math.max(1, Math.trunc(fallbackLives));
            this.currentLives = lives;
            this.maxLives = Math.max(this.maxLives, lives);
            this.activeRun = true;
        }

        this.currentLives = Math.max(0, this.currentLives - 1);
        return this.currentLives > 0;
    }

    public static resetForLevelSelect(): void {
        this.currentLives = this.maxLives;
        this.activeRun = false;
    }

    public static hasActiveRun(): boolean {
        return this.activeRun;
    }
}
