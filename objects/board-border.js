import GameConstants from "../data/constants.js";

// The frame around the board is assembled from the level pattern instead of being
// one fixed piece of artwork, so a level can carve holes anywhere in the grid and
// still come out with a proper edge drawn around every one of them.
//
// The pieces are authored on a 150px cell. A bar sits just outside the cell it
// belongs to and drops its shadow inward, so every constant below is measured
// from a cell edge in that native space.
const NATIVE_CELL = 150;

const BAR_TOP = 21.5; // how far a top bar rises above its cell
const BAR_BOTTOM = 23; // how far a bottom bar drops below its cell
const BAR_SIDE = 16.5; // how far a left bar reaches outside its cell

const H_BAR_HEIGHT = 30; // full height of the top/bottom sprites, shadow included
const V_BAR_WIDTH = 22; // full width of the side sprites, shadow included
const RIGHT_BAR_INSET = 4.5; // a right bar's sprite starts this far inside the cell

const CORNER_INSET_X = 82.5; // a right hand corner's sprite starts this far inside the cell
const CORNER_INSET_Y = 70; // a bottom corner's sprite starts this far above the cell's floor
const CORNER_SPAN_X = 80; // edge a corner already covers on its own, left to right
const CORNER_SPAN_TOP = 75; // ...downwards, from the top of the cell
const CORNER_SPAN_BOTTOM = 67; // ...upwards, from the bottom of the cell

// Where a wall runs into an edge the frame turns the other way, around the hole
// rather than around the board. Those pieces are square and hang this far past
// the grid corner they wrap: a little way into the board, and a longer way along
// each of the two bars they join.
const INNER_NEAR = 8; // into the board, past the corner
const INNER_INSET = 44; // along each of the two bars
const INNER_SPAN = 42; // edge it covers for trimming, a shade less so the bar tucks under

// Two cells that meet only at a corner are a different problem again: both of them
// want a corner piece on the same grid point, facing each other, and the two pieces
// overlap into one continuous bend that reads as a single board. Such a junction
// gets one piece instead, on which each cell's frame sweeps round on a wide arc that
// pulls back off the point, so the two cells come apart with a gap between them. It
// covers exactly the ground the two corner pieces covered, so nothing else has to move.
const PINCH_HALF = 84; // half the piece, which is square and centred on the junction
const PINCH_RADIUS = 68; // the arc the frame sweeps round on, along the bar's centre line
const PINCH_STEPS = 8; // segments used to trace one corner of the slab

// Where a bar's centre line runs, measured out from the cell edge it belongs to.
const BAR_CENTER_H = 11.25; // top and bottom bars
const BAR_CENTER_V = 6; // left and right ones

const FILL_COLOR = 0x36465d;
const FILL_RADIUS = 11; // follows the curve on the inside of a corner piece
const FILL_BLEED = .5; // cells overlap by this much so no seam shows between them

export class BoardBorder {

    constructor(scene, board) {

        this.scene = scene;
        this.board = board;

        // One factor takes the artwork from its native cell to whatever cell size
        // the level is playing at.
        this.unit = Math.min(board.tileWidth, board.tileHeight) / NATIVE_CELL;

        // The frame overhangs the grid, and adjust() sizes the board off this.
        this.displayWidth = board.columns * board.tileWidth + 2 * BAR_SIDE * this.unit;
        this.displayHeight = board.rows * board.tileHeight + (BAR_TOP + BAR_BOTTOM) * this.unit;

        // The frame is laid down in two layers rather than one, so the board can
        // slot the cell artwork in between them: the slab underneath everything,
        // and the bars and corners back on top, closing over the edge of the cells.
        this.fillLayer = scene.add.container();
        this.frameLayer = scene.add.container();

        this.addFill();
        this.addEdges();
        this.addCorners();
    }

    // Anything off the grid counts as a hole, so the outside of the board is
    // framed by the same rules as a hole punched in the middle of it.
    isSolid(i, j) {

        if (i < 0 || j < 0 || i >= this.board.columns || j >= this.board.rows) return false;

        return this.board.pattern[i][j] !== GameConstants.EMPTY;
    }

    // The (di, dj) corner of a solid cell is a junction: the only thing it touches
    // there is the cell diagonally across from it, both sides of the corner open.
    isPinch(i, j, di, dj) {

        return this.isSolid(i + di, j + dj) && !this.isSolid(i + di, j) && !this.isSolid(i, j + dj);
    }

    cell(i, j) {

        const x = this.board.getXFromCol(i);
        const y = this.board.getYFromRow(j);

        return {
            left: x - this.board.tileWidth / 2,
            right: x + this.board.tileWidth / 2,
            top: y - this.board.tileHeight / 2,
            bottom: y + this.board.tileHeight / 2,
        };
    }

    // The slab the tiles sit on. It is rounded only where the frame itself turns a
    // corner - everywhere else the neighbouring cell carries the fill on.
    addFill() {

        const graphics = this.scene.add.graphics();
        graphics.fillStyle(FILL_COLOR, 1);

        const radius = FILL_RADIUS * this.unit;

        for (let i = 0; i < this.board.columns; i++) {
            for (let j = 0; j < this.board.rows; j++) {

                if (!this.isSolid(i, j)) continue;

                const cell = this.cell(i, j);

                const openTop = !this.isSolid(i, j - 1);
                const openBottom = !this.isSolid(i, j + 1);
                const openLeft = !this.isSolid(i - 1, j);
                const openRight = !this.isSolid(i + 1, j);

                const left = cell.left - (openLeft ? 0 : FILL_BLEED);
                const top = cell.top - (openTop ? 0 : FILL_BLEED);
                const right = cell.right + (openRight ? 0 : FILL_BLEED);
                const bottom = cell.bottom + (openBottom ? 0 : FILL_BLEED);

                const corners = {
                    tl: openTop && openLeft ? radius : 0,
                    tr: openTop && openRight ? radius : 0,
                    bl: openBottom && openLeft ? radius : 0,
                    br: openBottom && openRight ? radius : 0,
                };

                const pinches = {
                    tl: this.isPinch(i, j, -1, -1),
                    tr: this.isPinch(i, j, 1, -1),
                    br: this.isPinch(i, j, 1, 1),
                    bl: this.isPinch(i, j, -1, 1),
                };

                // A junction has taken the frame off that corner of the cell, so the
                // slab is walked by hand there instead - a rounded rectangle would
                // leave it sticking out into the gap.
                if (pinches.tl || pinches.tr || pinches.br || pinches.bl) {

                    const box = { left, top, right, bottom };

                    graphics.fillPoints([].concat(
                        this.cornerPoints(box, -1, -1, pinches.tl, corners.tl).reverse(),
                        this.cornerPoints(box, 1, -1, pinches.tr, corners.tr),
                        this.cornerPoints(box, 1, 1, pinches.br, corners.br).reverse(),
                        this.cornerPoints(box, -1, 1, pinches.bl, corners.bl)
                    ), true);

                    continue;
                }

                if (corners.tl || corners.tr || corners.bl || corners.br) {
                    graphics.fillRoundedRect(left, top, right - left, bottom - top, corners);
                } else {
                    graphics.fillRect(left, top, right - left, bottom - top);
                }
            }
        }

        this.fillLayer.add(graphics);
    }

    // One corner of the slab, walked from the cell's horizontal edge round into its
    // vertical one. (sx, sy) picks the corner: (1, 1) is the bottom right one.
    //
    // A pinched corner follows the wide arc the junction piece sweeps round on. The
    // slab's edge is that arc brought in by the thickness of each bar, which lands on
    // an ellipse touching both edges of the cell - so it stays under the bar the whole
    // way round and still meets the straight edges cleanly at either end.
    cornerPoints(box, sx, sy, pinched, radius) {

        const x = sx > 0 ? box.right : box.left;
        const y = sy > 0 ? box.bottom : box.top;

        const points = [];
        const at = (dx, dy) => points.push({ x: x - sx * dx, y: y - sy * dy });

        const spanX = pinched ? (PINCH_RADIUS - BAR_CENTER_V) * this.unit : radius;
        const spanY = pinched ? (PINCH_RADIUS - BAR_CENTER_H) * this.unit : radius;

        if (!spanX && !spanY) {
            at(0, 0);
            return points;
        }

        for (let n = 0; n <= PINCH_STEPS; n++) {
            const a = Math.PI / 2 * n / PINCH_STEPS;
            at(spanX - spanX * Math.sin(a), spanY - spanY * Math.cos(a));
        }

        return points;
    }

    // One stretched bar per unbroken run of exposed cells, so a long wall has no
    // seams down the middle of it. Both ends stop short of whatever corner piece
    // is waiting for them there.
    addEdges() {

        for (let i = 0; i < this.board.columns; i++) {

            this.scanRuns(this.board.rows,
                (j) => this.isSolid(i, j) && !this.isSolid(i - 1, j),
                (from, to) => this.addVerticalBar(i, from, to, true));

            this.scanRuns(this.board.rows,
                (j) => this.isSolid(i, j) && !this.isSolid(i + 1, j),
                (from, to) => this.addVerticalBar(i, from, to, false));
        }

        for (let j = 0; j < this.board.rows; j++) {

            this.scanRuns(this.board.columns,
                (i) => this.isSolid(i, j) && !this.isSolid(i, j - 1),
                (from, to) => this.addHorizontalBar(from, to, j, true));

            this.scanRuns(this.board.columns,
                (i) => this.isSolid(i, j) && !this.isSolid(i, j + 1),
                (from, to) => this.addHorizontalBar(from, to, j, false));
        }
    }

    scanRuns(count, isExposed, onRun) {

        let start = -1;

        for (let n = 0; n <= count; n++) {

            if (n < count && isExposed(n)) {
                if (start === -1) start = n;
                continue;
            }

            if (start === -1) continue;

            onRun(start, n - 1);
            start = -1;
        }
    }

    // A run of exposed cells ends either at a corner of the board, where the frame
    // turns around the board, or against a wall, where it turns around the hole.
    // Either way a corner piece carries that stretch and the bar stops short of it.
    trim(cornerSpan, turnsOutward) {

        return (turnsOutward ? cornerSpan : INNER_SPAN) * this.unit;
    }

    addHorizontalBar(from, to, row, above) {

        const first = this.cell(from, row);
        const last = this.cell(to, row);

        const x = first.left + this.trim(CORNER_SPAN_X, !this.isSolid(from - 1, row));
        const end = last.right - this.trim(CORNER_SPAN_X, !this.isSolid(to + 1, row));

        if (end <= x) return;

        const y = above ? first.top - BAR_TOP * this.unit : first.bottom;

        this.addPiece(above ? "top" : "bottom", x, y, end - x, H_BAR_HEIGHT * this.unit);
    }

    addVerticalBar(col, from, to, isLeft) {

        const first = this.cell(col, from);
        const last = this.cell(col, to);

        const y = first.top + this.trim(CORNER_SPAN_TOP, !this.isSolid(col, from - 1));
        const end = last.bottom - this.trim(CORNER_SPAN_BOTTOM, !this.isSolid(col, to + 1));

        if (end <= y) return;

        const x = isLeft ? first.left - BAR_SIDE * this.unit : first.right - RIGHT_BAR_INSET * this.unit;

        this.addPiece(isLeft ? "left" : "right", x, y, V_BAR_WIDTH * this.unit, end - y);
    }

    // Added after the bars: a corner carries the curve and has to sit over the
    // ends of the two bars it joins.
    //
    // An outward corner belongs to the cell that has both of those sides open. An
    // inward one wraps a hole, and belongs to the single cell sitting diagonally
    // opposite that hole - so each one is only ever drawn once.
    addCorners() {

        for (let i = 0; i < this.board.columns; i++) {
            for (let j = 0; j < this.board.rows; j++) {

                if (!this.isSolid(i, j)) continue;

                const cell = this.cell(i, j);

                const openTop = !this.isSolid(i, j - 1);
                const openBottom = !this.isSolid(i, j + 1);
                const openLeft = !this.isSolid(i - 1, j);
                const openRight = !this.isSolid(i + 1, j);

                const left = cell.left - BAR_SIDE * this.unit;
                const right = cell.right - CORNER_INSET_X * this.unit;
                const top = cell.top - BAR_TOP * this.unit;
                const bottom = cell.bottom - CORNER_INSET_Y * this.unit;

                const pinchTL = this.isPinch(i, j, -1, -1);
                const pinchTR = this.isPinch(i, j, 1, -1);
                const pinchBR = this.isPinch(i, j, 1, 1);
                const pinchBL = this.isPinch(i, j, -1, 1);

                if (openTop && openLeft && !pinchTL) this.addPiece("top_left", left, top);
                if (openTop && openRight && !pinchTR) this.addPiece("top_right", right, top);
                if (openBottom && openLeft && !pinchBL) this.addPiece("bottom_left", left, bottom);
                if (openBottom && openRight && !pinchBR) this.addPiece("bottom_right", right, bottom);

                // A junction piece carries the corner for both of the cells it joins,
                // so it is left to the upper one of the two to lay it down once.
                const half = PINCH_HALF * this.unit;

                if (pinchBR) this.addPiece("pinch_down", cell.right - half, cell.bottom - half);
                if (pinchBL) this.addPiece("pinch_up", cell.left - half, cell.bottom - half);

                const near = INNER_NEAR * this.unit;
                const span = INNER_INSET * this.unit;

                if (!openTop && !openLeft && !this.isSolid(i - 1, j - 1)) this.addPiece("inner_top_left", cell.left - span, cell.top - span);
                if (!openTop && !openRight && !this.isSolid(i + 1, j - 1)) this.addPiece("inner_top_right", cell.right - near, cell.top - span);
                if (!openBottom && !openLeft && !this.isSolid(i - 1, j + 1)) this.addPiece("inner_bottom_left", cell.left - span, cell.bottom - near);
                if (!openBottom && !openRight && !this.isSolid(i + 1, j + 1)) this.addPiece("inner_bottom_right", cell.right - near, cell.bottom - near);
            }
        }
    }

    addPiece(name, x, y, width, height) {

        const piece = this.scene.add.sprite(x, y, "sheet", "board_borders/" + name);
        piece.setOrigin(0);

        // Bars are stretched to the length they have to cover, corners keep the
        // curve they were drawn with.
        if (width) piece.setDisplaySize(width, height);
        else piece.setScale(this.unit);

        this.frameLayer.add(piece);

        return piece;
    }
}
