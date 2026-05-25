import {
    _decorator,
    Camera,
    Component,
    Vec2,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('HudFollowCamera')
export class HudFollowCamera extends Component {
    @property(Camera)
    public camera: Camera | null = null;

    @property(Vec2)
    public offset = new Vec2(0, 0);

    protected lateUpdate(): void {
        if (!this.camera) {
            return;
        }

        const cameraPosition = this.camera.node.worldPosition;
        const currentPosition = this.node.worldPosition;
        this.node.setWorldPosition(
            cameraPosition.x + this.offset.x,
            cameraPosition.y + this.offset.y,
            currentPosition.z,
        );
    }
}
