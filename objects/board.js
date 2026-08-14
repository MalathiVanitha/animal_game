import GameConstants from "../data/constants.js";
import levels from "../data/data.js";
import { Tile } from "./tile.js";

// Breathing room between the board and the edges of the space it is given.
const BOARD_MARGIN = 24;

export class Board extends Phaser.GameObjects.Container {
    constructor(scene, x, y) {

        super(scene);
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.scene.add.existing(this);

        this.levelData = levels[scene.level || 1];

        this.columns = this.levelData.cols;
        this.rows = this.levelData.rows;

        this.tileWidth = this.levelData.tileWidth;
        this.tileHeight = this.levelData.tileHeight;
        this.tileScale = this.levelData.tileScale;
        this.tileTypes = this.levelData.tileTypes;

        this.offsetX = -(this.columns * this.tileWidth) / 2 + this.tileWidth / 2;
        this.offsetY = -(this.rows * this.tileHeight) / 2 + this.tileHeight / 2;

        this.tiles = [];
        this.tilesPool = [];

        this.fallOrder = 1;
        this.tweenSpeed = 200;
        this.fallDelay = 300;

        // Drop feel - time for a single cell of free fall, a ceiling so a full
        // column drop never drags, and how much a tile squashes when it lands.
        this.fallTimePerCell = 190;
        this.fallMaxDuration = 620;
        this.landSquash = .16;
        this.hintDelay = 4000;

        // Flags
        this.canClick = true;
        this.gameStarted = true;
        this.gameEnded = false;
        this.isAutoMatching = false;

        this.init();
    }

    adjust() {

        const boardWidth = this.columns * this.tileWidth;
        const boardHeight = this.rows * this.tileHeight;

        // Never wider than the visible area, never bigger than its artwork.
        const availableWidth = Math.min(dimensions.actualWidth, dimensions.gameWidth) - 40;
        let availableHeight = Math.min(dimensions.actualHeight, dimensions.gameHeight) - 140;
        let fit = .9;

        this.x = dimensions.gameWidth / 2;

        if (dimensions.isLandscape) {

            // The stall owns the top of the screen, so the board centres itself
            // in the strip left underneath it instead of on the whole screen -
            // centring on the screen would run it up behind the counter.
            const top = this.scene.topPanel ? this.scene.topPanel.getContentBottom() : dimensions.topOffset;
            const bottom = dimensions.bottomOffset;

            this.y = top + (bottom - top) / 2;

            // The margin is already taken out here, so the strip is used in full.
            availableHeight = Math.min(availableHeight, (bottom - top) - BOARD_MARGIN);
            fit = 1;

        } else {
            this.y = dimensions.gameHeight / 2 + 200;
        }

        // The frame art overhangs the grid, so it is the frame that has to fit -
        // fitting the grid alone left the frame running off the bottom.
        const contentWidth = Math.max(boardWidth, this.boardFrame.displayWidth);
        const contentHeight = Math.max(boardHeight, this.boardFrame.displayHeight);

        const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1);
        this.setScale(scale * fit);

        this.createMask();
    }

    init() {

        this.boardFrame = this.scene.add.sprite(0, 0, "board_base");
        this.boardFrame.setOrigin(.5);
        this.boardFrame.setScale(.545, .54);
        this.add(this.boardFrame);

        this.boxGrp = this.scene.add.container();
        this.add(this.boxGrp);

        this.tileGrp = this.scene.add.container();
        this.add(this.tileGrp);

        this.fxGrp = this.scene.add.container();
        this.add(this.fxGrp);

        this.createTiles();
        this.createLevel();

        const zone = this.scene.add.zone(this.offsetX - this.tileWidth / 2, this.offsetY - this.tileHeight / 2, this.columns * this.tileWidth, this.rows * this.tileHeight).setOrigin(0).setInteractive();
        this.add(zone);

        zone.on('pointerdown', function(pointer) {
            this.onTap(pointer, zone);
        }.bind(this));

        this.scene.input.on('pointerup', function(pointer) {
            this.onTapUp(pointer, zone);
        }.bind(this));

        this.startHintTimer();
    }

    createTiles() {

        let startX = this.offsetX;

        for (let i = 0; i < this.columns; i++) {
            this.tiles[i] = [];
            let startY = this.offsetY;

            for (let j = 0; j < this.rows; j++) {

                let box = this.scene.add.sprite(startX, startY, "sheet", this.levelData.cellTile);
                box.setOrigin(0.5);
                box.setScale(this.tileScale);
                this.boxGrp.add(box);

                let tile = new Tile(this.scene, startX, startY);
                tile.setScale(this.tileScale);
                this.tileGrp.add(tile);

                tile.xPos = tile.x;
                tile.yPos = tile.y;

                tile.type = 0;
                tile.level = GameConstants.NORMAL;
                tile.box = box;
                tile.i = i;
                tile.j = j;

                tile.dropTween = function(tile, y, callback) {

                    this.stopDropTweens(tile);

                    const oldY = tile.y;
                    const distance = Math.abs(oldY - y) / this.tileHeight;

                    // Free fall - the time grows with the square root of the distance,
                    // not with the distance itself, so tiles sharing a column keep the
                    // gap they started with instead of the upper one closing in on the
                    // lower one halfway down.
                    const fallDuration = Phaser.Math.Clamp(
                        this.fallTimePerCell * Math.sqrt(distance),
                        this.fallTimePerCell / 2,
                        this.fallMaxDuration
                    );

                    // A one cell nudge barely reacts, a full column drop lands hard.
                    const impact = Phaser.Math.Clamp(distance / 4, .3, 1);
                    const dip = this.tileHeight * .055 * impact;
                    const hop = this.tileHeight * .09 * impact;
                    const squash = this.landSquash * impact;

                    tile.tween = this.scene.tweens.add({
                        targets: tile,
                        y: { from: oldY, to: y },
                        duration: fallDuration,
                        ease: 'Quad.easeIn',
                        onComplete: () => {

                            tile.tween = "";
                            tile.yPos = y;
                            tile.y = y;

                            tile.landTween = this.scene.tweens.chain({
                                targets: tile,
                                tweens: [
                                    // Hits the cell and compresses against it.
                                    {
                                        y: y + dip,
                                        scaleX: this.tileScale * (1 + squash),
                                        scaleY: this.tileScale * (1 - squash),
                                        duration: 60 + 40 * impact,
                                        ease: 'Quad.easeOut',
                                    },
                                    // Springs back out and lifts a little.
                                    {
                                        y: y - hop,
                                        scaleX: this.tileScale * (1 - squash * .4),
                                        scaleY: this.tileScale * (1 + squash * .4),
                                        duration: 80 + 50 * impact,
                                        ease: 'Sine.easeOut',
                                    },
                                    // Falls back onto the cell and settles.
                                    {
                                        y: y,
                                        scaleX: this.tileScale,
                                        scaleY: this.tileScale,
                                        duration: 90 + 50 * impact,
                                        ease: 'Quad.easeIn',
                                    }
                                ],
                                onComplete: () => {
                                    tile.landTween = "";
                                    tile.y = y;
                                    tile.setScale(this.tileScale);
                                }
                            });

                            callback();
                        }
                    });

                    return distance;
                }.bind(this, tile);

                this.tiles[i][j] = tile;
                startY += this.tileHeight;
            }
            startX += this.tileWidth;
        }
    }

    // Both halves of a drop have to be cleared before anything else moves a tile.
    // The landing bounce leaves it off its cell centre and squashed, so it is put
    // back on its cell first - the fall itself is left where it is, its target is
    // recalculated from there.
    stopDropTweens(tile) {

        if (tile.tween) {
            tile.tween.stop();
            tile.tween = "";
        }

        if (tile.landTween) {
            tile.landTween.stop();
            tile.landTween = "";
            tile.y = tile.yPos;
            tile.setScale(this.tileScale);
        }
    }

    transposeArray(original) {

        const rows = original.length;
        const cols = original[0].length;

        const transposed = [];
        for (let j = 0; j < cols; j++) {
            transposed[j] = [];
            for (let i = 0; i < rows; i++) {
                transposed[j][i] = original[i][j];
            }
        }

        return transposed;
    }

    createLevel() {

        // Authored row by row, used column first.
        this.pattern = this.transposeArray(this.levelData.pattern);
        this.boardStatus = [];

        for (let i = 0; i < this.columns; i++) {
            this.boardStatus[i] = [];

            for (let j = 0; j < this.rows; j++) {

                const tile = this.tiles[i][j];

                if (this.pattern[i][j] === GameConstants.EMPTY) {
                    tile.level = GameConstants.EMPTY;
                    this.boardStatus[i][j] = GameConstants.EMPTY;
                    tile.box.visible = false;
                    tile.visible = false;
                } else {
                    this.boardStatus[i][j] = GameConstants.NORMAL;
                    this.setRandomTile(tile);
                }
            }
        }

        this.clearStartingMatches();
    }

    // A fresh board should be waiting for the player, not resolving itself: reroll
    // anything that is already three in a row before the first frame is drawn.
    clearStartingMatches() {

        let attempts = 0;

        while (attempts < 100) {
            const matches = this.findAllMatches(this.tiles);
            if (!matches.length) break;

            matches.forEach(match => {
                match.tiles.forEach(tile => this.setRandomTile(tile));
            });

            attempts++;
        }
    }

    setRandomTile(tile) {

        this.setTileType(tile, Phaser.Math.Between(0, this.tileTypes.length - 1));
    }

    setTileType(tile, type) {

        tile.type = type;
        tile.level = GameConstants.NORMAL;
        tile.setScale(this.tileScale);
        tile.alpha = 1;
        tile.angle = 0;
        tile.visible = true;
        tile.changeAsset(this.tileTypes[type]);
    }

    onTap() {

        if (!this.canClick) return;
        if (!this.gameStarted) return;
        if (this.gameEnded) return;

        this.selectedTile = this.getTileUnderMouse();

        if (!this.selectedTile) return;

        this.hideHint();
        this.scene.playSounds("tap");

        if (!this.canSwapTile(this.selectedTile)) this.selectedTile = null;
    }

    onTapUp() {

        if (!this.gameStarted) return;

        if (!this.matched) this.startHintTimer();
        this.selectedTile = null;
    }

    getTileUnderMouse() {

        const mouse = this.scene.offsetMouse();

        mouse.x -= this.x;
        mouse.y -= this.y;

        mouse.x /= this.scaleX;
        mouse.y /= this.scaleY;

        mouse.x -= (this.offsetX - this.tileWidth / 2);
        mouse.y -= (this.offsetY - this.tileHeight / 2);

        const col = Math.floor(mouse.x / this.tileWidth);
        const row = Math.floor(mouse.y / this.tileHeight);

        if (row < 0 || col < 0 || row >= this.rows || col >= this.columns) return;

        return this.tiles[col][row];
    }

    swap(tile1, tile2) {

        const row1 = tile1.j;
        const col1 = tile1.i;

        const row2 = tile2.j;
        const col2 = tile2.i;

        tile2.i = col1;
        tile2.j = row1;

        tile1.i = col2;
        tile1.j = row2;

        this.tiles[tile1.i][tile1.j] = tile1;
        this.tiles[tile2.i][tile2.j] = tile2;
    }

    swapType(tile1, tile2) {

        const type = tile1.type;
        tile1.type = tile2.type;
        tile2.type = type;
    }

    swapBack(tile1, tile2) {

        const x1 = tile1.x;
        const x2 = tile2.x;
        const y1 = tile1.y;
        const y2 = tile2.y;

        this.scene.tweens.add({
            targets: tile1,
            x: x2,
            y: y2,
            ease: "Linear",
            duration: this.tweenSpeed,
        });

        this.scene.tweens.add({
            targets: tile2,
            x: x1,
            y: y1,
            ease: "Linear",
            duration: this.tweenSpeed,
            onComplete: () => {
                this.scene.playSounds("wrong_move");

                this.swap(tile2, tile1);

                tile1.xPos = tile1.x;
                tile1.yPos = tile1.y;
                tile2.xPos = tile2.x;
                tile2.yPos = tile2.y;

                this.enable();
            }
        })
    }

    canSwapTile(tile) {

        if (!tile || !tile.visible) return false;
        if (tile.level === GameConstants.EMPTY) return false;
        if (this.boardStatus[tile.i][tile.j] === GameConstants.EMPTY) return false;
        if (this.boardStatus[tile.i][tile.j] === GameConstants.DESTROYED) return false;

        return true;
    }

    // Every straight run of three or more of the same food, horizontal and
    // vertical. Runs that cross each other come back separately - destroyTile
    // ignores a cell that has already gone, so the overlap costs nothing.
    findAllMatches(tiles) {

        const matches = [];

        const getType = (x, y) => {
            if (
                tiles[x] && tiles[x][y] &&
                this.boardStatus[x][y] !== GameConstants.DESTROYED &&
                this.boardStatus[x][y] !== GameConstants.EMPTY
            ) return tiles[x][y].type;
            return null;
        };

        const addRun = (run) => {
            if (run.length >= 3) matches.push({ tiles: run.slice() });
        };

        // Horizontal
        for (let y = 0; y < this.rows; y++) {
            let run = [];
            let runType = null;

            for (let x = 0; x < this.columns; x++) {
                const type = getType(x, y);

                if (type !== null && type === runType) {
                    run.push(tiles[x][y]);
                } else {
                    addRun(run);
                    run = type === null ? [] : [tiles[x][y]];
                    runType = type;
                }
            }
            addRun(run);
        }

        // Vertical
        for (let x = 0; x < this.columns; x++) {
            let run = [];
            let runType = null;

            for (let y = 0; y < this.rows; y++) {
                const type = getType(x, y);

                if (type !== null && type === runType) {
                    run.push(tiles[x][y]);
                } else {
                    addRun(run);
                    run = type === null ? [] : [tiles[x][y]];
                    runType = type;
                }
            }
            addRun(run);
        }

        return matches;
    }

    findMatches() {

        return this.findAllMatches(this.tiles);
    }

    removeMatches(match) {

        this.scene.playSounds("match");

        // The order within the match staggers the collect flights, so a five in
        // a row leaves the board as a stream rather than all at once.
        match.forEach((tile, index) => {
            this.destroyTile(tile, index);
        });
    }

    destroyTile(tile, order = 0) {

        if (tile.level === GameConstants.EMPTY) return;
        if (this.boardStatus[tile.i][tile.j] === GameConstants.DESTROYED) return;

        this.boardStatus[tile.i][tile.j] = GameConstants.DESTROYED;

        this.stopDropTweens(tile);

        // Food somebody ordered flies to them instead of popping on the spot.
        const collected = this.scene.collectTile(this.tileTypes[tile.type], tile.x, tile.y, order);

        this.showMatchFx(tile, collected);

        tile.visible = false;
        tile.sideDropTween = "";
        tile.setScale(this.tileScale);
        this.tilesPool.push(tile);
    }

    ensureSparkleTexture() {

        if (this.scene.textures.exists("match_sparkle")) return;

        const size = 32;
        const half = size / 2;
        const g = this.scene.add.graphics();

        g.fillStyle(0xffffff, 1);
        g.beginPath();
        g.moveTo(half, 0);``
        g.lineTo(half + 4, half - 4);
        g.lineTo(size, half);
        g.lineTo(half + 4, half + 4);
        g.lineTo(half, size);
        g.lineTo(half - 4, half + 4);
        g.lineTo(0, half);
        
        g.lineTo(half - 4, half - 4);
        g.closePath();
        g.fillPath();

        g.generateTexture("match_sparkle", size, size);
        g.destroy();
    }

    // A collected tile keeps its own copy flying off to the customer, so only the
    // sparkles are left here - the pop and fade would be a second, doubled item.
    showMatchFx(tile, collected = false) {

        this.ensureSparkleTexture();

        if (!collected) {

            const fx = this.scene.add.sprite(tile.x, tile.y, "sheet", this.tileTypes[tile.type]);
            fx.setOrigin(0.5);
            fx.setScale(this.tileScale * 0.6);
            this.fxGrp.add(fx);

            this.scene.tweens.chain({
                targets: fx,
                tweens: [{
                        scale: this.tileScale * 1.35,
                        duration: 90,
                        ease: "Back.easeOut",
                    },
                    {
                        scale: this.tileScale * 1.15,
                        alpha: 0,
                        duration: 180,
                        ease: "Sine.easeIn",
                    }
                ],
                onComplete: () => {
                    fx.destroy();
                }
            });
        }

        this.showMatchBurst(tile.x, tile.y);
    }

    showMatchBurst(x, y) {

        const sparkCount = 7;
        const sparkRadius = this.tileWidth * 0.7;

        for (let i = 0; i < sparkCount; i++) {

            const angle = (Math.PI * 2 * i) / sparkCount + Phaser.Math.FloatBetween(-0.25, 0.25);
            const startScale = Phaser.Math.FloatBetween(0.35, 0.7);

            const spark = this.scene.add.sprite(x, y, "match_sparkle");
            spark.setScale(0);
            spark.setAngle(Phaser.Math.Between(0, 360));
            spark.setBlendMode(Phaser.BlendModes.ADD);
            this.fxGrp.add(spark);

            const targetX = x + Math.cos(angle) * sparkRadius;
            const targetY = y + Math.sin(angle) * sparkRadius;
            const flightDuration = 300 + Phaser.Math.Between(0, 80);

            // Twinkle in fast, then twinkle back out - the pop, not a fade.
            this.scene.tweens.chain({
                targets: spark,
                tweens: [{
                        scale: startScale,
                        duration: flightDuration * 0.35,
                        ease: "Back.easeOut",
                    },
                    {
                        scale: 0,
                        duration: flightDuration * 0.65,
                        ease: "Sine.easeIn",
                    }
                ]
            });

            this.scene.tweens.add({
                targets: spark,
                x: targetX,
                y: targetY,
                angle: spark.angle + Phaser.Math.Between(-90, 90),
                duration: flightDuration,
                ease: "Cubic.easeOut",
                onComplete: () => {
                    spark.destroy();
                }
            });
        }
    }

    checkRightTop(tile) {

        const row = tile.j;
        const col = tile.i;

        if (col === this.columns - 1) return false;
        if (row === 0) return false;

        return (
            this.boardStatus[col + 1][row - 1] !== GameConstants.EMPTY &&
            this.boardStatus[col + 1][row - 1] !== GameConstants.DESTROYED
        );
    }

    checkLeftTop(tile) {

        const row = tile.j;
        const col = tile.i;

        if (col === 0) return false;
        if (row === 0) return false;

        return (
            this.boardStatus[col - 1][row - 1] !== GameConstants.EMPTY &&
            this.boardStatus[col - 1][row - 1] !== GameConstants.DESTROYED
        );
    }

    async fillEmpty() {

        return new Promise((resolve) => {

            let count = 0;
            let total = 0;
            let isDrop = false;

            for (let col = 0; col < this.columns; col++) {
                for (let row = this.rows - 1; row >= 0; row--) {

                    if (this.tiles[col][row] && this.boardStatus[col][row] === GameConstants.DESTROYED) {

                        for (let k = row - 1; k >= 0; k--) {
                            const tileAbove = this.tiles[col][k];

                            if (tileAbove && this.boardStatus[col][k] !== GameConstants.DESTROYED && !tileAbove.sideDropTween) {

                                // An empty cell is a wall - nothing falls through it.
                                if (this.boardStatus[col][k] === GameConstants.EMPTY) break;

                                total++;
                                isDrop = true;

                                this.tiles[col][row] = tileAbove;
                                this.boardStatus[col][k] = GameConstants.DESTROYED;

                                tileAbove.j = row;
                                this.boardStatus[col][row] = GameConstants.NORMAL;

                                tileAbove.dropTween(this.getYFromRow(row), () => {
                                    count++;
                                    if (count === total) resolve(true);
                                });

                                break;
                            }
                        }
                    }
                }
            }

            if (!isDrop) resolve(false);
        });
    }

    async checkForSideDrop() {

        return new Promise((resolve) => {

            const fallDuration = this.tweenSpeed;
            const tweens = [];
            const movedTiles = [];

            const slide = (tile, col, row) => {

                this.boardStatus[tile.i][tile.j] = GameConstants.DESTROYED;
                this.boardStatus[col][row] = GameConstants.NORMAL;
                this.tiles[col][row] = tile;

                const newX = this.getXFromCol(col);
                const newY = this.getYFromRow(row);

                this.stopDropTweens(tile);

                this.scene.tweens.add({
                    targets: tile,
                    scale: { from: tile.scaleX, to: tile.scaleX / 2 },
                    duration: fallDuration / 2,
                    yoyo: true,
                });

                tweens.push(new Promise((tweenResolve) => {
                    tile.sideDropTween = this.scene.tweens.add({
                        targets: tile,
                        x: newX,
                        y: newY,
                        duration: fallDuration,
                        ease: 'Sine.easeOut',
                        onComplete: () => {
                            tile.xPos = newX;
                            tile.yPos = newY;
                            tile.sideDropTween = "";
                            tweenResolve();
                        }
                    });
                }));

                tile.i = col;
                tile.j = row;
                movedTiles.push(tile);
            };

            for (let col = 0; col < this.columns; col++) {
                for (let row = this.rows - 1; row >= 1; row--) {

                    const aboveBlocked = this.boardStatus[col][row - 1] === GameConstants.EMPTY;

                    if (this.tiles[col][row] && this.boardStatus[col][row] === GameConstants.DESTROYED && aboveBlocked) {

                        if (col < this.columns - 1 && this.checkRightTop({ i: col, j: row })) {

                            const rightTopTile = this.tiles[col + 1][row - 1];
                            if (!movedTiles.includes(rightTopTile)) slide(rightTopTile, col, row);

                        } else if (col > 0 && this.checkLeftTop({ i: col, j: row })) {

                            const leftTopTile = this.tiles[col - 1][row - 1];
                            if (!movedTiles.includes(leftTopTile)) slide(leftTopTile, col, row);
                        }
                    }
                }
            }

            if (tweens.length) {
                Promise.all(tweens).then(() => resolve(true));
            } else {
                resolve(false);
            }
        });
    }

    populateItems() {

        for (let col = 0; col < this.columns; col++) {
            let emptyCount = 0;

            for (let row = 0; row < this.rows; row++) {

                if (this.boardStatus[col][row] === GameConstants.EMPTY) break;
                // Only the unbroken run of holes at the top belongs to us. A hole
                // trapped under a tile that is still on the board is filled by the
                // next fillEmpty pass - spawning into it here would leave two
                // items sitting in the same cell.
                if (this.boardStatus[col][row] !== GameConstants.DESTROYED) break;

                emptyCount++;
            }

            this.spawnNewTilesInColumn(col, emptyCount);
        }

        for (let col = 0; col < this.columns; col++) {
            let emptyCount = 0;
            const rowStart = this.findMiddleStart(col);

            for (let row = rowStart; row < this.rows; row++) {

                if (this.boardStatus[col][row] === GameConstants.EMPTY) break;
                if (this.boardStatus[col][row] !== GameConstants.DESTROYED) break;

                emptyCount++;
            }

            this.spawnNewTilesInSpace(col, rowStart, emptyCount);
        }
    }

    // A cell sealed off from the top of its own column but with nothing left to
    // slide in from the sides either - new items have to be dropped straight into it.
    findMiddleStart(col) {

        for (let row = 1; row < this.rows; row++) {

            if (this.boardStatus[col][row] !== GameConstants.DESTROYED) continue;

            if (col === 0) {
                if (this.boardStatus[col + 1][row - 1] === GameConstants.EMPTY) return row;
            } else if (col === this.columns - 1) {
                if (this.boardStatus[col - 1][row - 1] === GameConstants.EMPTY) return row;
            } else if (
                this.boardStatus[col - 1][row - 1] === GameConstants.EMPTY &&
                this.boardStatus[col + 1][row - 1] === GameConstants.EMPTY
            ) {
                return row;
            }
        }

        return this.rows;
    }

    spawnNewTilesInColumn(col, count) {

        for (let i = 0; i < count; i++) {

            const tile = this.tilesPool.pop();
            if (!tile) break; // nothing recycled yet, the cell is refilled next pass

            this.setRandomTile(tile);
            this.tileGrp.add(tile);

            const row = count - i - 1;

            tile.x = this.getXFromCol(col);
            tile.y = (-this.tileHeight * (i + 1)) + this.offsetY;

            tile.i = col;
            tile.j = row;
            tile.xPos = this.getXFromCol(col);
            tile.yPos = this.getYFromRow(row);

            this.tiles[col][row] = tile;
            this.boardStatus[col][row] = GameConstants.NORMAL;

            tile.dropTween(this.getYFromRow(row), () => {
                this.playFallSound();
            });
        }
    }

    spawnNewTilesInSpace(col, row, count) {

        const originY = this.getYFromRow(row) - this.tileHeight;

        for (let n = 0; n < count; n++) {

            const actualRow = row + (count - 1 - n);

            const tile = this.tilesPool.pop();
            if (!tile) break;

            this.setRandomTile(tile);
            this.tileGrp.add(tile);

            tile.x = this.getXFromCol(col);
            tile.y = (-this.tileHeight * n) + originY;

            tile.i = col;
            tile.j = actualRow;
            tile.xPos = this.getXFromCol(col);
            tile.yPos = this.getYFromRow(actualRow);

            this.tiles[col][actualRow] = tile;
            this.boardStatus[col][actualRow] = GameConstants.NORMAL;

            tile.dropTween(this.getYFromRow(actualRow), () => {
                this.playFallSound();
            });
        }
    }

    playFallSound() {

        this.scene.playSounds("item_fall_" + this.fallOrder);
        this.fallOrder++;
        if (this.fallOrder > 3) this.fallOrder = 1;
    }

    async checkForMatches() {

        this.isAutoMatching = true;
        this.hideHint();

        const matches = this.findMatches();

        if (!matches.length) {
            this.isAutoMatching = false;
            this.enable();
            return false;
        }

        matches.forEach((match) => {
            this.removeMatches(match.tiles);
        });

        await this.wait(this.fallDelay);

        const fillPromise = this.fillEmpty();
        this.populateItems();
        await fillPromise;

        // Keep dropping down, then sideways, until the board stops moving.
        let somethingMoved = true;

        while (somethingMoved) {
            const fillMoved = await this.fillEmpty();
            this.populateItems();
            const sideMoved = await this.checkForSideDrop();

            somethingMoved = fillMoved || sideMoved;
        }

        this.scene.time.addEvent({
            delay: this.fallDelay * 1.2,
            callback: () => {
                if (this.findMatches().length) {
                    this.checkForMatches();
                } else {
                    this.enable();
                }
            }
        });

        return true;
    }

    wait(delay) {

        return new Promise(resolve => {
            this.scene.time.delayedCall(delay, resolve);
        });
    }

    enable() {

        this.isAutoMatching = false;
        this.canClick = true;

        if (this.gameEnded) return;

        if (!this.findMoves().length) {
            this.shuffleBoard(() => {
                this.checkForMatches();
            });
            return;
        }

        this.startHintTimer();
    }

    getMatchScore(match) {

        return match.tiles.length;
    }

    // Best match these two actually create by swapping. Matches already sitting on
    // the board are ignored - they are not this swap's doing, and counting them
    // would make every pair on the board look like a legal move.
    getSwapMatch(tileA, tileB) {

        this.swapType(tileA, tileB);

        let best = null;
        const matches = this.findAllMatches(this.tiles);

        for (const match of matches) {
            if (match.tiles.indexOf(tileA) === -1 && match.tiles.indexOf(tileB) === -1) continue;
            if (!best || this.getMatchScore(match) > this.getMatchScore(best)) best = match;
        }

        const result = best ? { match: best, score: this.getMatchScore(best) } : null;

        this.swapType(tileA, tileB);

        return result;
    }

    findMoves() {

        const moves = [];

        const addMove = (col1, row1, col2, row2) => {

            const tileA = this.tiles[col1][row1];
            const tileB = this.tiles[col2][row2];

            if (!this.canSwapTile(tileA) || !this.canSwapTile(tileB)) return;

            const swapMatch = this.getSwapMatch(tileA, tileB);
            if (!swapMatch) return;

            moves.push({
                column1: col1,
                row1: row1,
                column2: col2,
                row2: row2,
                score: swapMatch.score
            });
        };

        for (let j = 0; j < this.rows; j++) {
            for (let i = 0; i < this.columns - 1; i++) {
                addMove(i, j, i + 1, j);
            }
        }

        for (let i = 0; i < this.columns; i++) {
            for (let j = 0; j < this.rows - 1; j++) {
                addMove(i, j, i, j + 1);
            }
        }

        // Best payoff first, so whoever takes moves[0] - the hint - gets a good move.
        moves.sort((a, b) => b.score - a.score);

        return moves;
    }

    shufflePlayableTiles(tiles) {

        const validPositions = [];
        const validTiles = [];

        for (let c = 0; c < this.columns; c++) {
            for (let r = 0; r < this.rows; r++) {

                const tile = tiles[c][r];
                if (tile.level !== GameConstants.EMPTY) {
                    validPositions.push({ c, r });
                    validTiles.push(tile);
                }
            }
        }

        // Fisher-Yates
        for (let i = validTiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [validTiles[i], validTiles[j]] = [validTiles[j], validTiles[i]];
        }

        const newTiles = tiles.map(col => [...col]);

        for (let k = 0; k < validPositions.length; k++) {
            const { c, r } = validPositions[k];
            newTiles[c][r] = validTiles[k];
        }

        return newTiles;
    }

    shuffleBoard(callback) {

        if (this.isBusy) return;
        this.isBusy = true;
        this.canClick = false;

        const MAX_ATTEMPTS = 50;
        let attempts = 0;
        let shuffled;

        do {
            shuffled = this.shufflePlayableTiles(this.tiles);

            // Try the arrangement out on a copy of the grid before committing to it.
            const prevTiles = this.tiles;
            this.tiles = shuffled;
            this.syncTileIndices(shuffled);
            const moves = this.findMoves();
            this.tiles = prevTiles;
            this.syncTileIndices(prevTiles);

            if (moves.length) break;

            attempts++;
        } while (attempts < MAX_ATTEMPTS);

        // Nothing shuffled into a playable board - reroll the food instead.
        if (attempts >= MAX_ATTEMPTS) {
            for (let c = 0; c < this.columns; c++) {
                for (let r = 0; r < this.rows; r++) {
                    if (this.tiles[c][r].level !== GameConstants.EMPTY) this.setRandomTile(this.tiles[c][r]);
                }
            }

            this.isBusy = false;
            callback();
            return;
        }

        for (let c = 0; c < this.columns; c++) {
            for (let r = 0; r < this.rows; r++) {
                this.tiles[c][r] = shuffled[c][r];
            }
        }
        this.syncTileIndices(this.tiles);
        this.updateTilePositions(this.tiles);

        this.isBusy = false;
        callback();
    }

    syncTileIndices(tiles) {

        for (let c = 0; c < this.columns; c++) {
            for (let r = 0; r < this.rows; r++) {
                tiles[c][r].i = c;
                tiles[c][r].j = r;
            }
        }
    }

    updateTilePositions(tiles, duration = 200) {

        for (let c = 0; c < this.columns; c++) {
            for (let r = 0; r < this.rows; r++) {

                const tile = tiles[c][r];
                if (!tile) continue;

                tile.xPos = this.getXFromCol(c);
                tile.yPos = this.getYFromRow(r);

                this.scene.tweens.add({
                    targets: tile,
                    x: tile.xPos,
                    y: tile.yPos,
                    duration: duration,
                    ease: 'Cubic.easeOut'
                });
            }
        }
    }

    getXFromCol(col) {

        return (this.tileWidth * col) + this.offsetX;
    }

    getYFromRow(row) {

        return (this.tileHeight * row) + this.offsetY;
    }

    update() {

        if (!this.selectedTile) return;
        if (!this.canClick) return;

        const tile = this.getTileUnderMouse();
        if (!tile || tile === this.selectedTile) return;
        if (!this.canSwapTile(tile) || !this.canSwapTile(this.selectedTile)) return;

        const isNeighbour =
            (Math.abs(tile.x - this.selectedTile.x) <= this.tileWidth && tile.y - this.selectedTile.y === 0) ||
            (tile.x - this.selectedTile.x === 0 && Math.abs(tile.y - this.selectedTile.y) <= this.tileHeight);

        if (!isNeighbour) return;

        const tile1 = this.selectedTile;
        const tile2 = tile;

        this.scene.playSounds("swap");
        this.hideHint();

        this.canClick = false;
        this.matched = false;
        this.selectedTile = null;

        const x1 = tile1.x;
        const y1 = tile1.y;
        const x2 = tile2.x;
        const y2 = tile2.y;

        this.scene.tweens.add({
            targets: tile1,
            x: x2,
            y: y2,
            ease: "Linear",
            duration: this.tweenSpeed,
        });

        this.scene.tweens.add({
            targets: tile2,
            x: x1,
            y: y1,
            ease: "Linear",
            duration: this.tweenSpeed,
            onComplete: () => {

                this.swap(tile1, tile2);

                tile1.xPos = tile1.x;
                tile1.yPos = tile1.y;
                tile2.xPos = tile2.x;
                tile2.yPos = tile2.y;

                if (!this.findMatches().length) {
                    this.swapBack(tile1, tile2);
                } else {
                    this.matched = true;
                    this.checkForMatches();
                }
            }
        });
    }

    // Items fall in from above the board, so they have to be clipped to the cells
    // that actually exist.
    createMask() {

        if (this.maskGraphics) {
            this.maskGraphics.destroy();
            this.maskGraphics = "";
        }

        this.maskGraphics = this.scene.add.graphics();
        this.maskGraphics.fillStyle(0xffffff, .5);

        const scale = this.scene.gameScale * this.scaleX;

        for (let i = 0; i < this.columns; i++) {
            for (let j = 0; j < this.rows; j++) {

                if (this.tiles[i][j].level === GameConstants.EMPTY) continue;

                const matrix = this.tiles[i][j].box.getWorldTransformMatrix();

                this.maskGraphics.fillRect(matrix.tx - (this.tileWidth * scale) / 2, matrix.ty - (this.tileHeight * scale) / 2, this.tileWidth * scale, this.tileHeight * scale);
            }
        }

        this.maskGraphics.visible = false;

        const mask = this.maskGraphics.createGeometryMask();
        for (let i = 0; i < this.columns; i++) {
            for (let j = 0; j < this.rows; j++) {
                this.tiles[i][j].setMask(mask);
            }
        }
    }

    showHint() {

        if (this.isAutoMatching) return;

        if (!this.canClick) {
            this.hintTimer = this.scene.time.delayedCall(50, () => {
                if (this.gameStarted && !this.gameEnded) {
                    this.hideHint();
                    this.showHint();
                }
            });
            return;
        }

        this.hideHint();

        // findMoves() only returns swaps the player can actually perform, sorted
        // best payoff first, so the top one is both possible and worth playing.
        const bestMove = this.findMoves()[0];
        if (!bestMove) return;

        const tile1 = this.tiles[bestMove.column1][bestMove.row1];
        const tile2 = this.tiles[bestMove.column2][bestMove.row2];
        if (!tile1 || !tile2) return;

        this.hintTile1 = tile1;
        this.hintTile2 = tile2;
        this.hintTile1Origin = { x: tile1.x, y: tile1.y };
        this.hintTile2Origin = { x: tile2.x, y: tile2.y };

        this.bringToTop(tile2);
        this.bringToTop(tile1);

        const mid1X = tile1.x + (tile2.x - tile1.x) * 0.5;
        const mid1Y = tile1.y + (tile2.y - tile1.y) * 0.5;
        const mid2X = tile2.x + (tile1.x - tile2.x) * 0.5;
        const mid2Y = tile2.y + (tile1.y - tile2.y) * 0.5;

        this.hintTile1Tween = this.scene.tweens.add({
            targets: tile1,
            x: mid1X,
            y: mid1Y,
            duration: 600,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
            delay: 400
        });

        this.hintTile2Tween = this.scene.tweens.add({
            targets: tile2,
            x: mid2X,
            y: mid2Y,
            duration: 600,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
            delay: 400
        });
    }

    startHintTimer() {

        if (this.isAutoMatching) return;
        this.resetHintTimer();

        this.hintTimer = this.scene.time.delayedCall(this.hintDelay, () => {
            if (this.gameStarted && !this.gameEnded) this.showHint();
        });
    }

    resetHintTimer() {

        if (this.hintTimer) {
            this.scene.time.removeEvent(this.hintTimer);
            this.hintTimer = null;
        }
    }

    hideHint() {

        if (this.hintTile1Tween) {
            this.hintTile1Tween.stop();
            this.hintTile1Tween = null;
        }
        if (this.hintTile2Tween) {
            this.hintTile2Tween.stop();
            this.hintTile2Tween = null;
        }

        if (this.hintTile1 && this.hintTile1Origin) {
            this.hintTile1.x = this.hintTile1Origin.x;
            this.hintTile1.y = this.hintTile1Origin.y;
            this.tileGrp.add(this.hintTile1);
        }
        if (this.hintTile2 && this.hintTile2Origin) {
            this.hintTile2.x = this.hintTile2Origin.x;
            this.hintTile2.y = this.hintTile2Origin.y;
            this.tileGrp.add(this.hintTile2);
        }

        this.hintTile1 = null;
        this.hintTile2 = null;

        this.resetHintTimer();
    }

    show() {

        this.visible = true;
        this.adjust();
    }
}