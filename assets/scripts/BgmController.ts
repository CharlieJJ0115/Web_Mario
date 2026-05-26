import {
    _decorator,
    AudioClip,
    AudioSource,
    Component,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('BgmController')
export class BgmController extends Component {
    @property(AudioClip)
    public bgmClip: AudioClip | null = null;

    @property
    public volume = 1;

    @property
    public loop = true;

    @property
    public playOnStart = true;

    private audioSource: AudioSource | null = null;

    protected onLoad(): void {
        this.audioSource = this.node.getComponent(AudioSource);
        if (!this.audioSource) {
            this.audioSource = this.node.addComponent(AudioSource);
        }
        this.applySettings();
    }

    protected start(): void {
        this.applySettings();
        if (this.playOnStart) {
            this.playBgm();
        }
    }

    protected onValidate(): void {
        this.audioSource = this.node.getComponent(AudioSource);
        this.applySettings();
    }

    public playBgm(): void {
        if (!this.audioSource || !this.bgmClip) {
            return;
        }

        this.applySettings();
        this.audioSource.play();
    }

    public stopBgm(): void {
        this.audioSource?.stop();
    }

    public setVolume(value: number): void {
        this.volume = this.clampVolume(value);
        if (this.audioSource) {
            this.audioSource.volume = this.volume;
        }
    }

    private applySettings(): void {
        if (!this.audioSource) {
            return;
        }

        this.audioSource.clip = this.bgmClip;
        this.audioSource.loop = this.loop;
        this.audioSource.volume = this.clampVolume(this.volume);
    }

    private clampVolume(value: number): number {
        return Math.min(Math.max(value, 0), 1);
    }
}
