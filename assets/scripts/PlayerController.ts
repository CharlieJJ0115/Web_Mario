import {
    _decorator,
    BoxCollider2D,
    Collider2D,
    Component,
    Contact2DType,
    Color,
    ERigidBody2DType,
    EventKeyboard,
    Graphics,
    input,
    Input,
    KeyCode,
    Node,
    RigidBody2D,
    Size,
    Sprite,
    SpriteFrame,
    UITransform,
    Vec2,
    Vec3,
    isValid,
} from 'cc';
import { OneWayPlatformController } from './OneWayPlatformController';

const { ccclass, property } = _decorator;

type PlayerAnimationState = 'idle' | 'walk' | 'jump' | 'fall';

@ccclass('PlayerController')
export class PlayerController extends Component {
    @property
    public moveSpeed = 240;

    @property
    public jumpSpeed = 420;

    @property(Vec2)
    public bodySize = new Vec2(14, 16);

    @property
    public debugInput = true;

    @property
    public useBrowserKeyboardFallback = true;

    @property
    public fallResetY = -300;

    @property
    public fallResetDistance = 160;

    @property
    public useFallResetDistance = false;

    @property
    public debugPhysicsPosition = true;

    @property
    public showColliderDebug = false;

    @property
    public showGroundSensorDebug = false;

    @property
    public visualNodeName = 'Visual';

    @property
    public visualOffsetY = 8;

    @property
    public groundSensorHeight = 3;

    @property
    public groundSensorOffsetY = -1;

    @property(Vec2)
    public bigBodySize = new Vec2(18, 27);

    @property
    public bigVisualOffsetY = 13.5;

    @property
    public bigGroundSensorHeight = 3;

    @property
    public bigGroundSensorOffsetY = -1;

    @property([SpriteFrame])
    public idleFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public walkFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public jumpFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public fallFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public bigIdleFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public bigWalkFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public bigJumpFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public bigFallFrames: SpriteFrame[] = [];

    @property
    public walkFrameInterval = 0.08;

    @property
    public airFrameInterval = 0.12;

    @property
    public idleFrameInterval = 0.2;

    private body: RigidBody2D | null = null;
    private mainCollider: BoxCollider2D | null = null;
    private groundSensor: BoxCollider2D | null = null;
    private colliderDebugNode: Node | null = null;
    private groundSensorDebugNode: Node | null = null;
    private visualNode: Node | null = null;
    private visualSprite: Sprite | null = null;
    private fallResetPosition = new Vec3();
    private pressedKeys = new Set<KeyCode>();
    private candidateOneWayPlatforms = new Map<OneWayPlatformController, number>();
    private moveAxis = 0;
    private solidGroundedContacts = 0;
    private oneWayGrounded = false;
    private jumpQueued = false;
    private physicsReady = false;
    private physicsLogElapsed = 0;
    private lastLoggedMoveAxis = Number.NaN;
    private animationState: PlayerAnimationState = 'idle';
    private animationFrameIndex = 0;
    private animationElapsed = 0;
    private fallbackSpriteFrame: SpriteFrame | null = null;
    private isBigMario = false;
    private growQueued = false;
    private lastFootWorldY = Number.NaN;

    public get isGrounded(): boolean {
        return this.solidGroundedContacts > 0 || this.oneWayGrounded;
    }

    public get isBig(): boolean {
        return this.isBigMario;
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

    public setFallResetY(resetY: number): void {
        this.fallResetY = resetY;
    }

    public getFootWorldY(): number {
        if (!this.mainCollider) {
            return this.node.worldPosition.y;
        }

        return this.node.worldPosition.y + this.mainCollider.offset.y - this.mainCollider.size.height * 0.5;
    }

    public getVerticalVelocity(): number {
        return this.body?.linearVelocity.y ?? 0;
    }

    public canStandOnOneWayPlatform(platformTopY: number, tolerance = 2): boolean {
        return this.getFootWorldY() >= platformTopY - tolerance
            && this.getVerticalVelocity() <= 0;
    }

    public tryGrowBig(): boolean {
        if (this.isBigMario || this.growQueued) {
            return false;
        }

        this.growQueued = true;
        this.scheduleOnce(this.applyGrowBig, 0);
        return true;
    }

    private readonly applyGrowBig = (): void => {
        this.growQueued = false;
        if (this.isBigMario) {
            return;
        }

        this.isBigMario = true;
        this.bodySize.set(this.bigBodySize.x, this.bigBodySize.y);
        this.visualOffsetY = this.bigVisualOffsetY;
        this.groundSensorHeight = this.bigGroundSensorHeight;
        this.groundSensorOffsetY = this.bigGroundSensorOffsetY;

        const visual = this.resolveVisualNode();
        visual.setPosition(0, this.visualOffsetY, 0);
        this.configureColliderShapes();
        this.resetAnimationPlayback();
        this.updatePlayerAnimation(0);
        this.updateColliderDebug();

        console.log('[PlayerController] Mario grew into big Mario.');
    };

    protected onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        this.unregisterBrowserKeyboardFallback();

        if (this.mainCollider) {
            this.mainCollider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            this.mainCollider.off(Contact2DType.END_CONTACT, this.onEndContact, this);
        }

        if (this.groundSensor) {
            this.groundSensor.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            this.groundSensor.off(Contact2DType.END_CONTACT, this.onEndContact, this);
        }
    }

    protected update(deltaTime: number): void {
        if (Number.isNaN(this.lastFootWorldY)) {
            this.lastFootWorldY = this.getFootWorldY();
        }
        this.ensureVisible();
        this.applyPhysicsMovement();
        this.updatePlayerAnimation(deltaTime);
        this.updateColliderDebug();
        this.monitorPhysicsPosition(deltaTime);
        this.lastFootWorldY = this.getFootWorldY();
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
            this.solidGroundedContacts = 0;
            this.oneWayGrounded = false;
        }
        this.jumpQueued = false;

        this.setBodyVelocity(velocity);
        this.resolveOneWayPlatformLanding();
        this.updateFacing();
    }

    private setupPhysicsComponents(): void {
        this.body = this.node.getComponent(RigidBody2D);
        const colliders = this.node.getComponents(BoxCollider2D);
        this.mainCollider = colliders.find((collider) => !collider.sensor) ?? colliders[0] ?? null;
        this.groundSensor = colliders.find((collider) => collider.sensor && collider !== this.mainCollider) ?? null;

        if (!this.body) {
            this.body = this.node.addComponent(RigidBody2D);
        }

        if (!this.mainCollider) {
            this.mainCollider = this.node.addComponent(BoxCollider2D);
        }

        if (!this.groundSensor) {
            this.groundSensor = this.node.addComponent(BoxCollider2D);
        }

        this.body.type = ERigidBody2DType.Dynamic;
        this.body.enabledContactListener = true;
        this.body.fixedRotation = true;
        this.body.gravityScale = 1;

        this.configureColliderShapes();
        this.mainCollider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        this.mainCollider.on(Contact2DType.END_CONTACT, this.onEndContact, this);
        this.groundSensor.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        this.groundSensor.on(Contact2DType.END_CONTACT, this.onEndContact, this);

        this.physicsReady = true;
        this.updateColliderDebug();
        const groundSensorWidth = this.bodySize.x * 0.8;
        console.log(
            `[PlayerController] Physics components ready type=Dynamic fixedRotation=true gravityScale=1 `
            + `colliderSize=${this.bodySize.x}x${this.bodySize.y} offset=(0, ${this.bodySize.y * 0.5}) `
            + `groundSensor=${groundSensorWidth.toFixed(1)}x${this.groundSensorHeight} offset=(0, ${this.groundSensorOffsetY})`,
        );
    }

    private configureColliderShapes(): void {
        if (!this.mainCollider || !this.groundSensor) {
            return;
        }

        this.mainCollider.sensor = false;
        this.mainCollider.size = new Size(this.bodySize.x, this.bodySize.y);
        this.mainCollider.offset = new Vec2(0, this.bodySize.y * 0.5);
        this.mainCollider.density = 1;
        this.mainCollider.friction = 0;
        this.mainCollider.restitution = 0;
        this.mainCollider.apply();

        const groundSensorWidth = this.bodySize.x * 0.8;
        this.groundSensor.sensor = true;
        this.groundSensor.size = new Size(groundSensorWidth, this.groundSensorHeight);
        this.groundSensor.offset = new Vec2(0, this.groundSensorOffsetY);
        this.groundSensor.density = 0;
        this.groundSensor.friction = 0;
        this.groundSensor.restitution = 0;
        this.groundSensor.apply();
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
            this.visualSprite = this.visualNode.getComponent(Sprite);
            return this.visualNode;
        }

        let visual = this.node.getChildByName(this.visualNodeName);
        if (!visual) {
            visual = new Node(this.visualNodeName);
            this.node.addChild(visual);
        }

        visual.setPosition(0, this.visualOffsetY, 0);
        this.visualNode = visual;
        this.visualSprite = visual.getComponent(Sprite);
        this.captureFallbackSpriteFrame();
        console.log(`[PlayerController] Visual resolved spriteFrame=${this.visualSprite?.spriteFrame ? 'assigned' : 'missing'}`);
        return visual;
    }

    private updatePlayerAnimation(deltaTime: number): void {
        this.resolveVisualNode();
        this.captureFallbackSpriteFrame();

        if (!this.visualSprite) {
            return;
        }

        const nextState = this.getAnimationState();
        if (nextState !== this.animationState) {
            this.animationState = nextState;
            this.animationFrameIndex = 0;
            this.animationElapsed = 0;
        }

        const frames = this.getFramesForAnimationState(this.animationState);
        if (frames.length === 0) {
            if (!this.visualSprite.spriteFrame && this.fallbackSpriteFrame) {
                this.visualSprite.spriteFrame = this.fallbackSpriteFrame;
            }
            return;
        }

        const frameInterval = this.getFrameInterval(this.animationState);
        this.animationElapsed += deltaTime;
        while (this.animationElapsed >= frameInterval) {
            this.animationElapsed -= frameInterval;
            this.animationFrameIndex = (this.animationFrameIndex + 1) % frames.length;
        }

        this.visualSprite.spriteFrame = frames[this.animationFrameIndex];
    }

    private getAnimationState(): PlayerAnimationState {
        const velocity = this.body?.linearVelocity ?? new Vec2();
        if (!this.isGrounded) {
            return velocity.y > 0 ? 'jump' : 'fall';
        }
        if (this.moveAxis !== 0) {
            return 'walk';
        }
        return 'idle';
    }

    private getFramesForAnimationState(state: PlayerAnimationState): SpriteFrame[] {
        if (this.isBigMario) {
            const bigFrames = this.getBigFramesForAnimationState(state);
            if (bigFrames.length > 0) {
                return bigFrames;
            }
        }

        return this.getSmallFramesForAnimationState(state);
    }

    private getSmallFramesForAnimationState(state: PlayerAnimationState): SpriteFrame[] {
        switch (state) {
            case 'walk':
                return this.walkFrames;
            case 'jump':
                return this.jumpFrames;
            case 'fall':
                return this.fallFrames;
            case 'idle':
            default:
                return this.idleFrames;
        }
    }

    private getBigFramesForAnimationState(state: PlayerAnimationState): SpriteFrame[] {
        switch (state) {
            case 'walk':
                return this.bigWalkFrames;
            case 'jump':
                return this.bigJumpFrames;
            case 'fall':
                return this.bigFallFrames;
            case 'idle':
            default:
                return this.bigIdleFrames;
        }
    }

    private getFrameInterval(state: PlayerAnimationState): number {
        const interval = state === 'walk'
            ? this.walkFrameInterval
            : state === 'idle'
                ? this.idleFrameInterval
                : this.airFrameInterval;
        return Math.max(interval, 0.01);
    }

    private captureFallbackSpriteFrame(): void {
        if (!this.fallbackSpriteFrame && this.visualSprite?.spriteFrame) {
            this.fallbackSpriteFrame = this.visualSprite.spriteFrame;
        }
    }

    private resetAnimationPlayback(): void {
        this.animationState = 'idle';
        this.animationFrameIndex = 0;
        this.animationElapsed = 0;
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
        this.solidGroundedContacts = 0;
        this.oneWayGrounded = false;
        this.candidateOneWayPlatforms.clear();
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
            + `vel=(${velocity.x.toFixed(1)}, ${velocity.y.toFixed(1)}) moveAxis=${this.moveAxis} `
            + `grounded=${this.isGrounded} solidGrounded=${this.solidGroundedContacts} oneWayGrounded=${this.oneWayGrounded}`,
        );
    }

    private updateColliderDebug(): void {
        this.drawColliderDebugBox(
            'PlayerColliderDebug',
            this.mainCollider,
            this.showColliderDebug,
            new Color(255, 40, 40, 255),
            new Color(255, 40, 40, 40),
            (node) => { this.colliderDebugNode = node; },
            this.colliderDebugNode,
        );
        this.drawColliderDebugBox(
            'PlayerGroundSensorDebug',
            this.groundSensor,
            this.showGroundSensorDebug,
            new Color(40, 160, 255, 255),
            new Color(40, 160, 255, 40),
            (node) => { this.groundSensorDebugNode = node; },
            this.groundSensorDebugNode,
        );
    }

    private drawColliderDebugBox(
        nodeName: string,
        collider: BoxCollider2D | null,
        visible: boolean,
        strokeColor: Color,
        fillColor: Color,
        assignNode: (node: Node) => void,
        existingNode: Node | null,
    ): void {
        if (!collider) {
            if (existingNode) {
                existingNode.active = false;
            }
            return;
        }

        let debugNode = existingNode;
        if (!debugNode || !isValid(debugNode)) {
            debugNode = this.node.getChildByName(nodeName);
            if (!debugNode) {
                debugNode = new Node(nodeName);
                this.node.addChild(debugNode);
            }
            assignNode(debugNode);
        }

        debugNode.active = visible;
        if (!visible) {
            return;
        }

        const size = collider.size;
        debugNode.setPosition(collider.offset.x, collider.offset.y, 0);

        let transform = debugNode.getComponent(UITransform);
        if (!transform) {
            transform = debugNode.addComponent(UITransform);
        }
        transform.setContentSize(size.width, size.height);

        let graphics = debugNode.getComponent(Graphics);
        if (!graphics) {
            graphics = debugNode.addComponent(Graphics);
        }
        graphics.clear();
        graphics.strokeColor = strokeColor;
        graphics.fillColor = fillColor;
        graphics.lineWidth = 1;
        graphics.rect(-size.width * 0.5, -size.height * 0.5, size.width, size.height);
        graphics.fill();
        graphics.stroke();
    }

    private shouldResetAfterFall(): boolean {
        const resetByAbsoluteY = this.node.worldPosition.y < this.fallResetY;
        const resetByDistance = this.useFallResetDistance
            && this.fallResetDistance > 0
            && this.node.worldPosition.y < this.fallResetPosition.y - this.fallResetDistance;
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
        if (selfCollider !== this.groundSensor && selfCollider !== this.mainCollider) {
            return;
        }

        const oneWayPlatform = this.getOneWayPlatformContact(otherCollider);
        if (oneWayPlatform) {
            this.addCandidateOneWayPlatform(oneWayPlatform);
            this.resolveOneWayPlatformLanding();
            return;
        }

        if (selfCollider !== this.groundSensor) {
            return;
        }

        if (otherCollider.sensor) {
            return;
        }

        this.solidGroundedContacts += 1;
    }

    private onEndContact(selfCollider: Collider2D, otherCollider: Collider2D): void {
        if (selfCollider !== this.groundSensor && selfCollider !== this.mainCollider) {
            return;
        }

        const oneWayPlatform = this.getOneWayPlatformContact(otherCollider);
        if (oneWayPlatform) {
            this.removeCandidateOneWayPlatform(oneWayPlatform);
            if (this.oneWayGrounded && !this.hasStandableOneWayPlatform()) {
                this.oneWayGrounded = false;
            }
            return;
        }

        if (selfCollider !== this.groundSensor) {
            return;
        }

        if (otherCollider.sensor) {
            return;
        }

        this.solidGroundedContacts = Math.max(0, this.solidGroundedContacts - 1);
    }

    private resolveOneWayPlatformLanding(): void {
        const platform = this.findStandableOneWayPlatform();
        if (!platform) {
            this.oneWayGrounded = false;
            return;
        }

        this.snapToOneWayPlatform(platform);
    }

    private findStandableOneWayPlatform(): OneWayPlatformController | null {
        let bestPlatform: OneWayPlatformController | null = null;
        let bestTopY = Number.NEGATIVE_INFINITY;

        this.candidateOneWayPlatforms.forEach((_count, platform) => {
            if (!isValid(platform.node) || !this.canLandOnOneWayPlatform(platform)) {
                return;
            }

            const topY = platform.getPlatformTopWorldY();
            if (topY > bestTopY) {
                bestTopY = topY;
                bestPlatform = platform;
            }
        });

        return bestPlatform;
    }

    private hasStandableOneWayPlatform(): boolean {
        return this.findStandableOneWayPlatform() !== null;
    }

    private canLandOnOneWayPlatform(platform: OneWayPlatformController): boolean {
        const verticalVelocity = this.getVerticalVelocity();
        if (verticalVelocity > 0) {
            return false;
        }

        const platformTopY = platform.getPlatformTopWorldY();
        const footY = this.getFootWorldY();
        const lowerTolerance = Math.max(platform.surfaceTolerance, 8);
        const crossedPlatformTop = this.lastFootWorldY >= platformTopY - platform.surfaceTolerance
            && footY <= platformTopY + platform.surfaceTolerance;
        const closeToPlatformTop = footY >= platformTopY - lowerTolerance
            && footY <= platformTopY + Math.max(platform.surfaceTolerance, 4);
        if (!crossedPlatformTop && !closeToPlatformTop) {
            return false;
        }

        return platform.containsWorldX(this.node.worldPosition.x);
    }

    private snapToOneWayPlatform(platform: OneWayPlatformController): void {
        if (!this.body) {
            return;
        }

        const platformTopY = platform.getPlatformTopWorldY();
        const targetWorldY = platformTopY - this.mainColliderOffsetBottom();
        const current = this.node.worldPosition;
        this.node.setWorldPosition(current.x, targetWorldY, current.z);
        this.setBodyVelocity(new Vec2(this.body.linearVelocity.x, 0));
        this.oneWayGrounded = true;
    }

    private mainColliderOffsetBottom(): number {
        if (!this.mainCollider) {
            return 0;
        }

        return this.mainCollider.offset.y - this.mainCollider.size.height * 0.5;
    }

    private getOneWayPlatformContact(otherCollider: Collider2D): OneWayPlatformController | null {
        return otherCollider.node.getComponent(OneWayPlatformController);
    }

    private addCandidateOneWayPlatform(platform: OneWayPlatformController): void {
        this.candidateOneWayPlatforms.set(
            platform,
            (this.candidateOneWayPlatforms.get(platform) ?? 0) + 1,
        );
    }

    private removeCandidateOneWayPlatform(platform: OneWayPlatformController): void {
        const count = this.candidateOneWayPlatforms.get(platform) ?? 0;
        if (count <= 1) {
            this.candidateOneWayPlatforms.delete(platform);
            return;
        }

        this.candidateOneWayPlatforms.set(platform, count - 1);
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
