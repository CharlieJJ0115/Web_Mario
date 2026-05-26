import {
    _decorator,
    Component,
    director,
} from 'cc';
import { GameFlowState } from './GameFlowState';

const { ccclass, property } = _decorator;

@ccclass('SceneButtonController')
export class SceneButtonController extends Component {
    @property
    public targetLevelSceneName = 'Level_1';

    @property
    public gameStartSceneName = 'GameStart';

    @property
    public initialLives = 5;

    public startLevel(): void {
        GameFlowState.gameStartSceneName = this.gameStartSceneName || GameFlowState.gameStartSceneName;
        GameFlowState.startNewGame(this.targetLevelSceneName, this.initialLives);
        director.loadScene(GameFlowState.gameStartSceneName);
    }
}
