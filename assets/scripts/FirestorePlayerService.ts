import { AuthUserSession } from './AuthSession';

export type PlayerProfile = {
    email: string;
    username: string;
    highScore: number;
};

type FirestoreDocument = {
    fields?: Record<string, FirestoreValue>;
};

type FirestoreValue = {
    stringValue?: string;
    integerValue?: string;
    timestampValue?: string;
};

export class FirestorePlayerService {
    public static async upsertPlayerProfile(session: AuthUserSession): Promise<PlayerProfile> {
        this.requireSession(session);

        const existing = await this.getPlayerProfile(session);
        const profile: PlayerProfile = {
            email: session.email,
            username: session.username || this.getFallbackUsername(session.email),
            highScore: existing?.highScore ?? 0,
        };

        await this.patchPlayerDocument(session, {
            email: this.stringValue(profile.email),
            username: this.stringValue(profile.username),
            highScore: this.integerValue(profile.highScore),
            updatedAt: this.timestampValue(new Date()),
        });

        return profile;
    }

    public static async getPlayerProfile(session: AuthUserSession): Promise<PlayerProfile | null> {
        this.requireSession(session);

        const response = await fetch(this.getPlayerDocumentUrl(session), {
            method: 'GET',
            headers: this.getAuthHeaders(session),
        });

        if (response.status === 404) {
            return null;
        }

        const payload = await this.readJson(response);
        if (!response.ok) {
            throw new Error(this.getFirestoreErrorMessage(payload, 'Failed to read player profile.'));
        }

        return this.toPlayerProfile(payload as FirestoreDocument, session);
    }

    public static async updateHighScoreIfBetter(session: AuthUserSession, score: number): Promise<number> {
        this.requireSession(session);

        const normalizedScore = Math.max(0, Math.trunc(score));
        const existing = await this.getPlayerProfile(session);
        const previousHighScore = existing?.highScore ?? 0;

        if (normalizedScore <= previousHighScore) {
            return previousHighScore;
        }

        await this.patchPlayerDocument(session, {
            email: this.stringValue(existing?.email || session.email),
            username: this.stringValue(existing?.username || session.username || this.getFallbackUsername(session.email)),
            highScore: this.integerValue(normalizedScore),
            updatedAt: this.timestampValue(new Date()),
        });

        return normalizedScore;
    }

    private static async patchPlayerDocument(session: AuthUserSession, fields: Record<string, FirestoreValue>): Promise<void> {
        const response = await fetch(this.getPlayerDocumentUrl(session, Object.keys(fields)), {
            method: 'PATCH',
            headers: this.getAuthHeaders(session),
            body: JSON.stringify({ fields }),
        });

        if (!response.ok) {
            const payload = await this.readJson(response);
            throw new Error(this.getFirestoreErrorMessage(payload, 'Failed to update player profile.'));
        }
    }

    private static getPlayerDocumentUrl(session: AuthUserSession, updateFields: string[] = []): string {
        const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(session.projectId)}`
            + `/databases/(default)/documents/users/${encodeURIComponent(session.localId)}`;

        if (updateFields.length === 0) {
            return baseUrl;
        }

        const query = updateFields
            .map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
            .join('&');
        return `${baseUrl}?${query}`;
    }

    private static getAuthHeaders(session: AuthUserSession): Record<string, string> {
        return {
            Authorization: `Bearer ${session.idToken}`,
            'Content-Type': 'application/json',
        };
    }

    private static requireSession(session: AuthUserSession): void {
        if (!session.projectId) {
            throw new Error('Firebase project ID is not set.');
        }
        if (!session.localId || !session.idToken) {
            throw new Error('Player is not signed in.');
        }
    }

    private static toPlayerProfile(document: FirestoreDocument, session: AuthUserSession): PlayerProfile {
        const fields = document.fields ?? {};
        return {
            email: fields.email?.stringValue || session.email,
            username: fields.username?.stringValue || session.username || this.getFallbackUsername(session.email),
            highScore: this.toInteger(fields.highScore?.integerValue),
        };
    }

    private static toInteger(value: string | undefined): number {
        const parsed = Number.parseInt(value ?? '0', 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    private static stringValue(value: string): FirestoreValue {
        return { stringValue: value };
    }

    private static integerValue(value: number): FirestoreValue {
        return { integerValue: String(Math.max(0, Math.trunc(value))) };
    }

    private static timestampValue(value: Date): FirestoreValue {
        return { timestampValue: value.toISOString() };
    }

    private static async readJson(response: Response): Promise<unknown> {
        try {
            return await response.json();
        } catch (_error) {
            return {};
        }
    }

    private static getFirestoreErrorMessage(payload: unknown, fallback: string): string {
        const message = (payload as { error?: { message?: string } }).error?.message;
        return message || fallback;
    }

    private static getFallbackUsername(email: string): string {
        const atIndex = email.indexOf('@');
        if (atIndex <= 0) {
            return 'PLAYER';
        }

        return email.slice(0, atIndex);
    }
}
