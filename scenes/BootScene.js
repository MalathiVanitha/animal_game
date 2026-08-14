import soundsData from "../data/sounds-data.js";
import animationData from "../data/animation-data.js"

export default class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'boot' });
    }

    preload() {
        this.load.image('background', 'assets/background.png');
        this.load.atlas('sheet', 'assets/sheet/sheet.png', 'assets/sheet/sheet.json')

        this.load.setPath('assets/spine');
        // this.load.spine('block_explosion', 'block_explosion.json', ['spine_sheet.atlas'], true);

        this.load.script('webfont', '../../js/webfont.js');

        //---------------------------------------------------------------------->
        this.load.setPath('assets/sounds');

        this.loadFont('Oduda-Bold-Demo', 'fonts/Oduda-Bold-Demo.otf');

        for (let i = 0; i < soundsData.music.length; i++) {

            this.load.audio(soundsData.music[i], soundsData.music[i] + ".mp3");
        }

        for (let i = 0; i < soundsData.sounds.length; i++) {

            this.load.audio(soundsData.sounds[i], soundsData.sounds[i] + ".mp3");
        }

        for (let i = 0; i < soundsData.fx.length; i++) {

            this.load.audio(soundsData.fx[i], soundsData.fx[i] + ".mp3");
        }

        this.load.setPath('assets/sheet/');
        for (let i = 0; i < animationData.atlas.length; i++) {
            this.load.atlas(animationData.atlas[i].name, animationData.atlas[i].name + '.png', animationData.atlas[i].name + '.json');
        }
        for (let i = 0; i < animationData.fxAtlas.length; i++) {
            this.load.atlas(animationData.fxAtlas[i], animationData.fxAtlas[i] + '.png', animationData.fxAtlas[i] + '.json');
        }

        this.width = this.game.screenBaseSize.width
        this.height = this.game.screenBaseSize.height

        this.fontsLoaded = false;
        this.assetsLoaded = false;
        this.load.on('progress', function(progress) {});
        this.load.on('complete', () => {
            this.assetsLoaded = true;
            this.createSounds();
        });
    }

    createSounds() {
        for (let i = 0; i < soundsData.music.length; i++) {
            soundsData[soundsData.music[i]] = this.sound.add(soundsData.music[i]);
        }

        for (let i = 0; i < soundsData.sounds.length; i++) {
            soundsData[soundsData.sounds[i]] = this.sound.add(soundsData.sounds[i]);
        }
    }

    loadFont(name, url) {
        var newFont = new FontFace(name, `url(${url})`);
        let _this = this;
        newFont.load().then(function(loaded) {
            document.fonts.add(loaded);
            _this.fontsLoaded = true;
        }).catch(function(error) {
            return error;
        });
    }

    update() {

        if (this.assetsLoaded && this.fontsLoaded && !this.gameStarted) {
            this.gameStarted = true;
            this.scene.start('preload');
        }
    }
}