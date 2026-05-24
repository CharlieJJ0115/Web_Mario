import {
    _decorator,
    BoxCollider2D,
    Collider2D,
    Component,
    Contact2DType,
    ERigidBody2DType,
    EventKeyboard,
    input,
    Input,
    KeyCode,
    RigidBody2D,
    Sprite,
    Vec2,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('PlayerController')
export class PlayerController extends Component {
    @property
    public moveSpeed = 180;

    @property
    public jumpSpeed = 420;

    @property
    public bodySize = new Vec2(28, 30);

    @property
    public enablePhysics = false;

    @property
    public debugInput = true;

    @property
    public useBrowserKeyboardFallback = true;

    private body: RigidBody2D | null = null;
    private moveAxis = 0;
    private groundedContacts = 0;
    private jumpQueued = false;
    private pressedKeys = new Set<KeyCode>();
    private groundSensor: BoxCollider2D | null = null;

    public get isGrounded(): boolean {
        return this.groundedContacts > 0;
    }

    protected onLoad(): void {
        if (this.enablePhysics) {
            this.ensurePhysicsComponents();
        }
        this.registerInput();
    }

    protected onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        this.unregisterBrowserKeyboardFallback();

        const colliders = this.node.getComponents(Collider2D);
        for (const collider of colliders) {
            collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            collider.off(Contact2DType.END_CONTACT, this.onEndContact, this);
        }
    }

    protected update(deltaTime: number): void {
        if (this.enablePhysics) {
            return;
        }

        this.updateManualMovement(deltaTime);
    }

    protected fixedUpdate(): void {
        if (!this.enablePhysics) {
            return;
        }

        if (!this.body) {
            return;
        }

        const velocity = this.body.linearVelocity.clone();
        velocity.x = this.moveAxis * this.moveSpeed;

        if (this.jumpQueued && this.isGrounded) {
            velocity.y = this.jumpSpeed;
            this.groundedContacts = 0;
        }
        this.jumpQueued = false;

        this.body.linearVelocity = velocity;
        this.updateFacing();
    }

    private ensurePhysicsComponents(): void {
        this.body = this.node.getComponent(RigidBody2D);
        if (!this.body) {
            this.body = this.node.addComponent(RigidBody2D);
        }
        this.body.type = ERigidBody2DType.Dynamic;
        this.body.enabledContactListener = true;
        this.body.fixedRotation = true;
        this.body.gravityScale = 1;

        let mainCollider = this.node.getComponent(BoxCollider2D);
        if (!mainCollider) {
            mainCollider = this.node.addComponent(BoxCollider2D);
        }
        mainCollider.size = this.bodySize;
        mainCollider.offset = new Vec2(0, this.bodySize.y * 0.5);
        mainCollider.density = 1;
        mainCollider.friction = 0;
        mainCollider.restitution = 0;
        mainCollider.apply();

        this.groundSensor = this.node.addComponent(BoxCollider2D);
        this.groundSensor.sensor = true;
        this.groundSensor.size = new Vec2(this.bodySize.x * 0.72, 6);
        this.groundSensor.offset = new Vec2(0, 1);
        this.groundSensor.apply();
        this.groundSensor.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        this.groundSensor.on(Contact2DType.END_CONTACT, this.onEndContact, this);
    }

    private registerInput(): void {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
        this.registerBrowserKeyboardFallback();
    }

    private onKeyDown(event: EventKeyboard): void {
        this.setKeyState(event.keyCode, true, 'cocos');
    }

    private onKeyUp(event: EventKeyboard): void {
        this.setKeyState(event.keyCode, false, 'cocos');
    }

    private setKeyState(keyCode: KeyCode, pressed: boolean, source: string): void {
        if (pressed) {
            this.pressedKeys.add(keyCode);
        } else {
            this.pressedKeys.delete(keyCode);
        }

        this.recalculateMoveAxis();

        if (this.debugInput && this.isTrackedKey(keyCode)) {
            console.log(`[PlayerController] ${source} ${pressed ? 'down' : 'up'} ${KeyCode[keyCode]} moveAxis=${this.moveAxis} grounded=${this.isGrounded}`);
        }

        if (pressed && this.isJumpKey(keyCode)) {
            this.jumpQueued = true;
        }
    }

    private recalculateMoveAxis(): void {
        const left = this.pressedKeys.has(KeyCode.KEY_A) || this.pressedKeys.has(KeyCode.ARROW_LEFT);
        const right = this.pressedKeys.has(KeyCode.KEY_D) || this.pressedKeys.has(KeyCode.ARROW_RIGHT);
        this.moveAxis = Number(right) - Number(left);
    }

    private isJumpKey(keyCode: KeyCode): boolean {
        return keyCode === KeyCode.SPACE || keyCode === KeyCode.KEY_W || keyCode === KeyCode.ARROW_UP;
    }

    private isTrackedKey(keyCode: KeyCode): boolean {
        return this.isJumpKey(keyCode)
            || keyCode === KeyCode.KEY_A
            || keyCode === KeyCode.KEY_D
            || keyCode === KeyCode.ARROW_LEFT
            || keyCode === KeyCode.ARROW_RIGHT;
    }

    private onBeginContact(selfCollider: Collider2D): void {
        if (selfCollider !== this.groundSensor) {
            return;
        }
        this.groundedContacts += 1;
    }

    private onEndContact(selfCollider: Collider2D): void {
        if (selfCollider !== this.groundSensor) {
            return;
        }
        this.groundedContacts = Math.max(0, this.groundedContacts - 1);
    }

    private updateFacing(): void {
        if (this.moveAxis === 0) {
            return;
        }

        const sprite = this.node.getComponent(Sprite);
        if (sprite) {
            sprite.flipX = this.moveAxis < 0;
        }
    }

    private updateManualMovement(deltaTime: number): void {
        const position = this.node.position.clone();
        position.x += this.moveAxis * this.moveSpeed * deltaTime;

        if (this.jumpQueued) {
            position.y += 48;
            if (this.debugInput) {
                console.log('[PlayerController] manual jump');
            }
        }
        this.jumpQueued = false;

        this.node.setPosition(position);
        this.updateFacing();
    }

    private registerBrowserKeyboardFallback(): void {
        if (!this.useBrowserKeyboardFallback || typeof window === 'undefined') {
            return;
        }

        window.addEventListener('keydown', this.onBrowserKeyDown);
        window.addEventListener('keyup', this.onBrowserKeyUp);
    }

    private unregisterBrowserKeyboardFallback(): void {
        if (typeof window === 'undefined') {
            return;
        }

        window.removeEventListener('keydown', this.onBrowserKeyDown);
        window.removeEventListener('keyup', this.onBrowserKeyUp);
    }

    private readonly onBrowserKeyDown = (event: KeyboardEvent): void => {
        const keyCode = this.toCocosKeyCode(event);
        if (keyCode === null) {
            return;
        }

        event.preventDefault();
        this.setKeyState(keyCode, true, 'browser');
    };

    private readonly onBrowserKeyUp = (event: KeyboardEvent): void => {
        const keyCode = this.toCocosKeyCode(event);
        if (keyCode === null) {
            return;
        }

        event.preventDefault();
        this.setKeyState(keyCode, false, 'browser');
    };

    private toCocosKeyCode(event: KeyboardEvent): KeyCode | null {
        switch (event.code) {
            case 'KeyA':
                return KeyCode.KEY_A;
            case 'KeyD':
                return KeyCode.KEY_D;
            case 'KeyW':
                return KeyCode.KEY_W;
            case 'Space':
                return KeyCode.SPACE;
            case 'ArrowLeft':
                return KeyCode.ARROW_LEFT;
            case 'ArrowRight':
                return KeyCode.ARROW_RIGHT;
            case 'ArrowUp':
                return KeyCode.ARROW_UP;
            default:
                return null;
        }
    }
}
