import { AuthUserSession } from './AuthSession';

type FirebaseAuthUser = Omit<AuthUserSession, 'projectId'>;

type FirebaseAuthResponse = {
    idToken?: string;
    email?: string;
    refreshToken?: string;
    expiresIn?: string;
    localId?: string;
    displayName?: string;
};

type FirebaseAuthErrorResponse = {
    error?: {
        message?: string;
    };
};

export class FirebaseAuthService {
    private static readonly identityToolkitBaseUrl = 'https://identitytoolkit.googleapis.com/v1';

    public static async signup(apiKey: string, email: string, password: string, username: string): Promise<FirebaseAuthUser> {
        const normalizedApiKey = this.requireApiKey(apiKey);
        const normalizedEmail = this.requireEmail(email);
        const normalizedPassword = this.requirePassword(password);
        const normalizedUsername = this.requireUsername(username);

        const signupResponse = await this.postAuthRequest(
            `${this.identityToolkitBaseUrl}/accounts:signUp?key=${encodeURIComponent(normalizedApiKey)}`,
            {
                email: normalizedEmail,
                password: normalizedPassword,
                returnSecureToken: true,
            },
        );

        if (!signupResponse.idToken || !signupResponse.localId) {
            throw new Error('Firebase did not return a valid signup session.');
        }

        const updateResponse = await this.postAuthRequest(
            `${this.identityToolkitBaseUrl}/accounts:update?key=${encodeURIComponent(normalizedApiKey)}`,
            {
                idToken: signupResponse.idToken,
                displayName: normalizedUsername,
                returnSecureToken: true,
            },
        );

        return {
            email: updateResponse.email || signupResponse.email || normalizedEmail,
            username: updateResponse.displayName || normalizedUsername,
            localId: updateResponse.localId || signupResponse.localId,
            idToken: updateResponse.idToken || signupResponse.idToken,
        };
    }

    public static async login(apiKey: string, email: string, password: string): Promise<FirebaseAuthUser> {
        const normalizedApiKey = this.requireApiKey(apiKey);
        const normalizedEmail = this.requireEmail(email);
        const normalizedPassword = this.requirePassword(password);

        const response = await this.postAuthRequest(
            `${this.identityToolkitBaseUrl}/accounts:signInWithPassword?key=${encodeURIComponent(normalizedApiKey)}`,
            {
                email: normalizedEmail,
                password: normalizedPassword,
                returnSecureToken: true,
            },
        );

        if (!response.idToken || !response.localId) {
            throw new Error('Firebase did not return a valid login session.');
        }

        return {
            email: response.email || normalizedEmail,
            username: response.displayName || this.getFallbackUsername(response.email || normalizedEmail),
            localId: response.localId,
            idToken: response.idToken,
        };
    }

    private static async postAuthRequest(url: string, body: Record<string, unknown>): Promise<FirebaseAuthResponse> {
        let response: Response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
        } catch (_error) {
            throw new Error('Cannot connect to Firebase. Please check the network connection.');
        }

        const payload = await this.readJson(response);
        if (!response.ok) {
            throw new Error(this.getReadableFirebaseError((payload as FirebaseAuthErrorResponse).error?.message));
        }

        return payload as FirebaseAuthResponse;
    }

    private static async readJson(response: Response): Promise<unknown> {
        try {
            return await response.json();
        } catch (_error) {
            return {};
        }
    }

    private static requireApiKey(apiKey: string): string {
        const value = apiKey.trim();
        if (!value) {
            throw new Error('Firebase API key is not set.');
        }

        return value;
    }

    private static requireEmail(email: string): string {
        const value = email.trim();
        if (!value) {
            throw new Error('Please enter email.');
        }

        return value;
    }

    private static requirePassword(password: string): string {
        if (!password) {
            throw new Error('Please enter password.');
        }

        return password;
    }

    private static requireUsername(username: string): string {
        const value = username.trim();
        if (!value) {
            throw new Error('Please enter username.');
        }

        return value;
    }

    private static getReadableFirebaseError(message: string | undefined): string {
        switch (message) {
            case 'EMAIL_EXISTS':
                return 'This email is already registered.';
            case 'OPERATION_NOT_ALLOWED':
                return 'Email/password sign-in is not enabled in Firebase.';
            case 'TOO_MANY_ATTEMPTS_TRY_LATER':
                return 'Too many attempts. Please try again later.';
            case 'EMAIL_NOT_FOUND':
                return 'No account was found for this email.';
            case 'INVALID_PASSWORD':
            case 'INVALID_LOGIN_CREDENTIALS':
                return 'Email or password is incorrect.';
            case 'USER_DISABLED':
                return 'This account has been disabled.';
            case 'INVALID_EMAIL':
                return 'Email format is invalid.';
            case 'WEAK_PASSWORD : Password should be at least 6 characters':
                return 'Password should be at least 6 characters.';
            case 'MISSING_PASSWORD':
                return 'Please enter password.';
            default:
                if (message?.startsWith('WEAK_PASSWORD')) {
                    return 'Password should be at least 6 characters.';
                }
                return message || 'Firebase authentication failed.';
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
