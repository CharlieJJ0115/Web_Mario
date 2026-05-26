import {
    _decorator,
    Component,
    director,
    Enum,
} from 'cc';
import { GameFlowState } from './GameFlowState';

const { ccclass, property } = _decorator;

export enum TimedSceneRedirectMode {
    GameStart = 0,
    GameOver = 1,
}

Enum(TimedSceneRedirectMode);

@ccclass('TimedSceneRedirectController')
export class TimedSceneRedirectController extends Component {
    @property
    public delaySeconds = 2;

    @property({ type: TimedSceneRedirectMode })
    public redirectMode = TimedSceneRedirectMode.GameStart;

    protected start(): void {
        this.scheduleOnce(this.redirect, Math.max(this.delaySeconds, 0));
    }

    private readonly redirect = (): void => {
        if (this.redirectMode === TimedSceneRedirectMode.GameOver) {
            GameFlowState.resetForLevelSelect();
            director.loadScene(GameFlowState.levelSelectSceneName);
            return;
        }

        director.loadScene(GameFlowState.pendingLevelScene);
    };
}
