// Wooden strip across the top of the screen that the HUD widgets sit on.
// It reuses the plank from "Wood Table.png": the sprite is cropped down to the
// bare wood (the source shadow, front lip and legs are trimmed away) and then
// stretched to the width of the visible screen.

const BAR_HEIGHT = 96;

// Vertical squash of the strip in landscape.
const LANDSCAPE_BAR = .55;

// Opaque wood inside the source image (source pixels) — the surrounding
// transparent padding and drop shadow are cropped away so the strip can be
// stretched edge to edge without leaving gaps.
const PLANK_LEFT = 117;
const PLANK_RIGHT = 1197;
const PLANK_TOP = 100;
const PLANK_BOTTOM = 242;
const PLANK_WIDTH = PLANK_RIGHT - PLANK_LEFT;
const PLANK_HEIGHT = PLANK_BOTTOM - PLANK_TOP;

export class UIPanel extends Phaser.GameObjects.Container {

    constructor(scene, x, y) {

        super(scene);
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.scene.add.existing(this);

        this.init();
    }

    init() {

        this.bar = this.scene.add.sprite(0, 10, "uiPanel");
        // Anchored to the left edge of the visible screen and stretched from
        // there - centring it on the container left half of the plank hanging
        // off the side, which only happened to look right in portrait.
        this.bar.setOrigin(0, .5);
        // this.bar.setCrop(PLANK_LEFT, PLANK_TOP, PLANK_WIDTH, PLANK_HEIGHT);
        this.add(this.bar);

        // this.edge = this.scene.add.rectangle(0, BAR_HEIGHT, 10, 6, 0x000000, .18);
        // this.edge.setOrigin(0, 1);
        // this.add(this.edge);

        this.adjust();
    }

    adjust() {

        this.x = dimensions.leftOffset;
        this.y = dimensions.topOffset;

        // Landscape has to leave the order bubbles room under the strip, so it
        // gets a shallower plank.
        const barScaleY = dimensions.isLandscape ? LANDSCAPE_BAR : 1;

        this.bar.y = 10 * barScaleY;
        this.bar.setScale(Math.max(1, dimensions.actualWidth / this.bar.width), barScaleY);
    }
}