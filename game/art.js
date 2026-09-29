// All the pixel art is drawn here in code: tiles, buildings, furniture and
// characters. It's original art in a Gen-4 handheld style, drawn at 16px per tile.

export const T = 16;
export const FONT = "'Press Start 2P', monospace";

export const C = {
    outline: "#2a2230",
    grass: "#78d098", grassDark: "#58b47c", grassLight: "#a0e4b4",
    sand: "#ecd098", sandDark: "#d0ac70", sandEdge: "#b88c58",
    road: "#6c6874", roadDark: "#5a5662", roadLine: "#f0e070",
    brick: "#a07060", brickDark: "#845848", brickLight: "#b88474", mortar: "#74493c",
    curb: "#c8c4cc", curbDark: "#98949e",
    water: "#4c94e8", waterLight: "#8cc4f8", waterDark: "#3474c8",
    wood: "#c89060", woodDark: "#a06c40", woodLight: "#e0b080",
    treeDark: "#2e7a44", tree: "#3e9a54", treeLight: "#62bc6a", treeHi: "#8cd47c", trunk: "#7a5030",
    white: "#f8f8f8", black: "#181820",
};

function canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    return [c, g];
}
const R = (g, x, y, w, h, color) => { g.fillStyle = color; g.fillRect(x, y, w, h); };

// Tiny deterministic hash for speckles, so the ground looks the same every visit.
const hash = (x, y, s = 0) => {
    let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Pixel disc / ellipse fill.
function ellipse(g, cx, cy, rx, ry, color) {
    g.fillStyle = color;
    for (let y = -ry; y <= ry; y++) {
        const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
        g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
    }
}

function text(g, str, x, y, color, size = 8, align = "center") {
    g.font = `${size}px ${FONT}`;
    g.textAlign = align;
    g.textBaseline = "top";
    g.fillStyle = color;
    g.fillText(str, x, y);
}

// ---------------------------------------------------------------- Ground

const GRASSY = new Set(["g", "G", "f", "F2"]);

// Draws one ground tile at (px, py). `at(dx, dy)` returns the neighbouring tile code.
export function drawGroundTile(g, code, px, py, tx, ty, at) {
    switch (code) {
        case "g": case "G": case "f": {
            R(g, px, py, T, T, C.grass);
            for (let i = 0; i < 3; i++) {
                const hx = Math.floor(hash(tx, ty, i) * 14), hy = Math.floor(hash(ty, tx, i + 7) * 14);
                R(g, px + hx, py + hy, 2, 1, C.grassDark);
                R(g, px + hx + 1, py + hy - 1, 1, 1, C.grassDark);
            }
            if (hash(tx, ty, 9) > 0.7) R(g, px + 6, py + 9, 1, 1, C.grassLight);
            if (code === "G") {
                // Tall grass tufts.
                for (const [ox, oy] of [[1, 3], [9, 3], [5, 10], [12, 11]]) {
                    R(g, px + ox, py + oy + 2, 4, 3, C.grassDark);
                    R(g, px + ox + 1, py + oy, 1, 3, C.treeLight);
                    R(g, px + ox + 3, py + oy + 1, 1, 2, C.treeLight);
                }
            }
            if (code === "f") {
                const petal = ["#f8f8f8", "#f89088", "#f8d048"][Math.floor(hash(tx, ty, 3) * 3)];
                for (const [ox, oy] of [[3, 3], [10, 8]]) {
                    R(g, px + ox, py + oy, 3, 3, petal);
                    R(g, px + ox + 1, py + oy - 1, 1, 5, petal);
                    R(g, px + ox - 1, py + oy + 1, 5, 1, petal);
                    R(g, px + ox + 1, py + oy + 1, 1, 1, "#e89830");
                }
            }
            break;
        }
        case "p": {
            R(g, px, py, T, T, C.sand);
            if (hash(tx, ty, 1) > 0.6) R(g, px + Math.floor(hash(tx, ty, 2) * 12) + 2, py + Math.floor(hash(tx, ty, 4) * 12) + 2, 2, 1, C.sandDark);
            edges(g, px, py, at, (n) => n !== "p" && n !== "d", C.sandEdge, C.grassDark);
            break;
        }
        case "r": case "l": {
            R(g, px, py, T, T, C.road);
            if (hash(tx, ty, 5) > 0.5) R(g, px + Math.floor(hash(tx, ty, 6) * 14), py + Math.floor(hash(tx, ty, 8) * 14), 1, 1, C.roadDark);
            if (code === "l") R(g, px + 2, py + 15, 8, 2, C.roadLine);
            const n = at(0, -1), s = at(0, 1);
            if (n !== "r" && n !== "l" && n !== "d") R(g, px, py, T, 2, C.curbDark);
            if (s !== "r" && s !== "l" && s !== "d") R(g, px, py + 14, T, 2, C.curbDark);
            break;
        }
        case "b": {
            // Herringbone-ish brick paving like a downtown square.
            R(g, px, py, T, T, C.brick);
            for (let row = 0; row < 4; row++) {
                const off = (row + ty) % 2 ? 4 : 0;
                R(g, px, py + row * 4 + 3, T, 1, C.mortar);
                for (let col = -1; col < 3; col++) R(g, px + col * 8 + off, py + row * 4, 1, 3, C.mortar);
                R(g, px + ((row * 5 + tx) % 12), py + row * 4 + 1, 3, 1, C.brickLight);
            }
            break;
        }
        case "c": {
            R(g, px, py, T, T, C.curb);
            R(g, px, py + 7, T, 1, C.curbDark);
            R(g, px + ((ty % 2) ? 4 : 11), py, 1, 7, C.curbDark);
            R(g, px + ((ty % 2) ? 11 : 4), py + 8, 1, 8, C.curbDark);
            R(g, px, py + 15, T, 1, C.curbDark);
            break;
        }
        case "w": {
            R(g, px, py, T, T, C.water);
            edges(g, px, py, at, (n) => n !== "w", C.waterDark, C.sandEdge);
            break;
        }
        case "d": {
            R(g, px, py, T, T, C.wood);
            for (let i = 0; i < 4; i++) R(g, px + i * 4 + 3, py, 1, T, C.woodDark);
            R(g, px, py, T, 1, C.woodDark);
            R(g, px, py + 15, T, 1, C.woodDark);
            break;
        }
        // ---- Interiors
        case "F": {
            R(g, px, py, T, T, "#d8a870");
            R(g, px, py + 7, T, 1, "#b88450");
            R(g, px, py + 15, T, 1, "#b88450");
            R(g, px + ((tx % 2) ? 5 : 12), py, 1, 7, "#b88450");
            R(g, px + ((tx % 2) ? 12 : 5), py + 8, 1, 7, "#b88450");
            R(g, px + 2, py + 2, 3, 1, "#e8c090");
            break;
        }
        case "Tl": case "t": {
            R(g, px, py, T, T, (tx + ty) % 2 ? "#e8f0f0" : "#d4e0e4");
            R(g, px, py, T, 1, "#c0ccd4");
            R(g, px, py, 1, T, "#c0ccd4");
            break;
        }
        case "k": {
            // Arcade carpet with a retro confetti pattern.
            R(g, px, py, T, T, "#2c2050");
            const cols = ["#a8407c", "#3c98a8", "#b8a048", "#6848b0"];
            for (let i = 0; i < 4; i++) {
                if (hash(tx, ty, i + 40) > 0.45) continue;
                const hx = Math.floor(hash(tx, ty, i + 20) * 13), hy = Math.floor(hash(ty, tx, i + 30) * 13);
                const c = cols[i];
                if (i % 2) { R(g, px + hx, py + hy, 3, 1, c); R(g, px + hx + 1, py + hy - 1, 1, 3, c); }
                else R(g, px + hx, py + hy, 2, 2, c);
            }
            break;
        }
        case "q": {
            // Polished tower floor.
            R(g, px, py, T, T, "#8ca4bc");
            R(g, px, py, T, 1, "#a8bcd0");
            R(g, px, py, 1, T, "#a8bcd0");
            R(g, px + 15, py, 1, T, "#7890a8");
            R(g, px, py + 15, T, 1, "#7890a8");
            if ((tx + ty) % 3 === 0) R(g, px + 3, py + 3, 4, 1, "#c8d8e8");
            break;
        }
        case "m": {
            R(g, px, py, T, T, "#c05048");
            R(g, px + 2, py + 2, 12, 12, "#d86858");
            for (let i = 0; i < 3; i++) R(g, px + 4, py + 4 + i * 3, 8, 1, "#f0a070");
            break;
        }
        case "W": {
            // Interior wall: coloured by the map's wallpaper, drawn later per map.
            R(g, px, py, T, T, "#e8d8c0");
            break;
        }
        case "x": default:
            R(g, px, py, T, T, C.black);
    }
}

function edges(g, px, py, at, isOther, rim, outer) {
    if (isOther(at(0, -1))) { R(g, px, py, T, 1, outer); R(g, px, py + 1, T, 1, rim); }
    if (isOther(at(0, 1))) { R(g, px, py + 15, T, 1, outer); R(g, px, py + 14, T, 1, rim); }
    if (isOther(at(-1, 0))) { R(g, px, py, 1, T, outer); R(g, px + 1, py, 1, T, rim); }
    if (isOther(at(1, 0))) { R(g, px + 15, py, 1, T, outer); R(g, px + 14, py, 1, T, rim); }
}

// Animated sparkle on water tiles, drawn each frame over the cached ground.
export function drawWaterSparkle(g, px, py, tx, ty, t) {
    const phase = (t * 1.5 + hash(tx, ty, 11) * 6) % 6;
    if (phase < 3) {
        const x = px + 3 + Math.floor(hash(tx, ty, 12) * 8);
        const y = py + 4 + Math.floor(hash(tx, ty, 13) * 8);
        R(g, x, y, 4 - Math.floor(phase), 1, C.waterLight);
        R(g, x + 5, y + 3, 2, 1, C.waterLight);
    }
}

// ---------------------------------------------------------------- Sprites from pixel rows

const PALETTE = {
    k: C.outline, h: "#3a2c28", H: "#6a5040", s: "#f0b888", S: "#d08c60", e: C.outline,
    d: "#5a4034", b: "#3c6cd8", B: "#2a4ca8", w: "#f4f4f4", p: "#3a4260", P: "#2a3048", o: "#6a4430",
};

function fromRows(rows, pal) {
    const [c, g] = canvas(16, rows.length);
    rows.forEach((row, y) => {
        for (let x = 0; x < 16; x++) {
            const ch = row[x];
            if (ch && ch !== "." && pal[ch]) R(g, x, y, 1, 1, pal[ch]);
        }
    });
    return c;
}
const mirrorRow = (half) => half + [...half].reverse().join("");
function flip(src) {
    const [c, g] = canvas(src.width, src.height);
    g.translate(src.width, 0);
    g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    return c;
}

const FRONT = ["......kk", "....kkhh", "...khhHh", "..khhhhh", "..khhhhh", "..khhhhs", "..kShsss", ".kSssess", "..ksssss", "..kdssss", "...kdddd", "..kbbbww", ".kbbBbbw", ".ksbBbbw", "..kbbbbb", "..kppppp"].map(mirrorRow);
const BACK = ["......kk", "....kkhh", "...khhhh", "..khhHhh", "..khhhhh", "..khhhhh", "..khhhhh", ".kShhhhh", "..kShhhh", "..kkhhhh", "...kssss", "..kbbbbb", ".kbbBbbb", ".ksbBbbb", "..kbbbbb", "..kppppp"].map(mirrorRow);
const LEGS = {
    stand: ["..kpppk..kpppk..", "..kook....kook.."],
    stepA: ["..kpppk..kook...", "..kook.........."],
    stepB: ["...kook..kpppk..", "..........kook.."],
};
const SIDE = [
    "......kkkk......",
    "....kkhhhhkk....",
    "...khhhHhhhhk...",
    "..khhhhhhhhhhk..",
    "..khhhhhhhhhhk..",
    "..kshhhhhhhhhk..",
    ".ksssshhhhhhk...",
    ".ksessshhShhk...",
    ".kssssssssSk....",
    "..kddssssSk.....",
    "...kddddkk......",
    "....kbbbbbk.....",
    "...kbbbbBBBk....",
    "...kbbsbBBBk....",
    "....kbbbbbk.....",
    "....kpppppk.....",
];
const SIDE_LEGS = {
    stand: ["....kpppPk......", "....kkook......."],
    stepA: ["...kppk.kPPk....", "...kook.kook...."],
    stepB: ["....kpPPk.......", "....kook........"],
};

/** Returns { down:[f0,f1,f2,f3], up:[...], left:[...], right:[...] } for a palette. */
export function makeCharacter(overrides = {}) {
    const pal = { ...PALETTE, ...overrides };
    const build = (top, legs) => [legs.stand, legs.stepA, legs.stand, legs.stepB].map((l) => fromRows([...top, ...l], pal));
    const left = build(SIDE, SIDE_LEGS);
    return { down: build(FRONT, LEGS), up: build(BACK, LEGS), left, right: left.map(flip) };
}

// Upper body only, for riding the bike or peeking out of the car.
export function upperBody(frame) {
    const [c, g] = canvas(16, 15);
    g.drawImage(frame, 0, 0, 16, 15, 0, 0, 16, 15);
    return c;
}

// ---------------------------------------------------------------- Vehicles

export function makeCar(color = "#d83838", shade = "#a82428") {
    const vert = (facingUp) => {
        const [c, g] = canvas(20, 30);
        R(g, 1, 3, 18, 25, C.outline);
        R(g, 2, 2, 16, 26, color);
        R(g, 3, 3, 14, 1, "#f07070");
        // Wheels.
        for (const [x, y] of [[0, 5], [16, 5], [0, 20], [16, 20]]) R(g, x, y, 4, 6, C.black);
        // Windshields and roof.
        const front = facingUp ? 6 : 19;
        const back = facingUp ? 21 : 6;
        R(g, 4, front, 12, 4, "#8cd0f8");
        R(g, 5, front + 1, 3, 1, C.white);
        R(g, 4, back, 12, 3, "#5890c0");
        R(g, 4, facingUp ? 10 : 9, 12, 10, shade);
        R(g, 5, facingUp ? 11 : 10, 10, 8, color);
        // Lights.
        const ly = facingUp ? 2 : 27;
        R(g, 3, ly, 3, 1, facingUp ? C.white : "#f8d048");
        R(g, 14, ly, 3, 1, facingUp ? C.white : "#f8d048");
        return c;
    };
    const down = vert(false), up = vert(true);
    const side = (() => {
        const [c, g] = canvas(30, 20);
        g.translate(30, 0);
        g.rotate(Math.PI / 2);
        g.drawImage(up, 0, 0);
        return c;
    })();
    return { down, up, right: side, left: flip(side) };
}

export function makeBike() {
    const frame = "#e84040";
    const vert = () => {
        const [c, g] = canvas(16, 24);
        for (const y of [0, 16]) { R(g, 6, y, 4, 8, C.black); R(g, 7, y + 1, 2, 6, "#686870"); }
        R(g, 6, 7, 4, 10, C.outline);
        R(g, 7, 7, 2, 10, frame);
        R(g, 2, 5, 12, 2, C.outline);
        R(g, 3, 5, 10, 1, "#b0b0b8");
        R(g, 5, 13, 6, 3, C.black);
        return c;
    };
    const side = (() => {
        const [c, g] = canvas(24, 16);
        ellipse(g, 5, 11, 4, 4, C.black);
        ellipse(g, 5, 11, 2, 2, "#b0b0b8");
        ellipse(g, 19, 11, 4, 4, C.black);
        ellipse(g, 19, 11, 2, 2, "#b0b0b8");
        R(g, 5, 10, 14, 2, frame);
        R(g, 11, 5, 2, 6, frame);
        R(g, 17, 4, 2, 7, frame);
        R(g, 15, 3, 5, 1, "#484848");
        R(g, 9, 4, 5, 2, C.black);
        return c;
    })();
    const v = vert();
    return { down: v, up: v, left: side, right: flip(side) };
}

// ---------------------------------------------------------------- Nature & props

export function makeTree() {
    const [c, g] = canvas(32, 40);
    ellipse(g, 16, 36, 12, 3, "rgba(0,0,0,0.18)");
    R(g, 13, 26, 6, 10, C.outline);
    R(g, 14, 26, 4, 10, C.trunk);
    R(g, 14, 26, 1, 10, "#9a6a40");
    // Layered round canopy like the classic handheld pines.
    ellipse(g, 16, 22, 15, 9, C.outline);
    ellipse(g, 16, 21, 14, 8, C.treeDark);
    ellipse(g, 16, 14, 13, 9, C.outline);
    ellipse(g, 16, 13, 12, 8, C.tree);
    ellipse(g, 16, 8, 9, 7, C.outline);
    ellipse(g, 16, 7, 8, 6, C.treeLight);
    ellipse(g, 12, 5, 3, 2, C.treeHi);
    for (let i = 0; i < 6; i++) R(g, 4 + i * 4, 21 + (i % 2), 2, 1, C.tree);
    for (let i = 0; i < 5; i++) R(g, 6 + i * 4, 13 + (i % 2), 2, 1, C.treeLight);
    return c;
}

export function makeBush() {
    const [c, g] = canvas(16, 16);
    ellipse(g, 8, 9, 8, 6, C.outline);
    ellipse(g, 8, 9, 7, 5, C.tree);
    ellipse(g, 6, 7, 3, 2, C.treeLight);
    return c;
}

export function makeFence() {
    const [c, g] = canvas(16, 16);
    R(g, 0, 6, 16, 2, "#f0f0f0");
    R(g, 0, 11, 16, 2, "#f0f0f0");
    R(g, 0, 8, 16, 1, "#b0b0b8");
    for (const x of [2, 10]) {
        R(g, x, 2, 4, 13, C.outline);
        R(g, x + 1, 3, 2, 11, "#f8f8f8");
    }
    return c;
}

export function makeSign() {
    const [c, g] = canvas(16, 16);
    R(g, 7, 9, 2, 7, C.woodDark);
    R(g, 1, 2, 14, 9, C.outline);
    R(g, 2, 3, 12, 7, C.wood);
    R(g, 2, 3, 12, 1, C.woodLight);
    R(g, 4, 5, 8, 1, C.woodDark);
    R(g, 4, 7, 6, 1, C.woodDark);
    return c;
}

export function makeMailbox() {
    const [c, g] = canvas(16, 24);
    R(g, 7, 12, 2, 12, "#5a5a64");
    R(g, 2, 3, 12, 10, C.outline);
    R(g, 3, 4, 10, 8, "#e04040");
    R(g, 3, 4, 10, 2, "#f07070");
    R(g, 5, 8, 6, 1, "#a82020");
    R(g, 13, 2, 2, 6, "#f8d048");
    return c;
}

export function makeLamp() {
    const [c, g] = canvas(16, 40);
    ellipse(g, 8, 37, 5, 2, "rgba(0,0,0,0.2)");
    R(g, 7, 12, 3, 26, C.outline);
    R(g, 8, 12, 1, 26, "#4a5a6a");
    R(g, 5, 36, 7, 2, C.outline);
    ellipse(g, 8, 7, 6, 6, "rgba(255,240,160,0.35)");
    R(g, 4, 3, 9, 9, C.outline);
    R(g, 5, 4, 7, 7, "#fff0a0");
    R(g, 3, 1, 11, 3, "#304050");
    return c;
}

export function makeFountain() {
    const [c, g] = canvas(48, 48);
    ellipse(g, 24, 26, 23, 18, "#8c8894");
    ellipse(g, 24, 25, 21, 16, "#c8c4cc");
    ellipse(g, 24, 25, 17, 12, C.water);
    ellipse(g, 24, 22, 5, 4, "#c8c4cc");
    R(g, 22, 8, 4, 14, "#c8c4cc");
    ellipse(g, 24, 8, 4, 3, C.waterLight);
    return c;
}

export function makeBench() {
    const [c, g] = canvas(32, 16);
    R(g, 1, 4, 30, 7, C.outline);
    R(g, 2, 5, 28, 2, C.wood);
    R(g, 2, 8, 28, 2, C.woodLight);
    R(g, 4, 11, 2, 5, C.outline);
    R(g, 26, 11, 2, 5, C.outline);
    return c;
}

export function makePlanter() {
    const [c, g] = canvas(16, 20);
    R(g, 1, 10, 14, 10, C.outline);
    R(g, 2, 11, 12, 8, "#b87040");
    ellipse(g, 8, 8, 7, 6, C.outline);
    ellipse(g, 8, 8, 6, 5, C.tree);
    R(g, 5, 5, 2, 2, "#f89088");
    R(g, 10, 8, 2, 2, "#f8d048");
    return c;
}

// ---------------------------------------------------------------- Buildings

function roof(g, x, y, w, h, color, dark, light) {
    // Gabled roof seen from the front, with shingle rows.
    R(g, x, y, w, h, C.outline);
    R(g, x + 1, y + 1, w - 2, h - 2, color);
    for (let r = y + 4; r < y + h - 2; r += 4) {
        R(g, x + 1, r, w - 2, 1, dark);
        for (let s = x + ((r / 4) % 2 ? 4 : 8); s < x + w - 2; s += 8) R(g, s, r - 3, 1, 3, dark);
    }
    R(g, x + 1, y + 1, w - 2, 2, light);
    R(g, x, y + h - 2, w, 2, dark);
}

function windowAt(g, x, y, w = 14, h = 12) {
    R(g, x, y, w, h, C.outline);
    R(g, x + 1, y + 1, w - 2, h - 2, "#f8f8f8");
    R(g, x + 2, y + 2, w - 4, h - 4, "#78b8f0");
    R(g, x + 2, y + 2, 3, 2, "#c8e8ff");
    R(g, x + Math.floor(w / 2), y + 1, 1, h - 2, "#f8f8f8");
}

function door(g, x, y, color = "#9a5a30") {
    R(g, x, y, 16, 20, C.outline);
    R(g, x + 1, y + 1, 14, 19, color);
    R(g, x + 3, y + 3, 10, 6, "#78b8f0");
    R(g, x + 11, y + 12, 2, 2, "#f8d048");
}

function glassDoor(g, x, y) {
    R(g, x, y, 16, 20, C.outline);
    R(g, x + 1, y + 1, 6, 19, "#a8e0f8");
    R(g, x + 9, y + 1, 6, 19, "#a8e0f8");
    R(g, x + 2, y + 2, 2, 8, "#e8f8ff");
    R(g, x + 10, y + 2, 2, 8, "#e8f8ff");
}

/** Jose's house: 8 x 6 tiles, door in column 3. */
export function makeHouse() {
    const W = 128, H = 104;
    const [c, g] = canvas(W, H);
    ellipse(g, 64, 100, 62, 4, "rgba(0,0,0,0.15)");
    // Chimney.
    R(g, 92, 2, 12, 20, C.outline);
    R(g, 93, 3, 10, 19, "#b86a48");
    roof(g, 2, 8, 124, 46, "#e8603c", "#b84428", "#f89070");
    R(g, 58, 8, 12, 46, "#d85034"); // ridge dormer
    R(g, 60, 12, 8, 8, "#78b8f0");
    // Walls.
    R(g, 6, 54, 116, 46, C.outline);
    R(g, 7, 55, 114, 44, "#f4ecd8");
    for (let y = 58; y < 98; y += 5) R(g, 7, y, 114, 1, "#e0d4b8");
    R(g, 7, 92, 114, 7, "#c89060");
    windowAt(g, 14, 62, 22, 16);
    windowAt(g, 76, 62, 22, 16);
    windowAt(g, 102, 62, 14, 16);
    // Flower boxes.
    R(g, 14, 78, 22, 3, "#a06c40");
    R(g, 16, 76, 4, 2, "#f89088");
    R(g, 26, 76, 4, 2, "#f8d048");
    door(g, 48, 80);
    R(g, 44, 78, 24, 2, C.outline);
    return c;
}

/** Carport with a flat roof: 5 x 3 tiles. */
export function makeCarport() {
    const [c, g] = canvas(80, 56);
    R(g, 2, 0, 76, 12, C.outline);
    R(g, 3, 1, 74, 10, "#8c8894");
    R(g, 3, 1, 74, 3, "#b8b4c0");
    for (const x of [4, 72]) { R(g, x, 12, 4, 42, C.outline); R(g, x + 1, 12, 2, 42, "#d8d4dc"); }
    return c;
}

/** Arcade: 8 x 7 tiles, door in column 3 (a double glass door spanning 3-4). */
export function makeArcade() {
    const W = 128, H = 120;
    const [c, g] = canvas(W, H);
    ellipse(g, 64, 116, 62, 4, "rgba(0,0,0,0.15)");
    R(g, 2, 8, 124, 108, C.outline);
    R(g, 3, 9, 122, 106, "#5a3890");
    R(g, 3, 9, 122, 10, "#3c2468");
    for (let x = 6; x < 124; x += 12) R(g, x, 12, 6, 4, "#8058b8"); // roof vents
    // Neon sign board.
    R(g, 10, 22, 108, 28, C.outline);
    R(g, 11, 23, 106, 26, "#1c1030");
    for (let x = 13; x < 116; x += 6) { R(g, x, 24, 2, 2, "#f8d048"); R(g, x + 3, 46, 2, 2, "#f8d048"); }
    text(g, "ARCADE", 65, 30, "#e02888", 16);
    text(g, "ARCADE", 64, 29, "#ff7ad0", 16);
    // Facade stripes and windows showing cabinets.
    R(g, 3, 56, 122, 3, "#e84890");
    R(g, 3, 60, 122, 2, "#48d8e8");
    for (const x of [10, 86]) {
        R(g, x, 68, 32, 26, C.outline);
        R(g, x + 1, 69, 30, 24, "#3a2060");
        for (let i = 0; i < 3; i++) {
            R(g, x + 3 + i * 10, 74, 7, 18, "#181028");
            R(g, x + 4 + i * 10, 76, 5, 4, ["#48d8e8", "#f8d048", "#e84890"][i]);
        }
        R(g, x + 1, 69, 30, 3, "rgba(255,255,255,0.25)");
    }
    // Double glass door (columns 3 and 4).
    R(g, 46, 86, 36, 30, C.outline);
    glassDoor(g, 48, 96);
    glassDoor(g, 64, 96);
    R(g, 46, 84, 36, 4, "#e84890");
    // Star posters.
    text(g, "★", 26, 100, "#f8d048", 8);
    text(g, "★", 102, 100, "#48d8e8", 8);
    return c;
}

/** Science lab: 9 x 8 tiles, door in column 4. */
export function makeLab() {
    const W = 144, H = 136;
    const [c, g] = canvas(W, H);
    ellipse(g, 72, 132, 70, 4, "rgba(0,0,0,0.15)");
    // Observatory dome.
    ellipse(g, 104, 20, 20, 18, C.outline);
    ellipse(g, 104, 20, 19, 17, "#d8e0e8");
    R(g, 101, 4, 6, 18, "#58687c");
    ellipse(g, 98, 12, 5, 4, "#f8f8f8");
    // Roof and parapet.
    R(g, 2, 24, 140, 20, C.outline);
    R(g, 3, 25, 138, 18, "#48a8a0");
    R(g, 3, 25, 138, 3, "#78d0c4");
    for (let x = 8; x < 140; x += 10) R(g, x, 32, 5, 5, "#389088");
    // Satellite dish.
    ellipse(g, 26, 18, 9, 7, C.outline);
    ellipse(g, 26, 18, 8, 6, "#f0f0f0");
    R(g, 25, 18, 2, 8, "#8c8894");
    // Walls.
    R(g, 4, 44, 136, 88, C.outline);
    R(g, 5, 45, 134, 86, "#f4f6f8");
    R(g, 5, 45, 134, 4, "#dde4ea");
    R(g, 5, 120, 134, 11, "#c8d4dc");
    // Sign.
    R(g, 30, 52, 84, 18, C.outline);
    R(g, 31, 53, 82, 16, "#1c6c8c");
    text(g, "SCIENCE LAB", 72, 57, "#f8f8f8", 8);
    // Beaker logo.
    R(g, 118, 54, 10, 3, C.outline);
    R(g, 120, 56, 6, 10, C.outline);
    R(g, 121, 60, 4, 5, "#68e0a0");
    // Windows.
    for (const x of [12, 36, 90, 114]) windowAt(g, x, 78, 20, 20);
    // Sliding glass door in column 4.
    R(g, 60, 98, 24, 34, C.outline);
    glassDoor(g, 64, 112);
    R(g, 60, 98, 24, 12, "#48a8a0");
    text(g, "LAB", 72, 101, "#f8f8f8", 8);
    return c;
}

/** Glass tech tower: 9 x 12 tiles, door in column 4. */
export function makeTower() {
    const W = 144, H = 200;
    const [c, g] = canvas(W, H);
    ellipse(g, 72, 196, 70, 4, "rgba(0,0,0,0.15)");
    // Antenna and crown.
    R(g, 71, 0, 3, 18, "#58687c");
    R(g, 69, 0, 7, 3, "#e84040");
    R(g, 40, 16, 64, 12, C.outline);
    R(g, 41, 17, 62, 10, "#3c5c7c");
    text(g, "TECH", 72, 18, "#8ff0ff", 8);
    // Stepped glass body.
    const body = (x, y, w, h) => {
        R(g, x, y, w, h, C.outline);
        R(g, x + 1, y + 1, w - 2, h - 2, "#4aa0c8");
        for (let yy = y + 3; yy < y + h - 3; yy += 9) {
            for (let xx = x + 3; xx < x + w - 5; xx += 9) {
                R(g, xx, yy, 7, 7, "#78d0f0");
                R(g, xx, yy, 7, 2, "#b8ecff");
                if ((xx + yy) % 5 === 0) R(g, xx + 1, yy + 3, 5, 3, "#f8f0a0"); // lit office
            }
        }
        // Diagonal reflection.
        g.fillStyle = "rgba(255,255,255,0.18)";
        for (let i = 0; i < h; i += 2) g.fillRect(x + 4 + i * 0.6, y + i, 6, 2);
    };
    body(28, 28, 88, 60);
    body(12, 84, 120, 112);
    // Entrance canopy and doors.
    R(g, 44, 160, 56, 8, C.outline);
    R(g, 45, 161, 54, 6, "#2c4460");
    R(g, 52, 168, 40, 28, C.outline);
    R(g, 53, 169, 38, 27, "#1c3048");
    glassDoor(g, 64, 176);
    // Planters by the door.
    R(g, 16, 184, 20, 12, C.outline);
    R(g, 17, 185, 18, 10, "#586878");
    ellipse(g, 26, 182, 8, 5, C.tree);
    R(g, 108, 184, 20, 12, C.outline);
    R(g, 109, 185, 18, 10, "#586878");
    ellipse(g, 118, 182, 8, 5, C.tree);
    return c;
}

/** Decorative downtown buildings (not enterable). */
export function makeShop(kind) {
    const W = 96, H = 88;
    const [c, g] = canvas(W, H);
    ellipse(g, 48, 84, 46, 4, "rgba(0,0,0,0.15)");
    const palettes = {
        cafe: ["#e8a048", "#b87028", "COFFEE", "#f4ecd8"],
        books: ["#6878c8", "#4858a0", "BOOKS", "#e8ecf8"],
        apt: ["#8c8894", "#6c6874", "", "#d8d4dc"],
    };
    const [roofC, roofD, label, wall] = palettes[kind];
    R(g, 2, 6, 92, 24, C.outline);
    R(g, 3, 7, 90, 22, roofC);
    R(g, 3, 7, 90, 3, "rgba(255,255,255,0.3)");
    R(g, 3, 26, 90, 3, roofD);
    if (kind === "apt") for (const x of [12, 44, 70]) { R(g, x, 12, 12, 8, "#c8c4cc"); R(g, x + 2, 14, 8, 1, "#8c8894"); }
    R(g, 4, 30, 88, 54, C.outline);
    R(g, 5, 31, 86, 52, wall);
    if (kind === "apt") {
        for (const y of [36, 56]) for (const x of [10, 30, 58, 76]) windowAt(g, x, y, 12, 12);
    } else {
        // Striped awning.
        for (let i = 0; i < 11; i++) R(g, 6 + i * 8, 36, 8, 8, i % 2 ? roofC : "#f8f8f8");
        R(g, 6, 44, 84, 2, roofD);
        R(g, 20, 50, 56, 12, C.outline);
        R(g, 21, 51, 54, 10, roofD);
        text(g, label, 48, 53, "#f8f8f8", 6);
        windowAt(g, 8, 66, 14, 12);
        windowAt(g, 74, 66, 14, 12);
    }
    door(g, 40, 64, kind === "apt" ? "#6c6874" : "#9a5a30");
    return c;
}

// ---------------------------------------------------------------- Interior furniture

export function makeFurniture(kind) {
    const make = (w, h, fn) => { const [c, g] = canvas(w, h); fn(g); return c; };
    switch (kind) {
        case "bed": return make(16, 32, (g) => {
            R(g, 0, 0, 16, 32, C.outline); R(g, 1, 1, 14, 30, "#a06c40");
            R(g, 2, 2, 12, 8, C.white); R(g, 2, 10, 12, 20, "#e85858"); R(g, 2, 10, 12, 3, "#f89088");
        });
        case "pc": return make(32, 32, (g) => {
            R(g, 0, 14, 32, 18, C.outline); R(g, 1, 15, 30, 16, C.wood); R(g, 1, 15, 30, 3, C.woodLight);
            R(g, 6, 0, 20, 16, C.outline); R(g, 7, 1, 18, 12, "#3c4c6c"); R(g, 8, 2, 16, 10, "#78d0f0");
            R(g, 9, 4, 10, 1, C.white); R(g, 9, 6, 12, 1, C.white); R(g, 9, 8, 8, 1, C.white);
            R(g, 14, 13, 4, 3, "#8c8894");
        });
        case "shelf": return make(32, 32, (g) => {
            R(g, 0, 0, 32, 32, C.outline); R(g, 1, 1, 30, 30, C.woodDark);
            for (const y of [3, 13, 23]) {
                R(g, 2, y + 7, 28, 2, C.wood);
                for (let i = 0; i < 6; i++) R(g, 3 + i * 4 + (y % 3), y, 3, 7, ["#e85858", "#48a8e8", "#f8d048", "#68c070", "#a870d8", "#f0a060"][(i + y) % 6]);
            }
        });
        case "trophies": return make(32, 32, (g) => {
            R(g, 0, 0, 32, 32, C.outline); R(g, 1, 1, 30, 30, "#6a4028");
            R(g, 2, 2, 28, 28, "#c8e8f8");
            for (const y of [13, 27]) R(g, 2, y, 28, 2, C.wood);
            for (const [x, y] of [[5, 5], [14, 4], [23, 5], [6, 19], [15, 19], [23, 18]]) {
                R(g, x, y, 5, 4, "#f8c830"); R(g, x + 1, y + 4, 3, 2, "#d8a018"); R(g, x, y + 6, 5, 2, "#8c6030");
            }
        });
        case "tv": return make(32, 24, (g) => {
            R(g, 0, 16, 32, 8, C.outline); R(g, 1, 17, 30, 6, C.woodDark);
            R(g, 4, 0, 24, 18, C.outline); R(g, 5, 1, 22, 14, "#48c0e0"); R(g, 7, 3, 6, 4, "#f8f8f8");
        });
        case "table": return make(32, 24, (g) => {
            R(g, 0, 4, 32, 14, C.outline); R(g, 1, 5, 30, 12, C.wood); R(g, 1, 5, 30, 3, C.woodLight);
            R(g, 3, 18, 3, 6, C.outline); R(g, 26, 18, 3, 6, C.outline);
            R(g, 12, 0, 8, 6, "#f8f8f8"); R(g, 13, 2, 6, 3, "#e87848");
        });
        case "plant": return make(16, 24, (g) => {
            R(g, 3, 14, 10, 10, C.outline); R(g, 4, 15, 8, 8, "#c86840");
            ellipse(g, 8, 9, 7, 8, C.outline); ellipse(g, 8, 9, 6, 7, C.tree); ellipse(g, 6, 6, 2, 3, C.treeLight);
        });
        case "photo": return make(16, 16, (g) => {
            R(g, 1, 1, 14, 14, C.outline); R(g, 2, 2, 12, 12, "#d8a018");
            R(g, 4, 4, 8, 8, "#78b8f0"); ellipse(g, 8, 7, 2, 2, "#3a2c28"); R(g, 6, 9, 4, 3, "#3c6cd8");
        });
        case "window": return make(32, 24, (g) => windowAt(g, 2, 2, 28, 20));
        case "cabinet": case "cabinet1": case "cabinet2": case "cabinet3": case "cabinet4": return make(16, 32, (g) => {
            const n = Number(kind.slice(7) || 0);
            const [top, scr, body] = [["#e84890", "#48d8e8", "#2c2c48"], ["#f8c830", "#78e078", "#3c2c20"], ["#48a8e8", "#1c2c68", "#202c48"], ["#f8f8f8", "#101010", "#484848"], ["#68c070", "#e8d898", "#284830"]][n];
            R(g, 0, 0, 16, 32, C.outline); R(g, 1, 1, 14, 30, body);
            R(g, 1, 1, 14, 5, top);
            R(g, 3, 7, 10, 9, C.black);
            R(g, 4, 8, 8, 7, scr);
            R(g, 5, 9, 3, 1, "rgba(255,255,255,0.6)");
            R(g, 1, 18, 14, 4, "#484868"); R(g, 4, 19, 2, 2, "#e84040"); R(g, 9, 19, 2, 2, "#48d8e8");
            R(g, 3, 24, 10, 6, "#1c1c30");
        });
        case "counter": return make(48, 24, (g) => {
            R(g, 0, 4, 48, 20, C.outline); R(g, 1, 5, 46, 18, "#f0f0f0"); R(g, 1, 5, 46, 4, "#d0d8e0");
            R(g, 1, 16, 46, 2, "#48a8a0");
        });
        case "bench": return make(32, 24, (g) => {
            R(g, 0, 6, 32, 18, C.outline); R(g, 1, 7, 30, 16, "#e8ecf0"); R(g, 1, 7, 30, 4, "#c8d4dc");
            R(g, 4, 0, 4, 8, C.outline); R(g, 5, 2, 2, 6, "#68e0a0");
            R(g, 12, 2, 6, 6, C.outline); R(g, 13, 4, 4, 3, "#f89088");
            R(g, 22, 0, 3, 8, C.outline); R(g, 23, 2, 1, 6, "#78b8f0");
        });
        case "board": return make(32, 24, (g) => {
            R(g, 0, 0, 32, 20, C.outline); R(g, 1, 1, 30, 18, C.white);
            for (let i = 0; i < 5; i++) R(g, 4 + i * 5, 16 - [4, 8, 6, 11, 9][i], 3, [4, 8, 6, 11, 9][i], ["#48a8e8", "#e85858", "#68c070", "#f8c830", "#a870d8"][i]);
            R(g, 3, 16, 26, 1, C.outline);
        });
        case "screen": return make(32, 24, (g) => {
            R(g, 0, 0, 32, 20, C.outline); R(g, 1, 1, 30, 18, "#1c3048"); R(g, 2, 2, 28, 16, "#48c0e0");
            R(g, 4, 4, 10, 2, C.white); R(g, 4, 8, 16, 2, "#b8ecff"); R(g, 4, 12, 12, 2, "#b8ecff");
            R(g, 14, 20, 4, 4, "#58687c");
        });
        case "glass": return make(16, 32, (g) => {
            R(g, 0, 0, 16, 32, "#9cd8f0"); R(g, 0, 0, 16, 1, C.outline); R(g, 0, 31, 16, 1, "#58687c");
            R(g, 2, 3, 2, 26, "#d8f4ff"); R(g, 15, 0, 1, 32, "#58687c");
        });
        case "desk": return make(48, 24, (g) => {
            R(g, 0, 6, 48, 18, C.outline); R(g, 1, 7, 46, 16, "#2c4460"); R(g, 1, 7, 46, 4, "#48688c");
            R(g, 18, 0, 12, 8, C.outline); R(g, 19, 1, 10, 6, "#78d0f0");
        });
        case "sofa": return make(32, 16, (g) => {
            R(g, 0, 0, 32, 16, C.outline); R(g, 1, 1, 30, 14, "#6878c8"); R(g, 1, 1, 30, 5, "#8898e0");
        });
        case "prize": return make(32, 24, (g) => {
            R(g, 0, 0, 32, 24, C.outline); R(g, 1, 1, 30, 22, "#c8e8f8");
            ellipse(g, 8, 9, 4, 4, "#f8c830"); ellipse(g, 20, 8, 4, 5, "#e85858"); R(g, 24, 12, 5, 6, "#68c070");
            R(g, 1, 17, 30, 6, "#e84890");
        });
    }
    throw new Error(`Unknown furniture ${kind}`);
}
