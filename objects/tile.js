export class Tile extends Phaser.GameObjects.Container {
    constructor(scene, x, y) {
        super(scene);
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.scene.add.existing(this);

        this.init();
    }

    init() {
        this.tile = this.scene.add.sprite(0, 0, "sheet");
        this.tile.setOrigin(0.5);
        this.add(this.tile);
    }

    // A tile changes what it looks like by swapping its atlas frame - there is no
    // spine object and no frame animation behind a food item.
    changeAsset(frame) {
        this.tile.setTexture("sheet", frame);
        this.tile.visible = true;
    }

    hideAsset() {
        this.tile.visible = false;
    }
}
