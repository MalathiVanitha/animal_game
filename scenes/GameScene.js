import { fullScreen } from '../utils/screen.js'
import { pointerUp } from '../utils/buttons.js'
import { CTA } from '../objects/cta.js';
import SoundManager from '../objects/SoundManager.js';
import AnimationManager from '../objects/AnimationManager.js';
import animationData from '../data/animation-data.js';
import { Board } from '../objects/board.js';
import { TopPanel } from '../objects/top-panel.js';
import { Moves } from '../objects/moves.js';
import { Life } from '../objects/life.js';
import { UIPanel } from '../objects/ui-panel.js';

export default class GameScene extends Phaser.Scene {

    // Vars
    handlerScene = null

    constructor() {
        super('GameScene')
    }

    preload() {

        this.switchMode();

        let ratio = window.devicePixelRatio;

        dimensions.fullWidth = window.innerWidth * ratio;
        dimensions.fullHeight = window.innerHeight * ratio;

        this.setGameScale();

        this.handlerScene = this.scene.get('handler')
        this.scale.on('resize', this.orinetaionChange, this)
    }

    orinetaionChange() {

        this.switchMode();
        this.setGameScale();
        this.setPositions();
    }

    createAnimations() {
        for (let i = 0; i < animationData.atlas.length; i++) {
            this.animationManager.createAnimations(animationData.atlas[i]);
        }

        for (let i = 1; i < animationData.fxAtlas.length; i++) {
            this.animationManager.createAnimations(animationData.fxAtlas[i]);
        }
    }

    create() {
        this.level = 1;
        this.game.gameScene = this;

        this.animationManager = new AnimationManager(this);
        this.createAnimations();

        this.superGroup = this.add.container();
        this.gameGroup = this.add.container();
        this.superGroup.add(this.gameGroup);

        this.bg = this.add.sprite(0, -240, "background");
        this.bg.setOrigin(.5);
        this.gameGroup.add(this.bg);

        this.board = new Board(this, 0, 0, this);
        this.gameGroup.add(this.board);

        this.topPanel = new TopPanel(this, 0, 0, this);
        this.gameGroup.add(this.topPanel);

        this.uiPanel = new UIPanel(this, 0, 0, this);
        this.gameGroup.add(this.uiPanel);

        this.moves = new Moves(this, 0, 0, this);
        this.moves.onOut = () => this.checkWin(this.topPanel.isComplete());
        this.gameGroup.add(this.moves);

        this.life = new Life(this, 0, 0, this);
        this.gameGroup.add(this.life);

        // Collected food flies over the board and the panel, but under the popup.
        this.flyGrp = this.add.container();
        this.gameGroup.add(this.flyGrp);

        this.cta = new CTA(this, 0, 0, this);
        this.gameGroup.add(this.cta)

        this.setPositions();
    }

    hideUI() {

    }

    checkWin(gameWin = false) {
        if (this.gameOver) return;
        this.gameOver = true;
        this.board.gameEnded = true;

        if (gameWin) {
            this.cta.userWon = true;
        } else {
            this.cta.userWon = false;
        }
        this.board.canClick = false;
        this.time.addEvent({
            delay: 500,
            callback: () => {
                this.cta.show();
            }
        });
    }

    /**
     * Sends one matched tile to the customer who ordered it.
     *
     * The tile pops off the board, leans into the direction it is about to
     * travel, then swings up to the order bubble along a curve, trailing ghosts
     * and accelerating the whole way in - so the arrival lands on the beat where
     * the counter punches down.
     *
     * @param {string} frameName atlas frame, plain ("Burger") or namespaced ("blocks/burger")
     * @param {number} boardX tile position, in board space
     * @param {number} boardY tile position, in board space
     * @param {number} order position within its match, used to stagger the flight
     * @returns {boolean} false when nobody ordered this food - the board pops it in place instead
     */
    collectTile(frameName, boardX, boardY, order = 0) {

        const name = String(frameName).split("/").pop();
        const slot = this.topPanel.reserve(name);

        if (!slot) return false;

        // The board is a scaled container, the flight happens outside it.
        const startX = this.board.x + (boardX * this.board.scaleX);
        const startY = this.board.y + (boardY * this.board.scaleY);
        const scale = this.board.tileScale * this.board.scaleX;

        const flyer = this.add.sprite(startX, startY, "sheet", frameName);
        flyer.setOrigin(.5);
        flyer.setScale(scale);
        this.flyGrp.add(flyer);

        const dx = slot.x - startX;
        const dy = slot.y - startY;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        const delay = order * 70;
        const popTime = 210;
        const popDip = 14;
        const flightTime = Phaser.Math.Clamp(360 + distance * .5, 420, 820);

        this.playSounds("collect");

        // 1. Anticipation - it swells and sinks back before it leaves.
        this.tweens.add({
            targets: flyer,
            scale: scale * 1.45,
            y: startY + popDip,
            angle: dx >= 0 ? -16 : 16,
            delay: delay,
            duration: popTime,
            ease: "Back.easeOut",
        });

        // 2. The flight path bows outwards and downwards away from the straight
        //    line, so the food swings out and hooks into the bubble.
        const from = new Phaser.Math.Vector2(startX, startY + popDip);
        const to = new Phaser.Math.Vector2(slot.x, slot.y);

        const side = dx >= 0 ? 1 : -1;
        const bow = distance * .22;

        const control = new Phaser.Math.Vector2(
            ((from.x + to.x) / 2) + ((-dy / distance) * bow * side),
            ((from.y + to.y) / 2) + ((dx / distance) * bow * side)
        );

        const curve = new Phaser.Curves.QuadraticBezier(from, control, to);
        const point = new Phaser.Math.Vector2();

        let trail = null;

        // Ghosts of itself, thinning out behind the flight.
        this.time.delayedCall(delay + popTime, () => {

            trail = this.time.addEvent({
                delay: 55,
                loop: true,
                callback: () => {

                    if (!flyer.active) return;

                    const ghost = this.add.sprite(flyer.x, flyer.y, "sheet", frameName);
                    ghost.setOrigin(.5);
                    ghost.setScale(flyer.scale * .9);
                    ghost.setAngle(flyer.angle);
                    ghost.setAlpha(.4);
                    this.flyGrp.add(ghost);
                    this.flyGrp.sendToBack(ghost);

                    this.tweens.add({
                        targets: ghost,
                        alpha: 0,
                        scale: ghost.scale * .5,
                        duration: 280,
                        ease: "Sine.easeOut",
                        onComplete: () => ghost.destroy(),
                    });
                }
            });
        });

        // Shrinking and spinning run on their own easings - all three finishing
        // together is what makes it read as one move instead of three tweens.
        this.tweens.add({
            targets: flyer,
            scale: scale * .5,
            delay: delay + popTime,
            duration: flightTime,
            ease: "Quad.easeIn",
        });

        this.tweens.add({
            targets: flyer,
            angle: dx >= 0 ? 28 : -28,
            delay: delay + popTime,
            duration: flightTime,
            ease: "Sine.easeInOut",
        });

        this.tweens.addCounter({
            from: 0,
            to: 1,
            delay: delay + popTime,
            duration: flightTime,
            ease: "Cubic.easeIn",
            onUpdate: (tween) => {

                curve.getPoint(tween.getValue(), point);

                flyer.x = point.x;
                flyer.y = point.y;
            },
            onComplete: () => {

                if (trail) trail.remove();

                flyer.destroy();
                this.topPanel.collect(slot);
            }
        });

        return true;
    }

    clickBackScene(sceneTxt) {
        const scene = this.scene.get(sceneTxt)
        let gotoScene
        let bgColorScene

        switch (sceneTxt) {
            case "title":
                this.creditsTxt.visible = false
                return
        }

        scene.sceneStopped = true
        scene.scene.stop(sceneTxt)
        this.handlerScene.cameras.main.setBackgroundColor(bgColorScene)
        this.handlerScene.launchScene(gotoScene)
    }

    setGameScale() {
        let scaleX = dimensions.fullWidth / dimensions.gameWidth;
        let scaleY = dimensions.fullHeight / dimensions.gameHeight;


        this.gameScale = (scaleX < scaleY) ? scaleX : scaleY;

        dimensions.actualWidth = dimensions.fullWidth / this.gameScale;
        dimensions.actualHeight = dimensions.fullHeight / this.gameScale;

        dimensions.leftOffset = -(dimensions.actualWidth - dimensions.gameWidth) / 2;
        dimensions.rightOffset = dimensions.gameWidth - dimensions.leftOffset;
        dimensions.topOffset = -(dimensions.actualHeight - dimensions.gameHeight) / 2;
        dimensions.bottomOffset = dimensions.gameHeight - dimensions.topOffset;
    }

    switchMode() {

        let ratio = window.devicePixelRatio;
        let isPortrait;
        dimensions.fullWidth = window.innerWidth * ratio;
        dimensions.fullHeight = window.innerHeight * ratio;

        if (dimensions.isPortrait != dimensions.fullWidth < dimensions.fullHeight) {
            isPortrait = true
        } else {
            isPortrait = false
        }

        dimensions.isPortrait = isPortrait;
        dimensions.isLandscape = !isPortrait;

        if (dimensions.fullWidth < dimensions.fullHeight) {
            dimensions.gameWidth = 540;
            dimensions.gameHeight = 960;
            dimensions.isPortrait = true;
            dimensions.isLandscape = false;
        } else {

            dimensions.gameWidth = 960;
            dimensions.gameHeight = 540;
            dimensions.isLandscape = true;
            dimensions.isPortrait = false;
        }

    }

    setPositions() {

        let ratio = window.devicePixelRatio;
        this.superGroup.scale = this.gameScale
        this.gameGroup.x = (dimensions.fullWidth / this.gameScale - dimensions.gameWidth) / 2;
        this.gameGroup.y = (dimensions.fullHeight / this.gameScale - dimensions.gameHeight) / 2;

        this.bg.setScale(1);

        let scaleX = dimensions.actualWidth / this.bg.displayWidth;
        let scaleY = dimensions.actualHeight / this.bg.displayHeight;
        let scale = Math.max(scaleX, scaleY);

        this.bg.setScale(scale, scale * .99);

        if (dimensions.isLandscape) {

            this.bg.x = dimensions.gameWidth / 2;
            this.bg.y = dimensions.gameHeight / 2;
        } else {

            this.bg.x = dimensions.gameWidth / 2;
            this.bg.y = dimensions.gameHeight / 2 + 10;
        }

        // The counter first - the board sizes itself to the space left below it.
        this.topPanel.adjust();
        this.board.adjust();
        this.uiPanel.adjust();
        this.moves.adjust();
        this.life.adjust();
        this.cta.adjust();
    }

    // Live pointer position - the board reads this every frame while dragging, so
    // it has to follow the finger, not stay at wherever it went down.
    offsetMouse() {

        return {
            x: (this.game.input.activePointer.worldX * dimensions.actualWidth / dimensions.fullWidth) + ((dimensions.gameWidth - dimensions.actualWidth) / 2),
            y: (this.game.input.activePointer.worldY * dimensions.actualHeight / dimensions.fullHeight) + ((dimensions.gameHeight - dimensions.actualHeight) / 2)
        };
    }

    playSounds(name) {

        if (!this.cache.audio.exists(name)) return;
        this.sound.play(name);
    }

    offsetWorld(point) {
        return { x: (point.x * dimensions.actualWidth / this.game.width), y: 0(point.y * dimensions.actualHeight / this.game.height) };
    }

    updateResize(scene) {

        let ratio = window.devicePixelRatio;
        scene.scale.on('resize', this.resize, scene)

        const scaleWidth = scene.scale.gameSize.width * ratio
        const scaleHeight = scene.scale.gameSize.height * ratio

        scene.parent = new Phaser.Structs.Size(scaleWidth, scaleHeight)
        scene.sizer = new Phaser.Structs.Size(scene.width, scene.height, Phaser.Structs.Size.FIT, scene.parent)

        scene.parent.setSize(scaleWidth, scaleHeight)
        scene.sizer.setSize(scaleWidth, scaleHeight)

        this.updateCamera(scene)
    }

    update() {

        if (this.board) this.board.update();
    }

    resize(gameSize) {

        // 'this' means to the current scene that is running
        if (!this.sceneStopped) {

            let ratio = window.devicePixelRatio;
            const width = gameSize.width * ratio;
            const height = gameSize.height * ratio;

            this.parent.setSize(width, height);
            this.sizer.setSize(width, height);
        }
    }

    updateCamera(scene) {
        const camera = scene.cameras.main
        const scaleX = scene.sizer.width / this.game.screenBaseSize.width
        const scaleY = scene.sizer.height / this.game.screenBaseSize.height

        camera.setZoom(Math.max(scaleX, scaleY))
        camera.centerOn(this.game.screenBaseSize.width / 2, this.game.screenBaseSize.height / 2)
    }
}