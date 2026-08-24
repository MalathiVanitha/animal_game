import data from "../data/data.js";

// The art is authored for a 1080px wide screen, the game runs in 540x960 units.
const ART = 0.5;

// Vertical layout, measured from the top of the visible screen (in game units).
const CHAR_Y = 252;
const BUBBLE_Y = 156;
const SILVER_TOP = 320;
const WOOD_TOP = 322;
const PLATE_Y = 352;

// The goal food sits on the plate from the moment the customer arrives - and it
// is its own progress bar. A ghosted copy shows the whole goal, a solid copy on
// top of it is clipped to how much of the order has been collected, so the goal
// fills up from the bottom as the matching tiles land.
const FOOD_Y = 362;
const GOAL_ALPHA = .45;

// The goal is read at a glance from across the board, and it doubles as the
// progress meter, so it is drawn larger than the rest of the stall art.
const GOAL_SCALE = 1.45;
// How much of that it shrinks to once it is being carried in the hand.
const HELD_SCALE = .6;

// Where the collected goal ends up - tucked into the customer's hand, measured
// from the middle of the character sprite.
const HAND_X = -38;
const HAND_Y = 44;

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

// The customers are single frames in the atlas, so every "animation" below is
// procedural: a looping breath they always run, and one-off reactions played on
// top of it. IDLE_* is the resting breath, SAD_* the slumped version of it.
const IDLE_RISE = 3;
const IDLE_TIME = 1300;
const IDLE_SWAY = 1.6;
const SAD_DROOP = 4;
const SAD_TIME = 2100;
const SAD_TILT = 5;
const SAD_TINT = 0xc8d2ec;

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

        // The customers start breathing as they are created, and the breath is
        // measured in layout units - so those are worked out before anyone is
        // built, not just in the adjust() at the end of init().
        this.layout();

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

        // A level is a queue of orders. Only slotCount of them stand at the
        // counter at once - on the later levels there are more orders than
        // places to stand, so the ones still waiting walk on as the customers
        // in front of them finish and leave.
        const characters = this.level.characters || [];

        this.queue = characters.slice();
        this.totalOrders = characters.length;
        this.served = 0;
        this.slotCount = Math.min(this.level.slots || characters.length, characters.length);

        for (let position = 0; position < this.slotCount; position++) {

            const config = this.queue.shift();
            if (!config) break;

            this.characters.push(this.createCharacter(config, position));
        }

        this.tableGrp.add(this.woodTable);

        this.adjust();
    }

    createCharacter(config, position) {

        const character = this.scene.add.sprite(0, CHAR_Y, "sheet", config.character);
        character.setOrigin(.5, .5);
        character.setScale(ART);
        this.charGrp.add(character);

        const plate = this.scene.add.sprite(0, PLATE_Y, "sheet", "Plate");
        plate.setOrigin(.5, .5);
        plate.setScale(ART);
        this.plateGrp.add(plate);

        // The outline of what they want: the whole goal, ghosted back, so the
        // player can see how much of it is still to come.
        const ghost = this.scene.add.sprite(0, FOOD_Y, "sheet", config.food);
        ghost.setOrigin(.5, 1);
        ghost.setScale(ART * GOAL_SCALE);
        ghost.setAlpha(GOAL_ALPHA);
        this.plateGrp.add(ghost);

        // The same goal at full strength, clipped to the collected share. This
        // is the one that is kept once the order is complete.
        const food = this.scene.add.sprite(0, FOOD_Y, "sheet", config.food);
        food.setOrigin(.5, 1);
        food.setScale(ART * GOAL_SCALE);
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
            // Which place at the counter this customer is standing in. It is
            // the place, not the order they arrived in, that decides where they
            // stand and which way they walk off.
            position: position,
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
            // Mood the customer returns to once a reaction has played out:
            // "idle" normally, "sad" once the level is going badly.
            mood: "idle",
            idleTween: null,
            swayTween: null,
            reactTween: null,
            // Every customer breathes at a slightly different pace, otherwise
            // the whole counter moves as one animal.
            idlePhase: Phaser.Math.Between(0, 600),
            idleRate: Phaser.Math.FloatBetween(.85, 1.15),
            character: character,
            plate: plate,
            foodSprite: food,
            foodGhost: ghost,
            // 0..1, tweened towards remaining/total so the bar grows into place
            // instead of stepping. Kept on the slot so a resize can re-crop the
            // fill without knowing how far through the tween it is.
            fill: 0,
            fillTween: null,
            bubble: bubble,
            icon: icon,
            badge: badge,
            countTxt: countTxt,
            // GameScene.addCandy() tweens collected tiles towards these.
            x: 0,
            y: 0,
        };

        this.targetArr.push(slot);

        this.idle(slot);

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

        // A tile that was matched as the level ended has nobody to fly to: the
        // counter it was ordered from is on its way off screen.
        if (this.retired) return null;

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

        // A tile still in the air when the level ended lands on a counter that
        // has already been thrown away - it has nothing left to update.
        if (this.retired || !slot.countTxt.scene) return;

        slot.pending = Math.max(0, slot.pending - amount);
        if (slot.done) return;

        slot.remaining = Math.max(0, slot.remaining - amount);
        slot.countTxt.setText(slot.remaining);

        this.advanceFill(slot);
        this.impact(slot);

        if (slot.remaining <= 0) {
            slot.done = true;
            this.served++;
            this.serve(slot);
        }

        if (this.scene.moves) {
            this.scene.moves.earnStars(Math.floor((this.served / this.totalOrders) * 3));
        }

        if (this.isComplete()) {
            this.scene.checkWin(true);
        }
    }

    /**
     * Clips the solid goal to slot.fill, from the bottom up - the goal filling
     * in is the progress bar. The crop is in texture pixels, so it is
     * independent of whatever scale the layout is running at.
     */
    drawFill(slot) {

        if (!slot.foodSprite || !slot.foodSprite.scene) return;

        // Once it has been claimed it is a whole item being carried, not a
        // meter - anything cropping it has to be off.
        if (slot.collected) {
            slot.foodSprite.setCrop();
            slot.foodSprite.setVisible(true);
            return;
        }

        const frame = slot.foodSprite.frame;
        const height = frame.height * Phaser.Math.Clamp(slot.fill, 0, 1);

        if (height <= 0) {
            slot.foodSprite.setVisible(false);
            return;
        }

        slot.foodSprite.setVisible(true);
        slot.foodSprite.setCrop(0, frame.height - height, frame.width, height);
    }

    /**
     * Grows the goal towards how much of the order has been collected. Tweened
     * rather than set, so a match of three reads as the goal filling up.
     */
    advanceFill(slot) {

        const to = slot.total > 0 ? (slot.total - slot.remaining) / slot.total : 1;

        if (slot.fillTween) slot.fillTween.stop();

        slot.fillTween = this.scene.tweens.add({
            targets: slot,
            fill: to,
            duration: 420,
            ease: "Cubic.easeOut",
            onUpdate: () => this.drawFill(slot),
            onComplete: () => {
                slot.fillTween = null;
                this.drawFill(slot);
            },
        });
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
     * The order is finished. The goal fills the rest of the way first - it is
     * what the player has been watching - then it turns solid, is collected off
     * the plate into the customer's hand, and they leave with it.
     */
    serve(slot) {

        slot.countTxt.setText("");

        this.scene.tweens.add({
            targets: [slot.icon, slot.badge],
            alpha: .35,
            duration: 260,
            ease: "Sine.easeOut",
        });

        // The last tiles are still filling the goal in - it is not "won" until
        // it has topped all the way out.
        if (slot.fillTween) slot.fillTween.stop();

        slot.fillTween = this.scene.tweens.add({
            targets: slot,
            fill: 1,
            duration: 300,
            ease: "Cubic.easeOut",
            onUpdate: () => this.drawFill(slot),
            onComplete: () => {
                slot.fillTween = null;
                this.drawFill(slot);
                this.claim(slot);
            },
        });
    }

    /**
     * Filled: the goal is whole, so it comes off the meter - full alpha, no
     * crop - pops, and is collected into the character's hand. The ghost behind
     * it has nothing left to show, so it fades away.
     */
    claim(slot) {

        if (this.retired || !slot.foodSprite.scene) return;

        this.scene.tweens.killTweensOf(slot.foodSprite);

        slot.collected = true;
        this.drawFill(slot);
        slot.foodSprite.setAlpha(1);

        this.scene.tweens.add({
            targets: slot.foodGhost,
            alpha: 0,
            duration: 220,
            ease: "Sine.easeOut",
        });

        // The pop is what marks the goal as claimed - it lifts off the plate
        // before it travels.
        this.scene.tweens.add({
            targets: slot.foodSprite,
            scale: { from: this.goalScale, to: this.goalScale * 1.25 },
            duration: 220,
            ease: "Back.easeOut",
            onComplete: () => {

                if (this.retired || !slot.foodSprite.scene) return;

                // Into the hand. adjust() leaves a collected goal there.
                const restX = this.restingX(slot);

                this.scene.tweens.add({
                    targets: slot.foodSprite,
                    x: restX + (HAND_X * this.artFactor) + (slot.shift || 0),
                    y: this.charY + (HAND_Y * this.artFactor),
                    scale: this.goalScale * HELD_SCALE,
                    duration: 420,
                    ease: "Back.easeIn",
                    onComplete: () => {

                        if (this.retired || !slot.character.scene) return;

                        this.react(slot, "happy");
                        this.starBurst(slot);
                        this.scene.playSounds("order_complete");

                        // They have what they came for - they do not stand
                        // around for the rest of the level.
                        this.scene.time.delayedCall(520, () => this.dismiss(slot));
                    },
                });
            },
        });
    }

    /**
     * A customer bob. Tracked per slot so rapid collects restart the hop instead
     * of stacking offsets on top of each other.
     */
    hop(slot, height, duration) {

        if (slot.hopTween) slot.hopTween.stop();

        this.stopIdle(slot);

        slot.hopTween = this.scene.tweens.add({
            targets: slot.character,
            y: this.charY - height,
            scaleX: this.artScale * .95,
            scaleY: this.artScale * 1.07,
            duration: duration * .45,
            ease: "Quad.easeOut",
            yoyo: true,
            onComplete: () => {
                slot.hopTween = null;
                this.idle(slot);
            }
        });
    }

    // ---- Character animation ---------------------------------------------
    //
    // The atlas holds one still frame per animal, so the customers are animated
    // by tween instead of by frame: a breath that loops for as long as they are
    // standing at the counter, and short reactions - happy when an order lands,
    // sad when the level starts slipping away - that take the sprite over and
    // hand it back to the breath afterwards.
    //
    // Everything is written against the layout values (charY, artScale), and
    // adjust() re-applies those on every resize, so idle() is restarted from
    // there rather than left tweening towards a position that has moved.

    /**
     * Starts (or restarts) the looping breath in the customer's current mood.
     * Safe to call repeatedly - it stops whatever was running first.
     */
    idle(slot) {

        if (this.retired || !slot.character || !slot.character.scene) return;
        if (slot.leaving) return;

        this.stopIdle(slot);

        const sad = slot.mood === "sad";
        const scale = this.artScale;
        const factor = this.artFactor;
        const rate = slot.idleRate;

        // Sad is the same breath, slower and heavier: they sink instead of
        // rising, lean off centre and lose a little colour.
        const rise = sad ? -SAD_DROOP : IDLE_RISE;
        const duration = (sad ? SAD_TIME : IDLE_TIME) * rate;

        slot.character.setAngle(sad ? -SAD_TILT : 0);
        slot.character.setScale(scale);
        slot.character.y = this.charY;

        if (sad) slot.character.setTint(SAD_TINT);
        else slot.character.clearTint();

        slot.idleTween = this.scene.tweens.add({
            targets: slot.character,
            y: this.charY - (rise * factor),
            scaleY: scale * (sad ? .972 : 1.035),
            scaleX: scale * (sad ? 1.022 : .984),
            duration: duration,
            delay: slot.idlePhase,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
        });

        // A slow lean on top of the breath, on its own clock, so the two never
        // line up into one obvious pulse.
        slot.swayTween = this.scene.tweens.add({
            targets: slot.character,
            angle: sad ? { from: -SAD_TILT, to: -SAD_TILT - 2 } : { from: -IDLE_SWAY, to: IDLE_SWAY },
            duration: (sad ? 2400 : 2100) * rate,
            delay: slot.idlePhase * 2,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
        });
    }

    /**
     * Stops the breath and puts the sprite back on its mark, so whatever plays
     * next starts from a known pose.
     */
    stopIdle(slot) {

        if (slot.idleTween) { slot.idleTween.stop(); slot.idleTween = null; }
        if (slot.swayTween) { slot.swayTween.stop(); slot.swayTween = null; }
        if (slot.reactTween) { slot.reactTween.stop(); slot.reactTween = null; }

        if (!slot.character || !slot.character.scene) return;

        slot.character.y = this.charY;
        slot.character.setScale(this.artScale);
        slot.character.setAngle(slot.mood === "sad" ? -SAD_TILT : 0);
    }

    /**
     * The mood a customer keeps between reactions.
     * @param {object} slot the order
     * @param {string} mood "idle" or "sad"
     */
    setMood(slot, mood) {

        if (!slot || slot.mood === mood) return;

        slot.mood = mood;

        if (mood === "sad") this.react(slot, "sad");
        else this.idle(slot);
    }

    /**
     * Same, for everyone still at the counter - the level is won or lost for
     * all of them at once.
     */
    setMoodAll(mood) {
        for (let i = 0; i < this.targetArr.length; i++) this.setMood(this.targetArr[i], mood);
    }

    /**
     * A reaction from everyone at the counter, staggered so they respond as a
     * row of individuals rather than in lockstep.
     */
    reactAll(kind) {

        for (let i = 0; i < this.targetArr.length; i++) {

            const slot = this.targetArr[i];

            this.scene.time.delayedCall(i * 110, () => {
                if (!this.retired && slot.character && slot.character.scene) this.react(slot, kind);
            });
        }
    }

    /**
     * A one-off reaction, played over the breath and handing back to it.
     * @param {object} slot the order
     * @param {string} kind "happy" or "sad"
     */
    react(slot, kind) {

        if (this.retired || !slot || !slot.character || !slot.character.scene) return;
        if (slot.leaving) return;

        this.stopIdle(slot);

        const scale = this.artScale;
        const factor = this.artFactor;
        const y = this.charY;

        if (kind === "happy") {

            slot.character.clearTint();

            // Two bounces, the second smaller, each one squashing on the way
            // down - the shape change is what reads as delight at this size.
            slot.reactTween = this.scene.tweens.chain({
                targets: slot.character,
                onComplete: () => { slot.reactTween = null; this.idle(slot); },
                tweens: [
                    { y: y + (4 * factor), scaleX: scale * 1.12, scaleY: scale * .88, duration: 110, ease: "Quad.easeOut" },
                    { y: y - (26 * factor), scaleX: scale * .9, scaleY: scale * 1.14, duration: 200, ease: "Quad.easeOut" },
                    { y: y, scaleX: scale * 1.08, scaleY: scale * .92, duration: 170, ease: "Quad.easeIn" },
                    { y: y - (14 * factor), scaleX: scale * .95, scaleY: scale * 1.06, duration: 170, ease: "Quad.easeOut" },
                    { y: y, scaleX: scale, scaleY: scale, duration: 220, ease: "Bounce.easeOut" },
                ],
            });

            // A wiggle across the bounces, so they twist rather than pogo.
            this.scene.tweens.add({
                targets: slot.character,
                angle: { from: -9, to: 9 },
                duration: 150,
                ease: "Sine.easeInOut",
                yoyo: true,
                repeat: 2,
                onComplete: () => { if (slot.character.scene) slot.character.setAngle(0); },
            });

            return;
        }

        // Sad: the wind goes out of them - they sink and squat, shake their
        // head twice, and the colour cools off.
        slot.character.setTint(SAD_TINT);

        slot.reactTween = this.scene.tweens.chain({
            targets: slot.character,
            onComplete: () => {
                slot.reactTween = null;
                // Back to whatever mood they were in: a worried glance when the
                // moves run low passes, the sag at the end of the level does not.
                this.idle(slot);
            },
            tweens: [
                { y: y + (6 * factor), scaleX: scale * 1.06, scaleY: scale * .93, duration: 320, ease: "Quad.easeOut" },
                { angle: -12, duration: 220, ease: "Sine.easeInOut" },
                { angle: 12, duration: 320, ease: "Sine.easeInOut" },
                { angle: -SAD_TILT, duration: 260, ease: "Sine.easeInOut" },
            ],
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


    // ---- Level change ----------------------------------------------------
    //
    // Between levels the customers walk off the side of the screen and the next
    // level's customers walk on. Everything that belongs to one customer - the
    // plate, the food, the order bubble and its badge - travels with them, moved
    // by an offset laid on top of the positions adjust() works out, so the
    // layout code stays the only thing that decides where they rest.

    slotParts(slot) {
        return [slot.character, slot.plate, slot.foodSprite, slot.foodGhost, slot.bubble, slot.icon, slot.badge, slot.countTxt];
    }

    // Everyone travels the same way: on from the left, off to the right. The
    // walk is one direction of traffic past the stall, so a customer arriving
    // never crosses one who is leaving.

    // Where a customer stands once nothing is shifting them, in container units.
    restingX(slot) {
        return slot.character.x - (slot.shift || 0);
    }

    // Clear of the edge means the order bubble is gone too, not just the animal.
    walkMargin(slot) {
        return (slot.character.displayWidth / 2) + (BUBBLE_X * this.artFactor) + 60;
    }

    // Offsets that park a customer just past the right edge of the visible
    // screen, and just before the left one. They are worked out from where the
    // customer stands, so the far-left place walks the longer way out and still
    // ends up off screen.
    exitShift(slot) {
        return ((dimensions.actualWidth / 2) + this.walkMargin(slot)) - this.restingX(slot);
    }

    entryShift(slot) {
        return -((dimensions.actualWidth / 2) + this.walkMargin(slot)) - this.restingX(slot);
    }

    applyShift(slot, value) {

        const parts = this.slotParts(slot);
        const previous = slot.shift || 0;

        for (let i = 0; i < parts.length; i++) {
            parts[i].x += (value - previous);
        }

        slot.shift = value;
        slot.x = this.x + slot.bubble.x;
    }

    /**
     * Walks one customer from wherever they are to a given offset.
     * The bob is what sells it as walking rather than sliding.
     */
    walkSlot(slot, to, duration, delay, onComplete) {

        const parts = this.slotParts(slot);
        const bases = parts.map(part => part.x - (slot.shift || 0));
        const proxy = { t: slot.shift || 0 };

        this.stopIdle(slot);
        this.scene.tweens.killTweensOf(slot.character);
        slot.character.y = this.charY;

        const steps = Math.max(2, Math.round(duration / 180));

        this.scene.tweens.add({
            targets: slot.character,
            y: this.charY - 12,
            duration: duration / (steps * 2),
            delay: delay,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: steps - 1,
            onComplete: () => { slot.character.y = this.charY; },
        });

        this.scene.tweens.add({
            targets: proxy,
            t: to,
            duration: duration,
            delay: delay,
            ease: "Sine.easeInOut",
            onUpdate: () => {

                slot.shift = proxy.t;

                for (let i = 0; i < parts.length; i++) {
                    parts[i].x = bases[i] + proxy.t;
                }

                slot.x = this.x + slot.bubble.x;
            },
            onComplete: () => {
                // A customer on their way off screen is about to be thrown
                // away - only the ones who stopped at the counter breathe again.
                if (!slot.leaving) this.idle(slot);
                if (onComplete) onComplete();
            }
        });
    }

    /**
     * One customer, served, walks off on their own - the rest of the counter
     * carries on. If somebody is still waiting in the queue they take the empty
     * place as soon as it is free.
     */
    dismiss(slot) {

        if (this.retired || slot.leaving) return;

        // The last order of the level is a different moment: the level change
        // walks everyone still at the counter off together.
        if (this.isComplete()) return;

        slot.leaving = true;

        this.walkSlot(slot, this.exitShift(slot), 760, 0, () => {

            const position = slot.position;

            this.removeSlot(slot);
            this.spawnNext(position);
        });
    }

    removeSlot(slot) {

        const parts = this.slotParts(slot);

        this.stopIdle(slot);
        this.scene.tweens.killTweensOf(parts);
        if (slot.hopTween) slot.hopTween.stop();

        for (let i = 0; i < parts.length; i++) {
            parts[i].destroy();
        }

        const target = this.targetArr.indexOf(slot);
        if (target !== -1) this.targetArr.splice(target, 1);

        const character = this.characters.indexOf(slot);
        if (character !== -1) this.characters.splice(character, 1);
    }

    /**
     * Fills a place at the counter with the next order in the queue: the new
     * customer starts off screen and walks in to it.
     * @returns {object|null} the new order, or null when the queue is empty
     */
    spawnNext(position) {

        if (this.retired) return null;

        const config = this.queue.shift();
        if (!config) return null;

        const slot = this.createCharacter(config, position);
        this.characters.push(slot);

        // adjust() puts them where they belong, then they are pushed back off
        // the side of the screen to walk in from.
        this.adjust();
        this.applyShift(slot, this.entryShift(slot));

        this.walkSlot(slot, 0, 800, 120);

        return slot;
    }

    /**
     * The finished customers leave. Calls back once the last one is off screen.
     */
    walkOut(onComplete) {

        const slots = this.targetArr;

        if (!slots.length) {
            if (onComplete) onComplete();
            return;
        }

        let left = slots.length;

        for (let i = 0; i < slots.length; i++) {

            const slot = slots[i];

            // The customer closest to the right edge leads the way out, so the
            // row files off instead of walking through itself.
            const order = (this.slotCount - 1) - slot.position;

            this.walkSlot(slot, this.exitShift(slot), 760, order * 130, () => {
                left--;
                if (left <= 0 && onComplete) onComplete();
            });
        }
    }

    /**
     * The next level's customers arrive, one after the other, from the side they
     * would have left by.
     */
    walkIn(onComplete) {

        const slots = this.targetArr;

        if (!slots.length) {
            if (onComplete) onComplete();
            return;
        }

        let left = slots.length;

        for (let i = 0; i < slots.length; i++) {
            this.applyShift(slots[i], this.entryShift(slots[i]));
        }

        for (let i = 0; i < slots.length; i++) {

            const slot = slots[i];

            // They come in single file from the left, so the one with the
            // furthest to walk - the right hand place - sets off first.
            const order = (this.slotCount - 1) - slot.position;

            this.walkSlot(slot, 0, 800, order * 150, () => {
                left--;
                if (left <= 0 && onComplete) onComplete();
            });
        }
    }

    isComplete() {
        return this.totalOrders > 0 && this.served >= this.totalOrders;
    }

    // Landscape squashes the stall's vertical layout and shrinks its art
    // instead of scaling the container, so the counter still spans the full
    // screen width and every position below stays in gameGroup units.
    layout() {

        const landscape = dimensions.isLandscape;

        this.squash = landscape ? LANDSCAPE_SQUASH : 1;
        this.artFactor = landscape ? LANDSCAPE_ART : 1;
        this.artScale = ART * this.artFactor;
        this.goalScale = this.artScale * GOAL_SCALE;

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
        this.y = dimensions.topOffset + (dimensions.isLandscape ? LANDSCAPE_TOP : 0) - dimensions.topOffset / 2 - dimensions.topOffset / 4;

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
            slot.foodSprite.setScale(slot.collected ? this.goalScale * HELD_SCALE : this.goalScale);
            slot.foodGhost.setScale(this.goalScale);
            slot.bubble.setScale(this.artScale);
            slot.badge.setScale(this.artScale);
            slot.iconScale = this.artScale * .8;
            slot.icon.setScale(slot.iconScale);

            edge = Math.max(edge, slot.character.displayWidth / 2, bubbleX + (44 * this.artFactor));
        }

        const slots = Math.max(1, this.slotCount - 1);
        const maxSpacing = ((visibleWidth / 2) - edge - 4) / (slots / 2);

        // A landscape screen is wide enough for the cap above to fling the
        // outer customers into the corners, so the row also stays within a
        // share of the screen and keeps reading as one stall.
        const spacing = Math.min(this.silverTable.displayWidth * SLOT_RATIO, maxSpacing, visibleWidth * SLOT_SPREAD);

        for (let i = 0; i < this.targetArr.length; i++) {

            const slot = this.targetArr[i];

            // Their place at the counter decides where they stand, so a
            // customer who arrives mid level lands exactly where the one they
            // replaced was standing. Whatever a walk has shifted them by is laid
            // on top of that, so a resize mid walk does not teleport them back.
            const offset = ((slot.position - (this.slotCount - 1) / 2) * spacing) + (slot.shift || 0);

            slot.character.x = offset;
            slot.character.y = this.charY;

            slot.plate.x = offset;
            slot.plate.y = this.plateY;

            slot.foodGhost.x = offset;
            slot.foodGhost.y = this.foodY;
            this.drawFill(slot);

            // Once the goal has been handed over it belongs to the character,
            // not the plate - a resize must not pull it back down.
            if (slot.collected) {
                slot.foodSprite.x = offset + (HAND_X * this.artFactor);
                slot.foodSprite.y = this.charY + (HAND_Y * this.artFactor);
            } else {
                slot.foodSprite.x = offset;
                slot.foodSprite.y = this.foodY;
            }

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

            // The breath is written against charY and artScale, both of which
            // have just moved - restart it rather than let it tween towards
            // where the customer used to stand.
            if (slot.idleTween && !slot.leaving) this.idle(slot);
        }
    }

    show() {
        this.visible = true;
        this.adjust();
    }

    /**
     * The counter is replaced whole between levels, so everything it started -
     * the walks, the hops, the bubble squashes - has to stop with it, and
     * anything still flying towards it has to be told there is nobody home.
     */
    destroy(fromScene) {

        this.retired = true;

        for (let i = 0; i < this.targetArr.length; i++) {

            const slot = this.targetArr[i];

            this.stopIdle(slot);
            if (slot.hopTween) slot.hopTween.stop();
            this.scene.tweens.killTweensOf(this.slotParts(slot));
        }

        super.destroy(fromScene);
    }
}