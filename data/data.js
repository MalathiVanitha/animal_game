export default {
    1: {
        rows: 7,
        cols: 7,

        tileWidth: 69,
        tileHeight: 69,
        tileScale: .55,

        tileTypes: ["Bread", "Burger", "Cupcake", "Donut", "Popcorn"],
        cellTile: "board_borders/tiles",

        pattern: [
            [0, 0, 0, -2, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0],
            [0, -2, 0, 0, 0, 0, 0],
            [-2, 0, 0, 0, 0, 0, -2],
            [0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, -2, 0, 0, 0],
        ],

        "moves": 30,
        "lives": 5,
        "lifeRegenSeconds": 1800,


        // Top panel: one hungry customer per order.
        "characters": [
            { character: "Dog", food: "Popcorn", name: "Popcorn", count: 30 },
            { character: "Cat", food: "Cupcake", name: "Cupcake", count: 30 },
            { character: "Pig", food: "Burger", name: "Burger", count: 30 },
        ],

    }
}