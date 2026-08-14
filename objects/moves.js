import data from "../data/data.js";

const ART = 0.5;

const PANEL_X = 78;
const PANEL_Y = 45;
const STAR_Y = 42;
const STAR_GAP = 30;
const STAR_SCALE = ART * 1.15;
const HUD_SCALE = .7;

export class Moves extends Phaser.GameObjects.Container {

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

        this.value = this.level.moves || 30;
        this.total = this.value;
        this.stars = [];
        this.outOfMoves = false;

        this.panel = this.scene.add.sprite(0, 0, "sheet", "Button");
        this.panel.setOrigin(.5);
        this.panel.setScale(ART +.1);
        this.add(this.panel);

        this.label = this.scene.add.text(0, -12, "Moves", {
            fontFamily: "Oduda-Bold-Demo",
            fontSize: 20,
            fill: "#ffffff",
            align: "center",
        }).setOrigin(.5);
        this.add(this.label);

        this.valueTxt = this.scene.add.text(0, 10, this.value, {
            fontFamily: "Oduda-Bold-Demo",
            fontSize: 28,
            fill: "#ffffff",
            align: "center",
        }).setOrigin(.5);
        this.add(this.valueTxt);

        this.starBar = this.scene.add.sprite(0, STAR_Y, "sheet", "Star Bar");
        this.starBar.setOrigin(.5);
        this.starBar.setScale(ART * 1.35);
        this.add(this.starBar);

        for (let i = 0; i < 3; i++) {

            const star = this.scene.add.sprite((i - 1) * STAR_GAP, STAR_Y, "sheet", "Star");
            star.setOrigin(.5);
            star.setScale(STAR_SCALE);
            star.earned = false;
            star.setAlpha(.45);
            this.add(star);
            this.stars.push(star);
        }

        this.adjust();
    }

    /**
     * Spends moves. Fires onOut() once the counter hits zero.
     */
    use(amount = 1) {

        if (this.outOfMoves) return this.value;

        this.value = Math.max(0, this.value - amount);
        this.valueTxt.setText(this.value);

        this.scene.tweens.add({
            targets: this.valueTxt,
            scale: { from: 1.3, to: 1 },
            duration: 180,
            ease: "Back.easeOut",
        });

        if (this.value <= 0) {
            this.outOfMoves = true;
            if (this.onOut) this.onOut();
        }

        return this.value;
    }

    /**
     * Grants extra moves, e.g. from the "+5" booster.
     */
    addMoves(amount) {

        this.value += amount;
        this.outOfMoves = false;
        this.valueTxt.setText(this.value);
        return this.value;
    }

    /**
     * Lights up stars, e.g. earnStars(2) after two targets are served.
     */
    earnStars(count) {

        for (let i = 0; i < this.stars.length; i++) {

            const star = this.stars[i];
            const earned = i < count;

            if (earned === star.earned) continue;

            star.earned = earned;
            star.setAlpha(earned ? 1 : .45);

            if (earned) {
                this.scene.tweens.add({
                    targets: star,
                    scale: { from: STAR_SCALE * 1.5, to: STAR_SCALE },
                    duration: 260,
                    ease: "Back.easeOut",
                });
            }
        }
    }

    reset() {
        this.value = this.total;
        this.outOfMoves = false;
        this.valueTxt.setText(this.value);
        this.earnStars(0);
    }

    adjust() {

        // Pinned to the top left of the visible screen, smaller in landscape
        // where it shares a short top strip with the counter.
        const hudScale = dimensions.isLandscape ? HUD_SCALE : 1;

        this.setScale(hudScale);
        this.x = dimensions.leftOffset + (PANEL_X * hudScale);
        this.y = dimensions.topOffset + ((PANEL_Y - 10) * hudScale);
    }
}
