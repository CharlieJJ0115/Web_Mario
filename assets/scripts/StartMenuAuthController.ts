import {
    _decorator,
    Button,
    Component,
    director,
    EditBox,
    EventKeyboard,
    input,
    Input,
    KeyCode,
    Label,
    Node,
} from 'cc';
import { AuthSession } from './AuthSession';
import { FirebaseAuthService } from './FirebaseAuthService';
import { FirestorePlayerService } from './FirestorePlayerService';

const { ccclass, property } = _decorator;

type AuthPanelMode = 'none' | 'login' | 'signup';

@ccclass('StartMenuAuthController')
export class StartMenuAuthController extends Component {
    @property
    public firebaseApiKey = '';

    @property
    public levelSelectSceneName = 'LevelSelect';

    @property
    public firebaseProjectId = '';

    @property(Button)
    public mainLoginButton: Button | null = null;

    @property(Button)
    public mainSignupButton: Button | null = null;

    @property(Node)
    public loginPanel: Node | null = null;

    @property(EditBox)
    public loginEmailInput: EditBox | null = null;

    @property(EditBox)
    public loginPasswordInput: EditBox | null = null;

    @property(Button)
    public loginEnterButton: Button | null = null;

    @property(Button)
    public loginCloseButton: Button | null = null;

    @property(Label)
    public loginErrorLabel: Label | null = null;

    @property(Node)
    public signupPanel: Node | null = null;

    @property(EditBox)
    public signupEmailInput: EditBox | null = null;

    @property(EditBox)
    public signupUsernameInput: EditBox | null = null;

    @property(EditBox)
    public signupPasswordInput: EditBox | null = null;

    @property(Button)
    public signupEnterButton: Button | null = null;

    @property(Button)
    public signupCloseButton: Button | null = null;

    @property(Label)
    public signupErrorLabel: Label | null = null;

    private activePanel: AuthPanelMode = 'none';
    private submitting = false;

    protected onLoad(): void {
        this.closeLogin();
        this.closeSignup();
    }

    protected onEnable(): void {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    protected onDisable(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    public openLogin(): void {
        this.activePanel = 'login';
        this.setPanelActive(this.loginPanel, true);
        this.setPanelActive(this.signupPanel, false);
        this.setError(this.loginErrorLabel, '');
        this.setError(this.signupErrorLabel, '');
        this.setMainButtonsInteractable(false);
        this.loginEmailInput?.focus();
    }

    public openSignup(): void {
        this.activePanel = 'signup';
        this.setPanelActive(this.signupPanel, true);
        this.setPanelActive(this.loginPanel, false);
        this.setError(this.loginErrorLabel, '');
        this.setError(this.signupErrorLabel, '');
        this.setMainButtonsInteractable(false);
        this.signupEmailInput?.focus();
    }

    public closeLogin(): void {
        this.setPanelActive(this.loginPanel, false);
        this.setError(this.loginErrorLabel, '');
        if (this.activePanel === 'login') {
            this.activePanel = 'none';
        }
        if (!this.hasOpenPanel()) {
            this.setMainButtonsInteractable(true);
        }
    }

    public closeSignup(): void {
        this.setPanelActive(this.signupPanel, false);
        this.setError(this.signupErrorLabel, '');
        if (this.activePanel === 'signup') {
            this.activePanel = 'none';
        }
        if (!this.hasOpenPanel()) {
            this.setMainButtonsInteractable(true);
        }
    }

    public async submitLogin(): Promise<void> {
        if (this.submitting) {
            return;
        }

        this.submitting = true;
        this.setButtonsInteractable(false);
        this.setStatus(this.loginErrorLabel, 'Signing in...');

        try {
            const user = await FirebaseAuthService.login(
                this.firebaseApiKey,
                this.getInputText(this.loginEmailInput),
                this.getInputText(this.loginPasswordInput),
            );
            const session = { ...user, projectId: this.firebaseProjectId.trim() };
            await FirestorePlayerService.upsertPlayerProfile(session);
            AuthSession.setCurrentUser(session);
            director.loadScene(this.levelSelectSceneName);
        } catch (error) {
            this.showError(this.loginErrorLabel, this.getErrorMessage(error));
        } finally {
            this.submitting = false;
            this.setButtonsInteractable(true);
        }
    }

    public async submitSignup(): Promise<void> {
        if (this.submitting) {
            return;
        }

        this.submitting = true;
        this.setButtonsInteractable(false);
        this.setStatus(this.signupErrorLabel, 'Signing up...');

        try {
            const user = await FirebaseAuthService.signup(
                this.firebaseApiKey,
                this.getInputText(this.signupEmailInput),
                this.getInputText(this.signupPasswordInput),
                this.getInputText(this.signupUsernameInput),
            );
            const session = { ...user, projectId: this.firebaseProjectId.trim() };
            await FirestorePlayerService.upsertPlayerProfile(session);
            AuthSession.setCurrentUser(session);
            director.loadScene(this.levelSelectSceneName);
        } catch (error) {
            this.showError(this.signupErrorLabel, this.getErrorMessage(error));
        } finally {
            this.submitting = false;
            this.setButtonsInteractable(true);
        }
    }

    private onKeyDown(event: EventKeyboard): void {
        if (event.keyCode !== KeyCode.ENTER) {
            return;
        }

        if (this.activePanel === 'login') {
            void this.submitLogin();
            return;
        }

        if (this.activePanel === 'signup') {
            void this.submitSignup();
        }
    }

    private setPanelActive(panel: Node | null, active: boolean): void {
        if (panel) {
            panel.active = active;
        }
    }

    private setError(label: Label | null, message: string): void {
        if (label) {
            label.string = message;
        }
    }

    private setStatus(label: Label | null, message: string): void {
        if (label) {
            label.string = message;
        }
    }

    private showError(label: Label | null, message: string): void {
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
            window.alert(message);
            this.setStatus(label, '');
            return;
        }

        this.setStatus(label, message);
    }

    private getInputText(inputBox: EditBox | null): string {
        return inputBox?.string ?? '';
    }

    private setButtonsInteractable(interactable: boolean): void {
        const buttons = [
            this.loginEnterButton,
            this.loginCloseButton,
            this.signupEnterButton,
            this.signupCloseButton,
        ];

        buttons.forEach((button) => {
            if (button) {
                button.interactable = interactable;
            }
        });
    }

    private hasOpenPanel(): boolean {
        return !!this.loginPanel?.active || !!this.signupPanel?.active;
    }

    private setMainButtonsInteractable(interactable: boolean): void {
        if (this.mainLoginButton) {
            this.mainLoginButton.interactable = interactable;
        }
        if (this.mainSignupButton) {
            this.mainSignupButton.interactable = interactable;
        }
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }

        return String(error || 'Authentication failed.');
    }
}
