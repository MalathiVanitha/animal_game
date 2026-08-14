export default class Handler extends Phaser.Scene {

    // Vars
    sceneRunning = null

    constructor() {
        super('handler')
    }

    create() {
        this.cameras.main.setBackgroundColor('#FFF')
        this.launchScene('preload')
    }

    launchScene(scene, data) {
        this.scene.launch(scene, data)
        this.gameScene = this.scene.get(scene)
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

    resize(gameSize) {
        // 'this' means to the current scene that is running
        if (!this.sceneStopped) {

            let ratio = window.devicePixelRatio;
            const width = gameSize.width * ratio
            const height = gameSize.height * ratio

            this.parent.setSize(width, height)
            this.sizer.setSize(width, height)
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