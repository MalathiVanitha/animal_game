import data from "../data/data.js";

// The art is authored for a 1080px wide screen, the game runs in 540x960 units.
const ART = 0.5;

// Vertical layout, measured from the top of the visible screen (in game units).
const CHAR_Y = 252;
const BUBBLE_Y = 156;
const SILVER_TOP = 320;
const WOOD_TOP = 322;
const PLATE_Y = 352;

const FOOD_Y = 362;

// Transparent padding above the plank inside "Wood Table.png" (source pixels).
const WOOD_TRIM = 90;

// Character slots are spread relative to the counter width so the row stays
// aligned with the table on every aspect ratio.
const SLOT_RATIO = .8;

// Bubble offset from its character.
const BUBBLE_X = 55;

// Potted plants flank the stall, their pots tucked behind the counter.
const PLANT_Y = 290;
const PLANT_INSET = 66;

// Landscape has far less vertical room: the layout above is compressed by
// LANDSCAPE_SQUASH and the art shrinks by LANDSCAPE_ART.
const LANDSCAPE_SQUASH = .55;
const LANDSCAPE_ART = .72;

// The HUD strip owns the very top in landscape, so the stall starts below it.
const LANDSCAPE_TOP = 15;

// The row of customers never spreads wider than this share of the screen -
// on a landscape screen the edge cap alone would put them in the corners.
const SLOT_SPREAD = .31;

// Bottom of the stall, portrait units - just under the plates on the shelf.
// Everything below this line belongs to the board.
const PANEL_BOTTOM = 372;

export class TopPanel extends Phaser.GameObjects.Container {

    constructor(scene, x, y) {

        super(scene);
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.scene.add.existing(this);

        this.init();
    }

    get level() {
        return data[this.scene.level] || data[1];
    }

    init() {

        this.characters = [];
        this.targetArr = [];

        // Kept for compatibility with GameScene.addCandy()
        this.target = {
            targetArr: this.targetArr
        };

        this.charGrp = this.scene.add.container(0, 0);
        this.add(this.charGrp);

        this.tableGrp = this.scene.add.container(0, 0);
        this.add(this.tableGrp);

        this.silverTable = this.scene.add.sprite(0, SILVER_TOP, "silverTable");
        this.silverTable.setOrigin(.5, 0);
        this.add(this.silverTable);

        // Draw order: plants and characters stand behind the counter, the plank
        // closes the shelf, then the plates and the order bubbles sit on top.
        this.plantGrp = this.scene.add.container(0, 0);
        this.add(this.plantGrp);

        this.leftPlant = this.scene.add.sprite(0, PLANT_Y, "sheet", "Plant");
        this.leftPlant.setOrigin(.5);
        this.leftPlant.setScale(ART);
        this.plantGrp.add(this.leftPlant);

        this.rightPlant = this.scene.add.sprite(0, PLANT_Y, "sheet", "Plant");
        this.rightPlant.setOrigin(.5);
        this.rightPlant.setScale(ART);
        this.rightPlant.setFlipX(true);
        this.plantGrp.add(this.rightPlant);

        this.woodTable = this.scene.add.sprite(0, WOOD_TOP, "woodTable");
        this.woodTable.setOrigin(.5, 0);

        this.plateGrp = this.scene.add.container(0, 0);
        this.add(this.plateGrp);

        this.bubbleGrp = this.scene.add.container(0, 0);
        this.add(this.bubbleGrp);

        const characters = this.level.characters || [];

        for (let i = 0; i < characters.length; i++) {
            this.characters.push(this.createCharacter(characters[i], i));
        }

        this.tableGrp.add(this.woodTable);

        this.adjust();
    }

    createCharacter(config, index) {

        const character = this.scene.add.sprite(0, CHAR_Y, "sheet", config.character);
        character.setOrigin(.5, .5);
        character.setScale(ART);
        this.charGrp.add(character);

        const plate = this.scene.add.sprite(0, PLATE_Y, "sheet", "Plate");
        plate.setOrigin(.5, .5);
        plate.setScale(ART);
        this.plateGrp.add(plate);

        // The plate stays empty until the order is served - the food lands on it
        // as the reward for finishing the count.
        const food = this.scene.add.sprite(0, FOOD_Y, "sheet", config.food);
        food.setOrigin(.5, 1);
        food.setScale(ART);
        food.setAlpha(0);
        this.plateGrp.add(food);

        const bubble = this.scene.add.sprite(0, BUBBLE_Y, "sheet", "Bubble");
        bubble.setOrigin(.5, .5);
        bubble.setScale(ART);
        this.bubbleGrp.add(bubble);

        const icon = this.scene.add.sprite(10, BUBBLE_Y - 7, "sheet", config.food);
        icon.setOrigin(.5, .5);
        icon.setScale(ART * .8);
        this.bubbleGrp.add(icon);

        const badge = this.scene.add.sprite(0, BUBBLE_Y, "sheet", "Panel");
        badge.setOrigin(.5, .5);
        badge.setScale(ART);
        this.bubbleGrp.add(badge);

        const countTxt = this.scene.add.text(0, BUBBLE_Y, config.count, {
            fontFamily: "Oduda-Bold-Demo",
            fontSize: 17,
            fill: "#ffffff",
            align: "center",
        }).setOrigin(.5);
        this.bubbleGrp.add(countTxt);

        const slot = {
            index: index,
            name: config.name || config.food,
            food: config.food,
            total: config.count,
            remaining: config.count,
            // Tiles that have left the board for this order but have not landed
            // yet, so the board never sends more food than is still wanted.
            pending: 0,
            done: false,
            iconScale: ART * .8,
            hopTween: null,
            character: character,
            plate: plate,
            foodSprite: food,
            bubble: bubble,
            icon: icon,
            badge: badge,
            countTxt: countTxt,
            // GameScene.addCandy() tweens collected tiles towards these.
            x: 0,
            y: 0,
        };

        this.targetArr.push(slot);

        return slot;
    }

    findSlot(name) {

        const key = String(name).toLowerCase();

        return this.targetArr.find(target =>
            target.name.toLowerCase() === key || target.food.toLowerCase() === key
        );
    }

    /**
     * Claims one tile for the order that wants it, before the tile starts its
     * flight. Everything already in the air counts against the order, so the
     * last three of a five match stay on the board instead of flying to a
     * customer who is already full.
     * @param {string} name tile name, e.g. "Burger"
     * @returns {object|null} the order to fly to, or null if nobody wants it
     */
    reserve(name) {

        const slot = this.findSlot(name);

        if (!slot || slot.done) return null;
        if (slot.remaining - slot.pending <= 0) return null;

        slot.pending++;

        return slot;
    }

    /**
     * Registers collected tiles against the matching character order.
     * @param {object|string} target the slot returned by reserve(), or a tile name
     * @param {number} amount how many were collected
     */
    collect(target, amount = 1) {

        const slot = (target && typeof target === "object") ? target : this.findSlot(target);
        if (!slot) return;

        slot.pending = Math.max(0, slot.pending - amount);
        if (slot.done) return;

        slot.remaining = Math.max(0, slot.remaining - amount);
        slot.countTxt.setText(slot.remaining);

        this.impact(slot);

        if (slot.remaining <= 0) {
            slot.done = true;
            this.serve(slot);
        }

        if (this.scene.moves) {
            this.scene.moves.earnStars(this.targetArr.filter(order => order.done).length);
        }

        if (this.isComplete()) {
            this.scene.checkWin(true);
        }
    }

    /**
     * The arrival. The bubble takes the hit, the counter punches down and the
     * customer bobs - the flight has to land on something that reacts to it.
     */
    impact(slot) {

        this.scene.tweens.killTweensOf([slot.icon, slot.badge, slot.countTxt]);

        slot.icon.setScale(slot.iconScale);
        slot.badge.setScale(this.artScale);
        slot.countTxt.setScale(1);

        this.scene.tweens.add({
            targets: slot.icon,
            scale: { from: slot.iconScale * 1.4, to: slot.iconScale },
            duration: 260,
            ease: "Back.easeOut",
        });

        this.scene.tweens.add({
            targets: slot.badge,
            scaleX: { from: this.artScale * 1.3, to: this.artScale },
            scaleY: { from: this.artScale * .78, to: this.artScale },
            duration: 300,
            ease: "Back.easeOut",
        });

        this.scene.tweens.add({
            targets: slot.countTxt,
            scale: { from: 1.55, to: 1 },
            duration: 300,
            ease: "Back.easeOut",
        });

        // A short warm flash so the number itself reads as "that one changed".
        slot.countTxt.setColor("#ffe08a");
        this.scene.time.delayedCall(150, () => {
            if (slot.countTxt.active) slot.countTxt.setColor("#ffffff");
        });

        this.scene.tweens.killTweensOf(slot.bubble);
        slot.bubble.setScale(this.artScale);
        this.scene.tweens.add({
            targets: slot.bubble,
            scaleX: { from: this.artScale * 1.14, to: this.artScale },
            scaleY: { from: this.artScale * .88, to: this.artScale },
            duration: 420,
            ease: "Elastic.easeOut",
            easeParams: [.6, .5],
        });

        this.ring(slot.badge.x, slot.badge.y, .75);
        this.hop(slot, 9, 260);
    }

    /**
     * The order is finished: the food drops out of the bubble onto the plate and
     * the customer celebrates.
     */
    serve(slot) {

        slot.countTxt.setText("");

        this.scene.tweens.add({
            targets: [slot.icon, slot.badge],
            alpha: .35,
            duration: 260,
            ease: "Sine.easeOut",
        });

        this.scene.tweens.killTweensOf(slot.foodSprite);

        slot.foodSprite.setAlpha(0);
        slot.foodSprite.setScale(this.artScale * .5);
        slot.foodSprite.y = this.bubbleY + 30;
        slot.foodSprite.x = slot.bubble.x;

        // Falls out of the bubble, bounces once on the plate.
        this.scene.tweens.add({
            targets: slot.foodSprite,
            x: slot.plate.x,
            y: this.foodY,
            duration: 560,
            ease: "Bounce.easeOut",
        });

        this.scene.tweens.add({
            targets: slot.foodSprite,
            alpha: 1,
            scale: this.artScale,
            duration: 280,
            ease: "Back.easeOut",
        });

        this.scene.time.delayedCall(560, () => {

            this.scene.tweens.killTweensOf(slot.plate);
            this.scene.tweens.add({
                targets: slot.plate,
                scaleX: { from: this.artScale * 1.14, to: this.artScale },
                scaleY: { from: this.artScale * .84, to: this.artScale },
                duration: 340,
                ease: "Back.easeOut",
            });

            this.hop(slot, 18, 380);
            this.starBurst(slot);
            this.scene.playSounds("order_complete");
        });
    }

    /**
     * A customer bob. Tracked per slot so rapid collects restart the hop instead
     * of stacking offsets on top of each other.
     */
    hop(slot, height, duration) {

        if (slot.hopTween) slot.hopTween.stop();

        slot.character.y = this.charY;
        slot.character.setScale(this.artScale);

        slot.hopTween = this.scene.tweens.add({
            targets: slot.character,
            y: this.charY - height,
            scaleX: this.artScale * .95,
            scaleY: this.artScale * 1.07,
            duration: duration * .45,
            ease: "Quad.easeOut",
            yoyo: true,
            onComplete: () => {
                slot.character.y = this.charY;
                slot.character.setScale(this.artScale);
                slot.hopTween = null;
            }
        });
    }

    ensureRingTexture() {

        if (this.scene.textures.exists("collect_ring")) return;

        const g = this.scene.add.graphics();
        g.lineStyle(7, 0xffffff, 1);
        g.strokeCircle(48, 48, 40);
        g.generateTexture("collect_ring", 96, 96);
        g.destroy();
    }

    ring(x, y, scale) {

        this.ensureRingTexture();

        const ring = this.scene.add.sprite(x, y, "collect_ring");
        ring.setOrigin(.5);
        ring.setScale(scale * .25);
        ring.setBlendMode(Phaser.BlendModes.ADD);
        this.bubbleGrp.add(ring);

        this.scene.tweens.add({
            targets: ring,
            scale: scale,
            alpha: { from: .9, to: 0 },
            duration: 360,
            ease: "Cubic.easeOut",
            onComplete: () => ring.destroy(),
        });
    }

    starBurst(slot) {

        const count = 7;

        for (let i = 0; i < count; i++) {

            const angle = ((Math.PI * 2 * i) / count) - Math.PI / 2;
            const distance = 60 + Phaser.Math.Between(0, 30);

            const star = this.scene.add.sprite(slot.character.x, this.charY, "sheet", "Star");
            star.setOrigin(.5);
            star.setScale(0);
            this.bubbleGrp.add(star);

            this.scene.tweens.add({
                targets: star,
                x: slot.character.x + Math.cos(angle) * distance,
                y: this.charY + Math.sin(angle) * distance * .8,
                angle: Phaser.Math.Between(-180, 180),
                duration: 640,
                ease: "Cubic.easeOut",
                onComplete: () => star.destroy(),
            });

            this.scene.tweens.chain({
                targets: star,
                tweens: [
                    { scale: this.artScale * .5, duration: 200, ease: "Back.easeOut" },
                    { scale: 0, alpha: 0, duration: 420, ease: "Sine.easeIn" },
                ]
            });
        }
    }

    isComplete() {
        return this.targetArr.length > 0 && this.targetArr.every(target => target.done);
    }

    // Landscape squashes the stall's vertical layout and shrinks its art
    // instead of scaling the container, so the counter still spans the full
    // screen width and every position below stays in gameGroup units.
    layout() {

        const landscape = dimensions.isLandscape;

        this.squash = landscape ? LANDSCAPE_SQUASH : 1;
        this.artFactor = landscape ? LANDSCAPE_ART : 1;
        this.artScale = ART * this.artFactor;

        this.bubbleY = BUBBLE_Y * this.squash;
        this.charY = CHAR_Y * this.squash;
        this.plantY = PLANT_Y * this.squash;
        this.silverTop = SILVER_TOP * this.squash;
        this.woodTop = WOOD_TOP * this.squash;
        this.plateY = PLATE_Y * this.squash;
        this.foodY = FOOD_Y * this.squash;
    }

    // Where the stall stops and the board's space begins, in gameGroup units.
    // Stateless so the board can ask for it whatever order adjust() runs in.
    getContentBottom() {

        if (!dimensions.isLandscape) return dimensions.topOffset + PANEL_BOTTOM;
        return dimensions.topOffset + LANDSCAPE_TOP + (PANEL_BOTTOM * LANDSCAPE_SQUASH);
    }

    adjust() {

        this.layout();

        this.x = dimensions.gameWidth / 2;
        this.y = dimensions.topOffset + (dimensions.isLandscape ? LANDSCAPE_TOP : 0);

        const visibleWidth = dimensions.actualWidth;

        // The counter spans (almost) the full screen, the plank overflows it —
        // matching the proportions the art was drawn at (1046 / 1314 of 1080).
        // Their height is taken from the portrait screen width so widening the
        // stall on a landscape screen does not make it tall as well.
        const heightRef = (dimensions.isLandscape ? dimensions.gameHeight : visibleWidth) * this.squash;

        this.silverTable.y = this.silverTop;
        this.silverTable.setScale(
            (visibleWidth * .97) / this.silverTable.width,
            (heightRef * .97) / this.silverTable.width
        );

        const woodScaleX = (visibleWidth * 1.22) / this.woodTable.width;
        const woodScaleY = (heightRef * 1.22) / this.woodTable.width;
        this.woodTable.setScale(woodScaleX, woodScaleY);
        this.woodTable.y = this.woodTop - (WOOD_TRIM * woodScaleY);

        // The plants hug the outer edges of the visible screen.
        this.leftPlant.setScale(this.artScale);
        this.rightPlant.setScale(this.artScale);
        this.leftPlant.y = this.plantY;
        this.rightPlant.y = this.plantY;

        const plantX = (visibleWidth / 2) - (this.leftPlant.displayWidth / 2) + (PLANT_INSET * this.artFactor);
        this.leftPlant.x = -plantX;
        this.rightPlant.x = plantX;

        const bubbleX = BUBBLE_X * this.artFactor;

        // Keep the outer characters (and their bubbles) inside the screen on
        // narrow aspect ratios by capping how far the slots can spread.
        let edge = 0;
        for (let i = 0; i < this.targetArr.length; i++) {

            const slot = this.targetArr[i];

            slot.character.setScale(this.artScale);
            slot.plate.setScale(this.artScale);
            slot.foodSprite.setScale(this.artScale);
            slot.bubble.setScale(this.artScale);
            slot.badge.setScale(this.artScale);
            slot.iconScale = this.artScale * .8;
            slot.icon.setScale(slot.iconScale);

            edge = Math.max(edge, slot.character.displayWidth / 2, bubbleX + (44 * this.artFactor));
        }

        const slots = Math.max(1, this.targetArr.length - 1);
        const maxSpacing = ((visibleWidth / 2) - edge - 4) / (slots / 2);

        // A landscape screen is wide enough for the cap above to fling the
        // outer customers into the corners, so the row also stays within a
        // share of the screen and keeps reading as one stall.
        const spacing = Math.min(this.silverTable.displayWidth * SLOT_RATIO, maxSpacing, visibleWidth * SLOT_SPREAD);

        for (let i = 0; i < this.targetArr.length; i++) {

            const slot = this.targetArr[i];
            const offset = (i - (this.targetArr.length - 1) / 2) * spacing;

            slot.character.x = offset;
            slot.character.y = this.charY;

            slot.plate.x = offset;
            slot.plate.y = this.plateY;

            slot.foodSprite.x = offset;
            slot.foodSprite.y = this.foodY;

            slot.bubble.x = offset + bubbleX;
            slot.bubble.y = this.bubbleY;

            slot.icon.x = slot.bubble.x + (5 * this.artFactor);
            slot.icon.y = this.bubbleY - (7 * this.artFactor);

            slot.badge.x = slot.bubble.x + (30 * this.artFactor);
            slot.badge.y = this.bubbleY - (30 * this.artFactor);
            slot.countTxt.x = slot.badge.x;
            slot.countTxt.y = slot.badge.y;

            // Position used by the collect tweens, in gameGroup space.
            slot.x = this.x + slot.bubble.x;
            slot.y = this.y + this.bubbleY;
        }
    }

    show() {
        this.visible = true;
        this.adjust();
    }
}