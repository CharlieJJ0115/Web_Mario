import {
    _decorator,
    Component,
    director,
} from 'cc';
import { AuthSession } from './AuthSession';

const { ccclass, property } = _decorator;

@ccclass('LogoutButtonController')
export class LogoutButtonController extends Component {
    @property
    public startMenuSceneName = 'StartMenu';

    public logout(): void {
        AuthSession.clearCurrentUser();
        director.loadScene(this.startMenuSceneName);
    }
}
