import data from "../data/data.js";

export class CTA extends Phaser.GameObjects.Container {
    constructor(scene, x, y) {

        super(scene);
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.scene.add.existing(this);

        this.init();
        this.value = 0;

    }

    adjust() {

        // The dim covers the whole visible screen in both orientations.
        this.graphicsGrp.x = dimensions.leftOffset;
        this.graphicsGrp.y = dimensions.topOffset;
    }

    init() {
        this.graphicsGrp = this.scene.add.container(0, 0);
        this.add(this.graphicsGrp);

        this.graphics = this.scene.make.graphics().fillStyle(0x000000, .5).fillRect(dimensions.leftOffset, dimensions.topOffset, dimensions.actualWidth * 3, dimensions.actualHeight * 3);
        this.graphicsGrp.add(this.graphics);

        this.visible = false;
    }

    show() {

        this.visible = true;
        this.scene.hideUI();
        this.adjust();
    }
}