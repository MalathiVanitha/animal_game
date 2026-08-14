import data from "../data/data.js";

const ART = 0.5;

const PANEL_X = 92;
const PANEL_Y = 45;
const STAR_GAP = 27;
const STAR_SCALE = ART * .85;
const HUD_SCALE = .7;

export class Life extends Phaser.GameObjects.Container {

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

        this.max = this.level.lives || 5;
        this.value = this.max;
        this.regenSeconds = this.level.lifeRegenSeconds || 1800;
        this.stars = [];

        // this.bar = this.scene.add.sprite(0, 0, "sheet", "Star Bar");
        // this.bar.setOrigin(.5);
        // this.bar.setScale((this.max * STAR_GAP + 20) / this.bar.width, ART * 1.5);
        // this.add(this.bar);

        // for (let i = 0; i < this.max; i++) {

        //     const star = this.scene.add.sprite(0, 0, "sheet", "Star");
        //     star.setOrigin(.5);
        //     star.setScale(STAR_SCALE);
        //     this.add(star);
        //     this.stars.push(star);
        // }

        this.timerTxt = this.scene.add.text(0, 22, "", {
            fontFamily: "Oduda-Bold-Demo",
            fontSize: 18,
            fill: "#ffffff",
            align: "center",
        }).setOrigin(.5);
        this.add(this.timerTxt);

        this.layoutStars();
        this.refresh();
        this.adjust();
    }

    layoutStars() {

        for (let i = 0; i < this.stars.length; i++) {
            this.stars[i].x = (i - (this.max - 1) / 2) * STAR_GAP;
            this.stars[i].y = 0;
        }
    }

    refresh() {

        for (let i = 0; i < this.stars.length; i++) {

            const filled = i < this.value;
            this.stars[i].setAlpha(filled ? 1 : .35);
            this.stars[i].setTint(filled ? 0xffffff : 0x6b6b6b);
        }

        if (this.value >= this.max) {
            this.stopTimer();
            this.timerTxt.setText("");
        } else {
            this.startTimer();
        }
    }

    /**
     * Consumes a life. Fires onEmpty() when the last one is spent.
     */
    lose(amount = 1) {

        if (this.value <= 0) return 0;

        this.value = Math.max(0, this.value - amount);

        const star = this.stars[this.value];
        if (star) {
            this.scene.tweens.add({
                targets: star,
                scale: { from: STAR_SCALE * 1.4, to: STAR_SCALE },
                duration: 220,
                ease: "Back.easeOut",
            });
        }

        this.refresh();

        if (this.value <= 0 && this.onEmpty) this.onEmpty();

        return this.value;
    }

    gain(amount = 1) {

        this.value = Math.min(this.max, this.value + amount);
        this.refresh();
        return this.value;
    }

    setLives(value) {
        this.value = Phaser.Math.Clamp(value, 0, this.max);
        this.refresh();
    }

    startTimer() {

        if (this.timerEvent) return;

        this.secondsLeft = this.regenSeconds;
        this.updateTimerText();

        this.timerEvent = this.scene.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {

                this.secondsLeft--;

                if (this.secondsLeft <= 0) {
                    this.stopTimer();
                    this.gain(1);
                    return;
                }

                this.updateTimerText();
            },
        });
    }

    stopTimer() {

        if (!this.timerEvent) return;

        this.timerEvent.remove();
        this.timerEvent = null;
    }

    updateTimerText() {

        const minutes = Math.floor(this.secondsLeft / 60);
        const seconds = this.secondsLeft % 60;

        this.timerTxt.setText(minutes + ":" + Phaser.Utils.String.Pad(seconds, 2, "0", 1));
    }

    adjust() {

        // Mirrors Moves on the right hand side, on the same landscape scale.
        const hudScale = dimensions.isLandscape ? HUD_SCALE : 1;

        this.setScale(hudScale);
        this.x = dimensions.rightOffset - (PANEL_X * hudScale);
        this.y = dimensions.topOffset + (PANEL_Y * hudScale);
    }
}
