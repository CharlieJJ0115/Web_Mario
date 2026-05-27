import {
    _decorator,
    Component,
    Label,
    Node,
    UITransform,
    Vec3,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('EditBoxLayoutFix')
export class EditBoxLayoutFix extends Component {
    @property
    public paddingX = 8;

    @property
    public paddingY = 0;

    @property
    public fixEveryFrame = true;

    protected onLoad(): void {
        this.fixLayout();
    }

    protected start(): void {
        this.fixLayout();
    }

    protected lateUpdate(): void {
        if (!this.fixEveryFrame) {
            return;
        }

        this.fixLayout();
    }

    public fixLayout(): void {
        const editBoxTransform = this.node.getComponent(UITransform);
        if (!editBoxTransform) {
            return;
        }

        this.fixLabelNode(this.node.getChildByName('TEXT_LABEL'), editBoxTransform);
        this.fixLabelNode(this.node.getChildByName('PLACEHOLDER_LABEL'), editBoxTransform);
    }

    private fixLabelNode(labelNode: Node | null, editBoxTransform: UITransform): void {
        if (!labelNode) {
            return;
        }

        const width = Math.max(0, editBoxTransform.width - Math.max(this.paddingX, 0) * 2);
        const height = Math.max(0, editBoxTransform.height - Math.max(Math.abs(this.paddingY), 0) * 2);
        const x = -editBoxTransform.width * 0.5 + Math.max(this.paddingX, 0) + width * 0.5;

        labelNode.setPosition(new Vec3(x, this.paddingY, labelNode.position.z));

        const labelTransform = labelNode.getComponent(UITransform);
        if (labelTransform) {
            labelTransform.setContentSize(width, height);
            labelTransform.setAnchorPoint(0.5, 0.5);
        }

        const label = labelNode.getComponent(Label);
        if (label) {
            label.horizontalAlign = Label.HorizontalAlign.LEFT;
            label.verticalAlign = Label.VerticalAlign.CENTER;
        }
    }
}
