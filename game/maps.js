import * as A from "./art.js";
import { T } from "./art.js";

// A map is a grid of ground codes plus props. Props have a footprint in tiles
// (blocking by default) and a sprite drawn with its bottom on the footprint's bottom.
class MapBuilder {
    constructor(id, w, h, fill, opts = {}) {
        Object.assign(this, { id, w, h, outdoor: false, wall: null }, opts);
        this.ground = Array.from({ length: h }, () => Array(w).fill(fill));
        this.solid = new Uint8Array(w * h);
        this.props = [];
        this.handlers = new Map();
        this.warps = new Map();
        this.npcs = [];
    }
    key(x, y) { return y * this.w + x; }
    inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    rect(x, y, w, h, code) {
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.inBounds(i, j)) this.ground[j][i] = code;
    }
    block(x, y, w = 1, h = 1, v = 1) {
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.inBounds(i, j)) this.solid[this.key(i, j)] = v;
    }
    place(img, x, y, fw = 1, fh = 1, { solid = true, dx = 0, dy = 0, above = false } = {}) {
        this.props.push({ img, px: x * T + (fw * T - img.width) / 2 + dx, py: (y + fh) * T - img.height + dy, sortY: (y + fh) * T, above });
        if (solid) this.block(x, y, fw, fh);
    }
    on(x, y, fn, w = 1, h = 1) {
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.handlers.set(this.key(i, j), fn);
    }
    warp(x, y, to) {
        this.warps.set(this.key(x, y), to);
        this.block(x, y, 1, 1, 0);
    }
}

const trees = (m, x0, y0, x1, y1, skip = () => false) => {
    const tree = A.makeTree();
    for (let y = y0; y <= y1 - 1; y += 2) for (let x = x0; x <= x1 - 1; x += 2) if (!skip(x, y)) m.place(tree, x, y, 2, 2);
};

/** Builds every map. `S` is the script library from main.js (dialog, panels…). */
export function buildMaps(S) {
    const maps = {};
    const tree = A.makeTree();
    const lamp = A.makeLamp();
    const sign = A.makeSign();

    // ------------------------------------------------------------ Overworld
    const m = new MapBuilder("world", 96, 40, "g", { outdoor: true, name: "Hometown" });
    maps.world = m;

    // Road from home to downtown, with a dashed centre line.
    m.rect(4, 16, 66, 1, "l");
    m.rect(4, 17, 66, 1, "r");

    // Forest border.
    trees(m, 0, 0, 80, 4);
    trees(m, 92, 0, 96, 4);
    trees(m, 0, 36, 96, 40);
    trees(m, 0, 4, 4, 36, (x, y) => y === 16);
    trees(m, 92, 4, 96, 36);
    m.block(0, 16, 4, 2); // road ends at the woods

    // --- Home
    m.rect(11, 13, 2, 3, "p");
    m.rect(18, 9, 5, 7, "r");
    m.rect(6, 21, 9, 3, "f");
    m.rect(6, 27, 7, 6, "G");
    m.rect(20, 22, 8, 7, "w");
    m.block(20, 22, 8, 7);
    m.rect(4, 5, 3, 3, "f");

    const house = A.makeHouse();
    m.place(house, 8, 7, 8, 6);
    m.warp(11, 12, { map: "house", x: 5, y: 7, dir: "up" });
    m.place(A.makeCarport(), 18, 9, 5, 3, { solid: false });
    m.block(18, 9, 1, 3);
    m.block(22, 9, 1, 3);

    const mailbox = A.makeMailbox();
    m.place(mailbox, 14, 13);
    m.on(14, 13, S.mailbox);
    m.place(sign, 8, 13);
    m.on(8, 13, S.addressSign);

    const fence = A.makeFence();
    for (let x = 6; x < 15; x++) m.place(fence, x, 20);
    m.place(sign, 15, 21);
    m.on(15, 21, () => S.say("JOSE's garden. The tomatoes are coming along nicely."));
    for (const [x, y] of [[26, 5], [5, 24], [14, 30], [16, 33], [28, 30], [24, 32], [8, 33]]) m.place(tree, x, y, 2, 2);
    const bush = A.makeBush();
    for (const [x, y] of [[17, 13], [16, 12], [23, 13], [24, 12], [7, 12], [4, 13]]) m.place(bush, x, y);

    m.npcs.push({ id: "neighbor", x: 16, y: 24, dir: "left", look: { h: "#b0b0b0", b: "#68a048", B: "#487830" }, wander: true,
        talk: () => S.say("Morning! You're JOSE's visitor? He built this whole town. The ARCADE downtown has his games, and you can actually play them!") });

    // --- Route
    m.rect(44, 4, 3, 32, "w");
    m.block(44, 4, 3, 32);
    m.rect(44, 16, 3, 2, "d");
    m.block(44, 16, 3, 2, 0);
    trees(m, 32, 4, 44, 14, (x, y) => (x + y) % 6 === 0);
    trees(m, 32, 20, 44, 36, (x, y) => (x * 3 + y) % 7 === 0);
    trees(m, 48, 4, 58, 14, (x, y) => (x + y) % 5 === 0);
    trees(m, 48, 20, 58, 36, (x, y) => (x + y * 2) % 6 === 0);
    m.rect(32, 18, 12, 2, "G");
    m.place(sign, 34, 15);
    m.on(34, 15, () => S.say("ROUTE 1\n← JOSE's HOUSE    DOWNTOWN →"));
    m.npcs.push({ id: "biker", x: 52, y: 18, dir: "up", look: { h: "#e8c048", b: "#e85858", B: "#b83838" },
        talk: () => S.say("Walking to town? JOSE keeps a car and a bike in his driveway. Hop on one, it's way faster!") });

    // --- Downtown
    m.rect(59, 4, 33, 22, "b");
    m.rect(59, 16, 11, 1, "l");
    m.rect(59, 17, 11, 1, "r");
    m.rect(59, 13, 33, 1, "c");
    m.rect(59, 19, 33, 1, "c");
    m.rect(59, 25, 33, 1, "c");
    m.rect(59, 26, 33, 10, "g");
    m.rect(72, 26, 5, 10, "b");
    m.rect(66, 30, 17, 1, "b");

    const arcade = A.makeArcade();
    m.place(arcade, 61, 6, 8, 7);
    m.warp(64, 12, { map: "arcade", x: 6, y: 8, dir: "up" });
    m.warp(65, 12, { map: "arcade", x: 7, y: 8, dir: "up" });
    m.place(sign, 62, 14);
    m.on(62, 14, () => S.say("JOSE's ARCADE\nEvery cabinet is a game JOSE made. Step inside and play!"));

    const lab = A.makeLab();
    m.place(lab, 71, 5, 9, 8);
    m.warp(75, 12, { map: "lab", x: 6, y: 8, dir: "up" });
    m.place(sign, 73, 14);
    m.on(73, 14, () => S.say("SCIENCE LAB\nData science and analytics research by JOSE."));

    const tower = A.makeTower();
    m.place(tower, 82, 1, 9, 12);
    m.warp(86, 12, { map: "tower", x: 6, y: 8, dir: "up" });
    m.place(sign, 84, 14);
    m.on(84, 14, () => S.say("TECH TOWER\nHome of JOSE's apps and experiments."));

    for (const x of [60, 70, 81, 90]) { m.place(lamp, x, 14); m.place(lamp, x, 19); }

    const closed = () => S.say("The door is locked. A sign says: \"Opening soon!\"");
    m.place(A.makeShop("cafe"), 61, 20, 6, 5);
    m.on(64, 24, closed);
    m.place(A.makeShop("books"), 78, 20, 6, 5);
    m.on(81, 24, closed);
    m.place(A.makeShop("apt"), 85, 20, 6, 5);
    m.on(88, 24, closed);

    m.place(A.makeFountain(), 73, 27, 3, 3);
    const bench = A.makeBench();
    m.place(bench, 68, 31, 2, 1);
    m.place(bench, 79, 31, 2, 1);
    const planter = A.makePlanter();
    for (const [x, y] of [[71, 26], [77, 26], [71, 33], [77, 33]]) m.place(planter, x, y);
    for (const [x, y] of [[60, 27], [62, 32], [86, 27], [88, 32], [64, 34], [83, 34]]) m.place(tree, x, y, 2, 2);
    m.rect(66, 32, 4, 2, "f");
    m.rect(80, 32, 4, 2, "f");

    m.npcs.push({ id: "fan", x: 67, y: 18, dir: "down", wander: true, look: { h: "#6a3c20", b: "#a870d8", B: "#7850a8" },
        talk: () => S.say("The glass TECH TOWER has JOSE's apps, and the SCIENCE LAB has his dashboards. I'm just here for the ARCADE.") });
    m.npcs.push({ id: "jogger", x: 83, y: 28, dir: "left", wander: true, look: { h: "#282020", b: "#f0a040", B: "#c07820" },
        talk: () => S.say("Want to send JOSE a message? Use the red mailbox in front of his house.") });

    // ------------------------------------------------------------ House interior
    const h = new MapBuilder("house", 12, 9, "F", { wall: "#f0dcc0", wallTrim: "#c89060", name: "JOSE's house", exitTo: { map: "world", x: 11, y: 13 } });
    maps.house = h;
    interiorWalls(h);
    h.rect(5, 8, 2, 1, "m");
    h.warp(5, 8, { exit: true });
    h.warp(6, 8, { exit: true });
    h.place(A.makeFurniture("pc"), 1, 2, 2, 1);
    h.on(1, 2, S.resume, 2, 1);
    h.place(A.makeFurniture("window"), 3, 1, 2, 1, { solid: false, dy: -4 });
    h.place(A.makeFurniture("trophies"), 5, 2, 2, 1);
    h.on(5, 2, S.achievements, 2, 1);
    h.place(A.makeFurniture("shelf"), 7, 2, 2, 1);
    h.on(7, 2, S.skills, 2, 1);
    h.place(A.makeFurniture("photo"), 10, 1, 1, 1, { dy: -4 });
    h.on(10, 1, S.about);
    h.place(A.makeFurniture("bed"), 10, 3, 1, 2);
    h.on(10, 3, () => S.say("JOSE's bed. No time for a nap, there are projects to see!"), 1, 2);
    h.place(A.makeFurniture("table"), 4, 5, 2, 1);
    h.on(4, 5, () => S.say("A plate of fresh fruit. Healthy!"), 2, 1);
    h.place(A.makeFurniture("tv"), 1, 5, 2, 1);
    h.on(1, 5, () => S.say("The TV is showing a speedrun of a classic handheld game."), 2, 1);
    h.place(A.makeFurniture("plant"), 1, 7);
    h.place(A.makeFurniture("plant"), 10, 7);

    // ------------------------------------------------------------ Arcade interior
    const a = new MapBuilder("arcade", 14, 10, "k", { wall: "#3c2468", wallTrim: "#e84890", name: "ARCADE", exitTo: { map: "world", x: 64, y: 13 } });
    maps.arcade = a;
    interiorWalls(a);
    a.rect(6, 9, 2, 1, "m");
    a.warp(6, 9, { exit: true });
    a.warp(7, 9, { exit: true });
    ["pirate", "flappy", "spaceduel", "pong", "rpg"].forEach((id, i) => {
        const x = 2 + i * 2;
        a.place(A.makeFurniture(i ? `cabinet${i}` : "cabinet"), x, 2);
        a.on(x, 2, () => S.cabinet(id));
    });
    a.place(A.makeFurniture("prize"), 11, 5, 2, 1);
    a.on(11, 5, () => S.say("PRIZE COUNTER\nTop prize: a job offer for JOSE. (He's hoping!)"), 2, 1);
    a.place(A.makeFurniture("sofa"), 1, 7, 2, 1);
    a.npcs.push({ id: "attendant", x: 12, y: 7, dir: "left", look: { h: "#f8d048", b: "#e84890", B: "#b82868" },
        talk: () => S.say("Welcome to JOSE's ARCADE! Every cabinet runs one of his games right here in your browser. Walk up to one and press A.") });

    // ------------------------------------------------------------ Lab interior
    const l = new MapBuilder("lab", 14, 10, "t", { wall: "#dde8ee", wallTrim: "#48a8a0", name: "SCIENCE LAB", exitTo: { map: "world", x: 75, y: 13 } });
    maps.lab = l;
    interiorWalls(l);
    l.rect(6, 9, 2, 1, "m");
    l.warp(6, 9, { exit: true });
    l.warp(7, 9, { exit: true });
    l.place(A.makeFurniture("board"), 2, 2, 2, 1);
    l.on(2, 2, () => S.project("lab", "covid"), 2, 1);
    l.place(A.makeFurniture("pc"), 6, 2, 2, 1);
    l.on(6, 2, () => S.project("lab", "movies"), 2, 1);
    l.place(A.makeFurniture("screen"), 10, 2, 2, 1);
    l.on(10, 2, () => S.project("lab", "heatmap"), 2, 1);
    l.place(A.makeFurniture("desk"), 5, 6, 3, 1);
    l.on(5, 6, () => S.project("lab", "tableau"), 3, 1);
    l.place(A.makeFurniture("bench"), 1, 5, 2, 1);
    l.on(1, 5, () => S.say("Beakers are bubbling away. Something about data cleaning?"), 2, 1);
    l.place(A.makeFurniture("bench"), 11, 5, 2, 1);
    l.on(11, 5, () => S.say("A microscope and a stack of lab notebooks from JOSE's biology days."), 2, 1);
    l.npcs.push({ id: "scientist", x: 9, y: 4, dir: "down", look: { h: "#c8c8c8", H: "#e8e8e8", b: "#f4f4f4", B: "#c8d0d8", w: "#48a8a0" },
        talk: () => S.say("Ah, a visitor! This lab holds JOSE's data projects: Tableau dashboards, Python notebooks and D3 maps. Check each station to open one.") });

    // ------------------------------------------------------------ Tower interior
    const t = new MapBuilder("tower", 14, 10, "q", { wall: "#9cd8f0", wallTrim: "#58687c", glass: true, name: "TECH TOWER", exitTo: { map: "world", x: 86, y: 13 } });
    maps.tower = t;
    interiorWalls(t);
    t.rect(6, 9, 2, 1, "m");
    t.warp(6, 9, { exit: true });
    t.warp(7, 9, { exit: true });
    const scr = A.makeFurniture("screen");
    [["studyclock", 1], ["calculator", 4], ["codepen", 8], ["github", 11]].forEach(([id, x]) => {
        t.place(scr, x, 2, 2, 1);
        t.on(x, 2, () => S.project("tower", id), 2, 1);
    });
    t.place(A.makeFurniture("desk"), 5, 5, 3, 1);
    t.on(5, 5, () => S.say("Welcome to the TECH TOWER. Each screen upstairs, er, over there, shows one of JOSE's apps."), 3, 1);
    t.place(A.makeFurniture("sofa"), 1, 7, 2, 1);
    t.place(A.makeFurniture("plant"), 12, 7);
    t.place(A.makeFurniture("plant"), 1, 5);
    t.npcs.push({ id: "reception", x: 6, y: 4, dir: "down", look: { h: "#282020", b: "#2c4460", B: "#1c3048" },
        talk: () => S.say("Welcome to the TECH TOWER. Each screen shows one of JOSE's apps. Walk up to one and press A to open it.") });

    return maps;
}

function interiorWalls(m) {
    m.rect(0, 0, m.w, 2, "W");
    m.block(0, 0, m.w, 2);
    // Side walls one tile wide are implied by the map edge.
}
