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
    Node,
    RigidBody2D,
    Size,
    Sprite,
    Vec2,
    Vec3,
    isValid,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('PlayerController')
export class PlayerController extends Component {
    @property
    public moveSpeed = 240;

    @property
    public jumpSpeed = 420;

    @property(Vec2)
    public bodySize = new Vec2(28, 30);

    @property
    public debugInput = true;

    @property
    public useBrowserKeyboardFallback = true;

    @property
    public fallResetY = -300;

    @property
    public fallResetDistance = 160;

    @property
    public debugPhysicsPosition = true;

    @property
    public visualNodeName = 'Visual';

    private body: RigidBody2D | null = null;
    private mainCollider: BoxCollider2D | null = null;
    private visualNode: Node | null = null;
    private visualSprite: Sprite | null = null;
    private fallResetPosition = new Vec3();
    private pressedKeys = new Set<KeyCode>();
    private moveAxis = 0;
    private groundedContacts = 0;
    private jumpQueued = false;
    private physicsReady = false;
    private physicsLogElapsed = 0;
    private lastLoggedMoveAxis = Number.NaN;

    public get isGrounded(): boolean {
        return this.groundedContacts > 0;
    }

    protected onLoad(): void {
        console.log('[PlayerController] onLoad');
        this.resolveVisualNode();
        this.warnIfStaticMobility();
        this.setupPhysicsComponents();
        this.registerInput();
    }

    protected start(): void {
        this.fallResetPosition = this.node.worldPosition.clone();
        console.log(
            `[PlayerController] start world=(${this.node.worldPosition.x.toFixed(1)}, ${this.node.worldPosition.y.toFixed(1)}, ${this.node.worldPosition.z.toFixed(1)}) `
            + `body=${this.body ? 'ready' : 'missing'} collider=${this.mainCollider ? 'ready' : 'missing'}`,
        );
    }

    protected onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        this.unregisterBrowserKeyboardFallback();

        if (this.mainCollider) {
            this.mainCollider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            this.mainCollider.off(Contact2DType.END_CONTACT, this.onEndContact, this);
        }
    }

    protected update(deltaTime: number): void {
        this.ensureVisible();
        this.applyPhysicsMovement();
        this.monitorPhysicsPosition(deltaTime);
    }

    private applyPhysicsMovement(): void {
        if (!this.physicsReady || !this.body) {
            return;
        }

        if (this.shouldResetAfterFall()) {
            this.resetAfterFall();
            return;
        }

        const velocity = this.body!.linearVelocity.clone();
        velocity.x = this.moveAxis * this.moveSpeed;

        if (this.jumpQueued && this.canJump()) {
            velocity.y = this.jumpSpeed;
            this.groundedContacts = 0;
        }
        this.jumpQueued = false;

        this.setBodyVelocity(velocity);
        this.updateFacing();
    }

    private setupPhysicsComponents(): void {
        this.body = this.node.getComponent(RigidBody2D);
        this.mainCollider = this.node.getComponent(BoxCollider2D);

        if (!this.body) {
            this.body = this.node.addComponent(RigidBody2D);
        }

        if (!this.mainCollider) {
            this.mainCollider = this.node.addComponent(BoxCollider2D);
        }

        this.body.type = ERigidBody2DType.Dynamic;
        this.body.enabledContactListener = true;
        this.body.fixedRotation = true;
        this.body.gravityScale = 1;

        this.mainCollider.sensor = false;
        this.mainCollider.size = new Size(this.bodySize.x, this.bodySize.y);
        this.mainCollider.offset = new Vec2(0, this.bodySize.y * 0.5);
        this.mainCollider.density = 1;
        this.mainCollider.friction = 0;
        this.mainCollider.restitution = 0;
        this.mainCollider.apply();
        this.mainCollider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        this.mainCollider.on(Contact2DType.END_CONTACT, this.onEndContact, this);

        this.physicsReady = true;
        console.log(
            `[PlayerController] Physics components ready type=Dynamic fixedRotation=true gravityScale=1 `
            + `colliderSize=${this.bodySize.x}x${this.bodySize.y} offset=(0, ${this.bodySize.y * 0.5})`,
        );
    }

    private canJump(): boolean {
        return this.isGrounded;
    }

    private setBodyVelocity(velocity: Vec2): void {
        if (!this.body) {
            return;
        }

        const bodyWithMethods = this.body as unknown as {
            setLinearVelocity?: (value: Vec2) => void;
            wakeUp?: () => void;
        };

        if (bodyWithMethods.setLinearVelocity) {
            bodyWithMethods.setLinearVelocity(velocity);
        } else {
            this.body.linearVelocity = velocity;
        }

        bodyWithMethods.wakeUp?.();
    }

    private ensureVisible(): void {
        if (!this.node.active) {
            console.warn('[PlayerController] Player node was inactive. Reactivating.');
            this.node.active = true;
        }

        const visual = this.resolveVisualNode();
        if (!visual.active) {
            console.warn('[PlayerController] Player Visual node was inactive. Reactivating.');
            visual.active = true;
        }

        if (this.visualSprite && !this.visualSprite.enabled) {
            console.warn('[PlayerController] Player Visual sprite was disabled. Re-enabling.');
            this.visualSprite.enabled = true;
        }
    }

    public disableRootSprite(): void {
        const rootSprite = this.node.getComponent(Sprite);
        if (rootSprite && (rootSprite.enabled || rootSprite.spriteFrame)) {
            rootSprite.enabled = false;
            rootSprite.spriteFrame = null;
        }
    }

    private warnIfStaticMobility(): void {
        const mobility = (this.node as unknown as { mobility?: number; _mobility?: number }).mobility
            ?? (this.node as unknown as { mobility?: number; _mobility?: number })._mobility;

        if (mobility === 0) {
            console.warn('[PlayerController] Player node Mobility appears to be Static. In the Inspector, change Player > Mobility to Movable for Dynamic Rigidbody2D.');
        }
    }

    private resolveVisualNode(): Node {
        if (this.visualNode && isValid(this.visualNode)) {
            return this.visualNode;
        }

        let visual = this.node.getChildByName(this.visualNodeName);
        if (!visual) {
            visual = new Node(this.visualNodeName);
            this.node.addChild(visual);
        }

        visual.setPosition(0, 16, 0);
        this.visualNode = visual;
        this.visualSprite = visual.getComponent(Sprite);
        console.log(`[PlayerController] Visual resolved spriteFrame=${this.visualSprite?.spriteFrame ? 'assigned' : 'missing'}`);
        return visual;
    }

    private resetAfterFall(): void {
        if (!this.body) {
            return;
        }

        console.warn(
            `[PlayerController] Player fell below reset threshold. Resetting to `
            + `(${this.fallResetPosition.x.toFixed(1)}, ${this.fallResetPosition.y.toFixed(1)}, ${this.fallResetPosition.z.toFixed(1)}).`,
        );

        this.setBodyVelocity(new Vec2(0, 0));
        this.groundedContacts = 0;
        this.jumpQueued = false;
        this.node.setWorldPosition(this.fallResetPosition);
    }

    private monitorPhysicsPosition(deltaTime: number): void {
        if (!this.debugPhysicsPosition) {
            return;
        }

        this.physicsLogElapsed += deltaTime;
        if (this.physicsLogElapsed < 0.5) {
            return;
        }
        this.physicsLogElapsed = 0;

        const velocity = this.body?.linearVelocity ?? new Vec2();
        console.log(
            `[PlayerController] physics pos=(${this.node.worldPosition.x.toFixed(1)}, ${this.node.worldPosition.y.toFixed(1)}) `
            + `vel=(${velocity.x.toFixed(1)}, ${velocity.y.toFixed(1)}) moveAxis=${this.moveAxis} grounded=${this.isGrounded}`,
        );
    }

    private shouldResetAfterFall(): boolean {
        const resetByAbsoluteY = this.node.worldPosition.y < this.fallResetY;
        const resetByDistance = this.node.worldPosition.y < this.fallResetPosition.y - this.fallResetDistance;
        return resetByAbsoluteY || resetByDistance;
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

        if (this.physicsReady && this.moveAxis !== this.lastLoggedMoveAxis) {
            this.lastLoggedMoveAxis = this.moveAxis;
            console.log(`[PlayerController] physics input moveAxis=${this.moveAxis}`);
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

    private onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D): void {
        if (selfCollider !== this.mainCollider) {
            return;
        }
        if (otherCollider.sensor) {
            return;
        }
        if (!this.isGroundContact(otherCollider)) {
            return;
        }
        this.groundedContacts += 1;
    }

    private onEndContact(selfCollider: Collider2D, otherCollider: Collider2D): void {
        if (selfCollider !== this.mainCollider) {
            return;
        }
        if (otherCollider.sensor) {
            return;
        }
        if (!this.isGroundContact(otherCollider)) {
            return;
        }
        this.groundedContacts = Math.max(0, this.groundedContacts - 1);
    }

    private isGroundContact(otherCollider: Collider2D): boolean {
        const playerFootY = this.node.worldPosition.y + this.bodySize.y * 0.15;
        return otherCollider.node.worldPosition.y <= playerFootY;
    }

    private updateFacing(): void {
        if (this.moveAxis === 0) {
            return;
        }

        const visual = this.resolveVisualNode();
        const scale = visual.scale.clone();
        scale.x = Math.abs(scale.x || 1) * (this.moveAxis < 0 ? -1 : 1);
        visual.setScale(scale);
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
