import soundsData from "../data/sounds-data.js";

export default class SoundManager {

    static playSound(name, volume = 1, callback) {

        soundsData[name].play();
        soundsData[name].volume = volume;

        if (callback) {
            soundsData[name].on("complete", () => {

                callback();
            })
        }

    }

    static playFX(scene, name, volume = 1) {

        scene.sound.play(name, { loop: false, volume: volume });
    }

    static playMusic(name, volume = 1) {

        soundsData[name].loop = true;
        soundsData[name].play();
        soundsData[name].volume = volume;
    }
}