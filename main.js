import Handler from './scenes/handler.js'
import Preload from './scenes/preload.js'
import GameScene from './scenes/GameScene.js'
import BootScene from './scenes/BootScene.js';

// Aspect Ratio 16:9 - Portrait

const ratio = window.devicePixelRatio;

const config = {
    type: Phaser.CANVAS,
    scale: {
        mode: Phaser.Scale.FIT,
        parent: 'game',
        width: (window.innerWidth * ratio),
        height: (window.innerHeight * ratio),

    },
    dom: {
        createContainer: true
    },
    scene: [BootScene, Handler, GameScene, Preload],
    plugins: {
        scene: [
            { key: 'SpinePlugin', plugin: window.SpinePlugin, mapping: 'spine' }
        ]
    }
}

const game = new Phaser.Game(config)

// Global
game.debugMode = false;
game.embedded = false // game is embedded into a html iframe/object

game.screenBaseSize = {

    width: window.innerWidth * ratio,
    height: window.innerHeight * ratio
}

window.addEventListener("resize", () => {

    game.scale.setGameSize(window.innerWidth * ratio, window.innerHeight * ratio);
    game.canvas.style.width = (window.innerWidth) + 'px';
    game.canvas.style.height = (window.innerHeight) + 'px';
    game.scale.updateBounds();
    game.scale.refresh();

}, false);
game.orientation = "portrait"