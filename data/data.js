// Level table.
//
// The game runs as ten hand-authored levels. Level 1 is deliberately tiny - one
// customer, a short order, a solid 5x5 grid and only three kinds of food, so the
// first match is almost impossible to miss. From there the stall fills up, the
// orders get longer, and the board stops being a rectangle: every level after
// the third is cut into its own silhouette, and the shape is what makes it hard.
//
// slots: how many customers stand at the counter at once.
// characters: the level's orders, in the order they are served. The first
// `slots` of them open the level; any beyond that wait off screen, and walk on
// as the customers in front of them finish their order and leave. From level 5
// there are more orders than places to stand, so the counter keeps turning over
// instead of emptying out.
//
// pattern: 0 = a playable cell, -2 = a hole (GameConstants.EMPTY).
// The board frame is drawn from this, so any shape below is legal - but each
// shape has to hold at least one run of three, and any stretch of cells sealed
// under a hole has to be reachable either diagonally from the side or straight
// down from above, which is how the board refills them.
//
// The atlas ships three customer sprites (Dog, Cat, Pig), so the later levels
// bring the same three faces back with different orders.

const BASE = {
    tileWidth: 69,
    tileHeight: 69,
    tileScale: .55,
    cellTile: "board_borders/tiles",
    lives: 5,
    lifeRegenSeconds: 1800,
};

const level = (config) => Object.assign({}, BASE, config, {
    rows: config.pattern.length,
    cols: config.pattern[0].length,
});

export default {

    // 1 - one customer, one short order, a plain grid, three foods.
    1: level({
        tileTypes: ["Popcorn", "Cupcake", "Burger"],
        pattern: [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
        ],
        moves: 20,
        slots: 1,
        characters: [
            { character: "Dog", food: "Popcorn", name: "Popcorn", count: 8 },
        ],
    }),

    // 2 - a second customer joins, and the counter takes a bite out of the top.
    2: level({
        tileTypes: ["Popcorn", "Cupcake", "Burger", "Donut"],
        pattern: [
            [0, 0, -2, -2, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
        ],
        moves: 22,
        slots: 2,
        characters: [
            { character: "Dog", food: "Popcorn", name: "Popcorn", count: 10 },
            { character: "Cat", food: "Cupcake", name: "Cupcake", count: 10 },
        ],
    }),

    // 3 - the counter fills up at three, and the board pinches in at the waist.
    3: level({
        tileTypes: ["Popcorn", "Cupcake", "Burger", "Donut"],
        pattern: [
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [-2, 0, 0, 0, 0, -2],
            [-2, 0, 0, 0, 0, -2],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
        ],
        moves: 24,
        slots: 3,
        characters: [
            { character: "Dog", food: "Popcorn", name: "Popcorn", count: 11 },
            { character: "Cat", food: "Cupcake", name: "Cupcake", count: 11 },
            { character: "Pig", food: "Burger", name: "Burger", count: 11 },
        ],
    }),

    // 4 - a heart, and the fifth food arrives, so matches get harder to line up.
    4: level({
        tileTypes: ["Popcorn", "Cupcake", "Burger", "Donut", "Bread"],
        pattern: [
            [-2, 0, 0, -2, 0, 0, -2],
            [0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0],
            [-2, 0, 0, 0, 0, 0, -2],
            [-2, -2, 0, 0, 0, -2, -2],
            [-2, -2, -2, 0, -2, -2, -2],
        ],
        moves: 26,
        slots: 3,
        characters: [
            { character: "Dog", food: "Donut", name: "Donut", count: 13 },
            { character: "Cat", food: "Bread", name: "Bread", count: 13 },
            { character: "Pig", food: "Burger", name: "Burger", count: 13 },
        ],
    }),

    // 5 - four orders for three places: the first customer to be served walks
    // off and the one waiting behind them takes their spot. A rocket board.
    5: level({
        tileTypes: ["Popcorn", "Cupcake", "Burger", "Donut", "Bread"],
        pattern: [
            [-2, -2, -2, 0, -2, -2, -2],
            [-2, -2, 0, 0, 0, -2, -2],
            [-2, 0, 0, 0, 0, 0, -2],
            [0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0],
            [-2, -2, 0, 0, 0, -2, -2],
            [-2, -2, 0, 0, 0, -2, -2],
        ],
        moves: 26,
        slots: 3,
        characters: [
            { character: "Dog", food: "Popcorn", name: "Popcorn", count: 11 },
            { character: "Cat", food: "Cupcake", name: "Cupcake", count: 11 },
            { character: "Pig", food: "Burger", name: "Burger", count: 11 },
            { character: "Dog", food: "Donut", name: "Donut", count: 11 },
        ],
    }),

    // 6 - five orders, and a butterfly whose wings meet only through the middle,
    // so clearing one side leaves the other untouched.
    6: level({
        tileTypes: ["Popcorn", "Cupcake", "Burger", "Donut", "Bread"],
        pattern: [
            [0, 0, -2, -2, -2, 0, 0],
            [0, 0, 0, -2, 0, 0, 0],
            [-2, 0, 0, 0, 0, 0, -2],
            [-2, -2, 0, 0, 0, -2, -2],
            [-2, 0, 0, 0, 0, 0, -2],
            [0, 0, 0, -2, 0, 0, 0],
            [0, 0, -2, -2, -2, 0, 0],
        ],
        moves: 28,
        slots: 3,
        characters: [
            { character: "Dog", food: "Popcorn", name: "Popcorn", count: 10 },
            { character: "Cat", food: "Cupcake", name: "Cupcake", count: 10 },
            { character: "Pig", food: "Burger", name: "Burger", count: 10 },
            { character: "Dog", food: "Donut", name: "Donut", count: 10 },
            { character: "Cat", food: "Bread", name: "Bread", count: 10 },
        ],
    }),

    // 7 - 8x8, cut in half by a diagonal. The two triangles feed each other
    // sideways as tiles fall, but nothing can be swapped across the cut.
    7: level({
        tileTypes: ["Popcorn", "Cupcake", "Burger", "Donut", "Bread"],
        pattern: [
            [-2, 0, 0, 0, 0, 0, 0, 0],
            [0, -2, 0, 0, 0, 0, 0, 0],
            [0, 0, -2, 0, 0, 0, 0, 0],
            [0, 0, 0, -2, 0, 0, 0, 0],
            [0, 0, 0, 0, -2, 0, 0, 0],
            [0, 0, 0, 0, 0, -2, 0, 0],
            [0, 0, 0, 0, 0, 0, -2, 0],
            [0, 0, 0, 0, 0, 0, 0, -2],
        ],
        moves: 30,
        slots: 3,
        characters: [
            { character: "Cat", food: "Bread", name: "Bread", count: 11 },
            { character: "Pig", food: "Popcorn", name: "Popcorn", count: 11 },
            { character: "Dog", food: "Cupcake", name: "Cupcake", count: 11 },
            { character: "Cat", food: "Burger", name: "Burger", count: 11 },
            { character: "Pig", food: "Donut", name: "Donut", count: 11 },
        ],
    }),

    // 8 - six orders. Windows punched into four blocks: tiles fall down narrow
    // pillars and the two full rows are the only way across the board.
    8: level({
        tileTypes: ["Popcorn", "Cupcake", "Burger", "Donut", "Bread"],
        pattern: [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, -2, 0, -2, -2, 0, -2, 0],
            [0, -2, 0, -2, -2, 0, -2, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, -2, 0, -2, -2, 0, -2, 0],
            [0, -2, 0, -2, -2, 0, -2, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
        ],
        moves: 32,
        slots: 3,
        characters: [
            { character: "Dog", food: "Donut", name: "Donut", count: 10 },
            { character: "Cat", food: "Bread", name: "Bread", count: 10 },
            { character: "Pig", food: "Popcorn", name: "Popcorn", count: 10 },
            { character: "Dog", food: "Cupcake", name: "Cupcake", count: 10 },
            { character: "Cat", food: "Burger", name: "Burger", count: 10 },
            { character: "Pig", food: "Donut", name: "Donut", count: 10 },
        ],
    }),

    // 9 - a wheel: an outer rim, a sealed pocket in the middle that has to be
    // refilled from above, and a single spoke row joining the two.
    9: level({
        tileTypes: ["Popcorn", "Cupcake", "Burger", "Donut", "Bread"],
        pattern: [
            [-2, -2, 0, 0, 0, 0, -2, -2],
            [-2, 0, 0, 0, 0, 0, 0, -2],
            [0, 0, -2, -2, -2, -2, 0, 0],
            [0, 0, -2, 0, 0, -2, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, -2, -2, -2, -2, 0, 0],
            [-2, 0, 0, 0, 0, 0, 0, -2],
            [-2, -2, 0, 0, 0, 0, -2, -2],
        ],
        moves: 34,
        slots: 3,
        characters: [
            { character: "Pig", food: "Cupcake", name: "Cupcake", count: 11 },
            { character: "Dog", food: "Burger", name: "Burger", count: 11 },
            { character: "Cat", food: "Donut", name: "Donut", count: 11 },
            { character: "Pig", food: "Bread", name: "Bread", count: 11 },
            { character: "Dog", food: "Popcorn", name: "Popcorn", count: 11 },
            { character: "Cat", food: "Cupcake", name: "Cupcake", count: 11 },
        ],
    }),

    // 10 - the last one: seven orders through three places, on a star standing
    // on two legs.
    10: level({
        tileTypes: ["Popcorn", "Cupcake", "Burger", "Donut", "Bread"],
        pattern: [
            [-2, -2, -2, 0, 0, -2, -2, -2],
            [-2, -2, 0, 0, 0, 0, -2, -2],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [-2, 0, 0, 0, 0, 0, 0, -2],
            [-2, -2, 0, 0, 0, 0, -2, -2],
            [-2, 0, 0, 0, 0, 0, 0, -2],
            [0, 0, -2, -2, -2, -2, 0, 0],
            [0, 0, -2, -2, -2, -2, 0, 0],
        ],
        moves: 38,
        slots: 3,
        characters: [
            { character: "Dog", food: "Popcorn", name: "Popcorn", count: 11 },
            { character: "Cat", food: "Cupcake", name: "Cupcake", count: 11 },
            { character: "Pig", food: "Burger", name: "Burger", count: 11 },
            { character: "Dog", food: "Donut", name: "Donut", count: 11 },
            { character: "Cat", food: "Bread", name: "Bread", count: 11 },
            { character: "Pig", food: "Popcorn", name: "Popcorn", count: 11 },
            { character: "Dog", food: "Cupcake", name: "Cupcake", count: 11 },
        ],
    }),
}
