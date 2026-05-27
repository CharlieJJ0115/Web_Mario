export type AuthUserSession = {
    email: string;
    username: string;
    localId: string;
    idToken: string;
    projectId: string;
};

export class AuthSession {
    private static readonly storageKey = 'mario.authSession';
    private static currentUser: AuthUserSession | null = null;

    public static setCurrentUser(user: AuthUserSession): void {
        this.currentUser = {
            email: user.email,
            username: user.username,
            localId: user.localId,
            idToken: user.idToken,
            projectId: user.projectId,
        };
        this.saveToStorage();
    }

    public static getCurrentUser(): AuthUserSession | null {
        if (this.currentUser) {
            return this.currentUser;
        }

        this.currentUser = this.loadFromStorage();
        return this.currentUser;
    }

    public static clearCurrentUser(): void {
        this.currentUser = null;
        if (typeof localStorage === 'undefined') {
            return;
        }

        localStorage.removeItem(this.storageKey);
    }

    private static saveToStorage(): void {
        if (!this.currentUser || typeof localStorage === 'undefined') {
            return;
        }

        localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser));
    }

    private static loadFromStorage(): AuthUserSession | null {
        if (typeof localStorage === 'undefined') {
            return null;
        }

        const raw = localStorage.getItem(this.storageKey);
        if (!raw) {
            return null;
        }

        try {
            const parsed = JSON.parse(raw) as Partial<AuthUserSession>;
            if (!parsed.email || !parsed.localId || !parsed.idToken) {
                return null;
            }

            return {
                email: parsed.email,
                username: parsed.username || this.getFallbackUsername(parsed.email),
                localId: parsed.localId,
                idToken: parsed.idToken,
                projectId: parsed.projectId || '',
            };
        } catch (_error) {
            localStorage.removeItem(this.storageKey);
            return null;
        }
    }

    private static getFallbackUsername(email: string): string {
        const atIndex = email.indexOf('@');
        if (atIndex <= 0) {
            return 'PLAYER';
        }

        return email.slice(0, atIndex);
    }
}
