export default class AnimationManager {

    constructor(scene) {

        this.scene = scene;
    }

    createAnimations(obj) {

        this.scene.anims.create({
            key: obj.key,
            frames: this.scene.anims.generateFrameNames(obj.name, { prefix: obj.prefix, start: obj.start, end: obj.end, zeroPad: obj.zeropad }),
            yoyo: obj.yoyo,
            frameRate: obj.frameRate,
            repeat: obj.repeat
        });
    }

    playFxAnimation(x, y, scale, name, key, parent, callback) {

        let sprite = this.scene.add.sprite(x, y, name);
        sprite.play(key);
        parent.add(sprite);
        sprite.setScale(scale);

        sprite.on('animationcomplete', () => {

            if (callback) {
                callback();
            }

            sprite.destroy();
        })

        return sprite;
    }
}