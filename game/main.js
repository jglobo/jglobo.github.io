import { T, C, makeCharacter, makeCar, makeBike, upperBody, drawGroundTile, drawWaterSparkle } from "./art.js";
import { buildMaps } from "./maps.js";
import * as UI from "./ui.js";
import { esc } from "./ui.js";
import * as K from "./content.js";

const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const SPEED = { walk: 4.5, run: 8, bike: 9, car: 12 };
const DOWNTOWN = { x: 73, y: 16 };
const HOME = { x: 11, y: 14 };

// ------------------------------------------------------------ Scripts the maps call

const S = {
    say: (t, o) => UI.say(t, o),

    async addressSign() {
        await UI.say(`${K.PLAYER_NAME}'s HOUSE\n${K.HOME_ADDRESS.street}\n${K.HOME_ADDRESS.city}`);
    },

    async mailbox() {
        await UI.say(`${K.PLAYER_NAME}'s mailbox. ${K.HOME_ADDRESS.street}.`);
        await UI.say("Write JOSE a letter? It goes straight to his email.");
        if ((await UI.choose(["YES", "NO"])) === 0) await contactForm();
    },

    async resume() {
        await UI.say("JOSE's PC. His résumé is open on the screen.");
        await resumePanel();
    },

    async achievements() {
        await UI.say("A shelf full of trophies and certificates!");
        await achievementsPanel();
    },

    async skills() {
        await UI.say("Books on Python, SQL, JavaScript, C++ and data visualization. Well-read and well-used.");
    },

    async about() {
        await UI.say(`A framed photo of JOSE. "${K.RESUME.summary}"`, { pic: "images/portphoto2.jpg" });
    },

    async cabinet(id) {
        const game = K.GAMES.find((g) => g.id === id);
        await UI.say(`It's ${game.title.toUpperCase()}!\n${game.about}`, { pic: game.image });
        const opts = game.module ? ["PLAY", "CANCEL"] : ["ASK FOR DEMO", "CANCEL"];
        const pick = await UI.choose(opts);
        if (pick !== 0) return;
        if (game.module) await UI.playGame(game, new URL(game.module, import.meta.url).href);
        else await contactForm(`Hi Jose, I'd love to try your ${game.title} demo.`);
    },

    async project(kind, id) {
        const list = kind === "lab" ? K.LAB_PROJECTS : K.TOWER_APPS;
        const p = list.find((x) => x.id === id);
        await UI.say(`${p.title.toUpperCase()}\nBuilt with ${p.tool}.`, { pic: p.image });
        await UI.say(`Open ${p.title} in a new tab?`, { pic: p.image });
        if ((await UI.choose(["OPEN", "CANCEL"])) === 0) openLink(p.url);
    },
};

function openLink(url) {
    // "noopener" makes window.open return null, so detach the opener by hand instead.
    const w = window.open(url, "_blank");
    if (w) w.opener = null;
    else {
        // Popup blocked (or a sandboxed preview): offer a real link instead.
        UI.panel(`<p>Open the project here:</p><p><a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener">Open ↗</a></p>`, { title: "Open link" });
    }
}

// ------------------------------------------------------------ Panels

function resumePanel() {
    const r = K.RESUME;
    return UI.panel(`
        <p>${esc(r.summary)}</p>
        <h3>Experience</h3>
        <ul class="list">${r.experience.map((e) => `<li><strong>${esc(e.role)}</strong><span>${esc(e.org)} · ${esc(e.when)}</span>${e.detail ? `<small>${esc(e.detail)}</small>` : ""}</li>`).join("")}</ul>
        <h3>Skills</h3>
        <dl class="skills">${r.skills.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
        <h3>Education</h3>
        <ul class="list">${r.education.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
        <p class="actions"><a class="btn primary" href="${K.LINKS.resumePdf}" download>Download résumé (PDF)</a>
        <a class="btn" href="${K.LINKS.linkedin}" target="_blank" rel="noopener">LinkedIn ↗</a></p>`,
        { title: "Résumé", wide: true });
}

function achievementsPanel() {
    return UI.panel(`
        <ul class="trophies">${K.ACHIEVEMENTS.map((a) => `<li><span class="cup" aria-hidden="true"></span><div><strong>${esc(a.title)}</strong><span>${esc(a.from)} · ${esc(a.when)}</span></div></li>`).join("")}</ul>
        <p class="actions"><a class="btn" href="${K.LINKS.freecodecamp}" target="_blank" rel="noopener">freeCodeCamp profile ↗</a></p>`,
        { title: "Achievements", wide: true });
}

function contactForm(prefill = "") {
    return UI.panel(`
        <form class="letter" id="letter">
            <label for="f-name">Your name</label>
            <input id="f-name" name="name" required autocomplete="name">
            <label for="f-email">Your email</label>
            <input id="f-email" name="email" type="email" required autocomplete="email">
            <label for="f-msg">Message</label>
            <textarea id="f-msg" name="message" rows="5" required>${esc(prefill)}</textarea>
            <p class="actions"><button class="btn primary" type="submit">Send letter ✉</button></p>
            <p class="status" role="status"></p>
            <p class="fine">Or email <span class="select">${esc(K.CONTACT_EMAIL)}</span> directly.</p>
        </form>`, {
        title: "Write to JOSE",
        setup(el) {
            const form = el.querySelector("form");
            const status = el.querySelector(".status");
            form.addEventListener("submit", async (e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(form));
                status.textContent = "Sending…";
                try {
                    const res = await fetch(K.CONTACT_ENDPOINT, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Accept: "application/json" },
                        body: JSON.stringify({ ...data, _subject: "New letter from your portfolio mailbox" }),
                    });
                    if (!res.ok) throw new Error(res.status);
                    form.reset();
                    status.textContent = "Letter sent! JOSE will write back soon.";
                } catch {
                    status.textContent = `That didn't go through. Please email ${K.CONTACT_EMAIL} instead.`;
                }
            });
            el.querySelector("#f-name").focus();
        },
    });
}

function projectsPanel() {
    const row = (title, sub, action, label) => `<li><div><strong>${esc(title)}</strong><span>${esc(sub)}</span></div>${action}</li>`;
    const link = (url) => `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Open ↗</a>`;
    return UI.panel(`
        <h3>Arcade</h3>
        <ul class="rows">${K.GAMES.map((g) => row(g.title, g.module ? "Playable in your browser" : "Demo on request",
            g.module ? `<button class="btn" data-play="${g.id}">Play</button>` : `<button class="btn" data-mail="${g.id}">Ask</button>`)).join("")}</ul>
        <h3>Science lab</h3>
        <ul class="rows">${K.LAB_PROJECTS.map((p) => row(p.title, p.tool, link(p.url))).join("")}</ul>
        <h3>Tech tower</h3>
        <ul class="rows">${K.TOWER_APPS.map((p) => row(p.title, p.tool, link(p.url))).join("")}</ul>
        <h3>About JOSE</h3>
        <ul class="rows">
            ${row("Résumé", "Experience, skills and education", `<button class="btn" data-open="resume">View</button>`)}
            ${row("Achievements", `${K.ACHIEVEMENTS.length} trophies`, `<button class="btn" data-open="achievements">View</button>`)}
            ${row("Contact", "Send JOSE a letter", `<button class="btn" data-open="contact">Write</button>`)}
        </ul>`, {
        title: "All projects", wide: true,
        setup(el, close) {
            el.addEventListener("click", async (e) => {
                const b = e.target.closest("button");
                if (!b) return;
                close();
                if (b.dataset.play) { const g = K.GAMES.find((x) => x.id === b.dataset.play); await UI.playGame(g, new URL(g.module, import.meta.url).href); }
                if (b.dataset.mail) await contactForm("Hi Jose, I'd love to try your RPG demo.");
                if (b.dataset.open === "resume") await resumePanel();
                if (b.dataset.open === "achievements") await achievementsPanel();
                if (b.dataset.open === "contact") await contactForm();
            });
        },
    });
}

// ------------------------------------------------------------ World state

const maps = buildMaps(S);
const grounds = {};
const hero = makeCharacter();
const car = makeCar();
const bike = makeBike();
const npcLooks = new Map();
const riders = new Map();

const state = {
    map: "world",
    p: { x: HOME.x, y: HOME.y, dir: "down", moving: false, fx: 0, fy: 0, t: 0, step: 0, mount: null },
    vehicles: [
        { type: "car", x: 19, y: 12, dir: "down" },
        { type: "bike", x: 21, y: 12, dir: "down" },
    ],
    route: null, // queued steps when auto-driving
    running: false,
    started: false,
};
for (const m of Object.values(maps)) {
    for (const n of m.npcs) Object.assign(n, { home: [n.x, n.y], moving: false, t: 0, fx: n.x, fy: n.y, next: 2 + Math.random() * 3, step: 0 });
}

const map = () => maps[state.map];

function prerender(m) {
    const [c, g] = [document.createElement("canvas"), null];
    c.width = m.w * T;
    c.height = m.h * T;
    const gc = c.getContext("2d");
    const at = (x, y) => (tx, ty) => (m.inBounds(x + tx, y + ty) ? m.ground[y + ty][x + tx] : m.ground[y][x]);
    for (let y = 0; y < m.h; y++) {
        for (let x = 0; x < m.w; x++) {
            const code = m.ground[y][x];
            if (code === "W") drawWall(gc, m, x, y);
            else drawGroundTile(gc, code, x * T, y * T, x, y, at(x, y));
        }
    }
    return c;
}

function drawWall(g, m, x, y) {
    const px = x * T, py = y * T;
    if (m.glass) {
        g.fillStyle = y === 0 ? "#3c5c7c" : "#9cd8f0";
        g.fillRect(px, py, T, T);
        if (y === 1) {
            g.fillStyle = "#d8f4ff"; g.fillRect(px + 2, py + 1, 2, 12);
            g.fillStyle = "#58687c"; g.fillRect(px + 15, py, 1, T); g.fillRect(px, py + 14, T, 2);
        } else {
            g.fillStyle = "#58687c"; g.fillRect(px, py + 14, T, 2);
        }
        return;
    }
    g.fillStyle = m.wall;
    g.fillRect(px, py, T, T);
    g.fillStyle = "rgba(0,0,0,0.08)";
    if (x % 2 === 0) g.fillRect(px + 4, py, 1, T);
    if (y === 0) { g.fillStyle = m.wallTrim; g.fillRect(px, py, T, 3); }
    if (y === 1) { g.fillStyle = m.wallTrim; g.fillRect(px, py + 12, T, 4); g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(px, py + 15, T, 1); }
}

// ------------------------------------------------------------ Movement

function npcAt(x, y) {
    return map().npcs.find((n) => (n.x === x && n.y === y) || (n.moving && n.fx === x && n.fy === y));
}
function vehicleAt(x, y) {
    return state.map === "world" ? state.vehicles.find((v) => v.x === x && v.y === y) : null;
}
function walkable(x, y, m = map()) {
    return m.inBounds(x, y) && !m.solid[m.key(x, y)];
}
function passable(x, y) {
    return walkable(x, y) && !npcAt(x, y) && !vehicleAt(x, y) && !(state.p.x === x && state.p.y === y);
}

function tryMove(dir) {
    const p = state.p;
    p.dir = dir;
    const [dx, dy] = DIRS[dir];
    const nx = p.x + dx, ny = p.y + dy;
    const m = map();
    if (!walkable(nx, ny) || npcAt(nx, ny) || vehicleAt(nx, ny)) return false;
    // No driving indoors: park at the door and walk in.
    if (p.mount && m.warps.has(m.key(nx, ny))) parkVehicle(p.x, p.y, true);
    p.fx = nx; p.fy = ny; p.moving = true; p.t = 0;
    return true;
}

async function arrive() {
    const p = state.p;
    p.x = p.fx; p.y = p.fy; p.moving = false;
    p.step = (p.step + 1) % 4;
    const m = map();
    const w = m.warps.get(m.key(p.x, p.y));
    if (w) await warp(w.exit ? { ...m.exitTo, dir: "down" } : w);
}

async function warp(to) {
    state.route = null;
    await UI.fade(true);
    const leaving = state.map;
    state.map = to.map;
    const p = state.p;
    p.x = to.x; p.y = to.y; p.dir = to.dir ?? "down"; p.moving = false;
    if (state.map === "world") nudgeVehicles(p.x, p.y);
    if (leaving !== to.map) UI.banner(map().name ?? "");
    await UI.fade(false);
}

function speed() {
    const p = state.p;
    if (p.mount) return SPEED[p.mount];
    return state.running ? SPEED.run : SPEED.walk;
}

// ------------------------------------------------------------ Vehicles

function mount(v) {
    state.vehicles = state.vehicles.filter((x) => x !== v);
    const p = state.p;
    p.x = v.x; p.y = v.y; p.dir = v.dir; p.mount = v.type;
}

/** Leaves the vehicle at (x, y); if `keepPlayer`, the player simply stops riding. */
function parkVehicle(x, y, keepPlayer = false) {
    const p = state.p;
    const type = p.mount;
    state.vehicles.push({ type, x, y, dir: p.dir });
    p.mount = null;
    if (keepPlayer) return true;
    for (const d of [p.dir, "down", "left", "right", "up"]) {
        const [dx, dy] = DIRS[d];
        if (walkable(x + dx, y + dy) && !npcAt(x + dx, y + dy) && !vehicleAt(x + dx, y + dy)) {
            p.x = x + dx; p.y = y + dy;
            return true;
        }
    }
    // Nowhere to step: stay on board.
    state.vehicles.pop();
    p.mount = type;
    return false;
}

// If the player spawns on a parked vehicle (e.g. leaving a building), roll it aside.
function nudgeVehicles(x, y) {
    for (const v of state.vehicles) {
        if (v.x !== x || v.y !== y) continue;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [-2, 0], [2, 0]]) {
            if (walkable(x + dx, y + dy) && !vehicleAt(x + dx, y + dy)) { v.x += dx; v.y += dy; break; }
        }
    }
}

async function vehicleScript(v) {
    const name = v.type === "car" ? "JOSE's red car" : "JOSE's bike";
    await UI.say(`${name}. ${v.type === "car" ? "Keys are in the ignition." : "Tires are pumped."} Take it for a spin?`);
    const pick = await UI.choose([v.type === "car" ? "DRIVE TO TOWN" : "RIDE TO TOWN", v.type === "car" ? "DRIVE MYSELF" : "RIDE MYSELF", "CANCEL"]);
    if (pick === 2) return;
    mount(v);
    if (pick === 0) {
        const path = findPath(state.p.x, state.p.y, DOWNTOWN.x, DOWNTOWN.y);
        if (path) {
            state.route = path;
            UI.banner(v.type === "car" ? "Driving downtown…" : "Riding downtown…");
        }
    } else {
        UI.banner("Press A to get off");
    }
}

async function dismountScript() {
    await UI.say(`Get off the ${state.p.mount}?`);
    if ((await UI.choose(["YES", "NO"])) === 0) {
        if (!parkVehicle(state.p.x, state.p.y)) await UI.say("There's no room to get off here.");
    }
}

/** Breadth-first search over walkable tiles; returns a list of directions. */
function findPath(sx, sy, tx, ty) {
    const m = map();
    const prev = new Map([[m.key(sx, sy), null]]);
    const q = [[sx, sy]];
    while (q.length) {
        const [x, y] = q.shift();
        if (x === tx && y === ty) break;
        for (const [d, [dx, dy]] of Object.entries(DIRS)) {
            const nx = x + dx, ny = y + dy, k = m.key(nx, ny);
            if (prev.has(k) || !walkable(nx, ny) || vehicleAt(nx, ny) || m.warps.has(k)) continue;
            prev.set(k, [x, y, d]);
            q.push([nx, ny]);
        }
    }
    let k = m.key(tx, ty);
    if (!prev.has(k)) return null;
    const steps = [];
    while (prev.get(k)) {
        const [x, y, d] = prev.get(k);
        steps.unshift(d);
        k = m.key(x, y);
    }
    return steps;
}

// ------------------------------------------------------------ Interaction

async function interact() {
    const p = state.p;
    const [dx, dy] = DIRS[p.dir];
    const fx = p.x + dx, fy = p.y + dy;
    const m = map();
    const npc = npcAt(fx, fy);
    if (npc) {
        npc.dir = { up: "down", down: "up", left: "right", right: "left" }[p.dir];
        return npc.talk();
    }
    const v = vehicleAt(fx, fy);
    if (v && !p.mount) return vehicleScript(v);
    const h = m.handlers.get(m.key(fx, fy));
    if (h) return h();
    if (p.mount) return dismountScript();
}

async function menu() {
    await UI.say("MENU");
    const pick = await UI.choose(["PROJECTS", "TRAVEL", "HOW TO PLAY", "CLASSIC SITE", "CLOSE"]);
    if (pick === 0) await projectsPanel();
    if (pick === 1) {
        await UI.say("Where to?");
        const t = await UI.choose(["JOSE's HOUSE", "DOWNTOWN", "CANCEL"]);
        if (t === 0) await warp({ map: "world", ...HOME, dir: "up" });
        if (t === 1) await warp({ map: "world", ...DOWNTOWN, dir: "up" });
    }
    if (pick === 2) await howToPlay();
    if (pick === 3) location.href = "classic/";
}

async function howToPlay() {
    const touch = document.body.classList.contains("touch");
    await UI.say(touch
        ? "Use the D-pad to walk. Press A to talk, read signs and enter buildings. Hold B to run. START opens the menu."
        : "Arrow keys or WASD to walk. Z, Space or Enter to talk and read. Hold X or Shift to run. M opens the menu.");
    await UI.say("Visit the house for JOSE's résumé and trophies, then take the car or bike downtown to the ARCADE, SCIENCE LAB and TECH TOWER.");
}

// ------------------------------------------------------------ Input

const held = [];
let busyScript = false;

function run(fn) {
    if (busyScript) return;
    busyScript = true;
    Promise.resolve(fn()).catch(console.error).finally(() => { busyScript = false; });
}

function pressed(btn) {
    if (!state.started) return;
    if (UI.button(btn)) return;
    if (busyScript || state.p.moving) return;
    if (btn === "A") run(interact);
    if (btn === "START") run(menu);
    if (btn === "B" && state.route) state.route = null;
}

function holdDir(d, on) {
    const i = held.indexOf(d);
    if (i >= 0) held.splice(i, 1);
    if (on) { held.push(d); UI.dir(d); }
}

const KEYMAP = {
    ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
    KeyZ: "A", Space: "A", Enter: "A", KeyX: "B", Backspace: "B", KeyM: "START", Escape: "ESC",
};

window.addEventListener("keydown", (e) => {
    if (e.target.closest?.("input, textarea, select")) { if (e.code === "Escape") UI.button("ESC"); return; }
    const top = document.querySelector("#arcade:not([hidden])");
    if (top) { if (e.code === "Escape") UI.button("ESC"); return; } // the game owns the keys
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") state.running = true;
    const v = KEYMAP[e.code];
    if (!v) return;
    if (e.target.closest?.("a, button") && (e.code === "Enter" || e.code === "Space")) return; // let buttons click
    e.preventDefault();
    if (["up", "down", "left", "right"].includes(v)) { if (!e.repeat) holdDir(v, true); }
    else if (!e.repeat) {
        if (v === "B") state.running = true;
        if (v === "ESC") { if (!UI.button("ESC") && state.started) pressed("START"); }
        else pressed(v);
    }
});
window.addEventListener("keyup", (e) => {
    if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyX" || e.code === "Backspace") state.running = false;
    const v = KEYMAP[e.code];
    if (v && ["up", "down", "left", "right"].includes(v)) holdDir(v, false);
});
window.addEventListener("blur", () => { held.length = 0; state.running = false; });

UI.initTouch((btn) => {
    if (btn === "B") { state.running = true; setTimeout(() => (state.running = false), 600); }
    pressed(btn);
}, holdDir);

// ------------------------------------------------------------ Update

function update(dt, t) {
    const p = state.p;
    const free = !UI.isBusy() && !busyScript;

    if (p.moving) {
        p.t += dt * speed();
        if (p.t >= 1) run(arrive);
    } else if (free && state.started) {
        const d = state.route?.length ? state.route[0] : held[held.length - 1];
        if (d) {
            if (tryMove(d)) { if (state.route?.length) state.route.shift(); }
            else if (state.route) state.route = null;
            if (state.route && !state.route.length) { state.route = null; UI.banner("DOWNTOWN"); }
        }
    }

    for (const n of map().npcs) {
        if (n.moving) {
            n.t += dt * 3;
            if (n.t >= 1) { n.x = n.fx; n.y = n.fy; n.moving = false; n.step = (n.step + 1) % 4; }
            continue;
        }
        if (!n.wander || !free) continue;
        n.next -= dt;
        if (n.next > 0) continue;
        n.next = 2 + Math.random() * 4;
        const dirs = Object.keys(DIRS);
        const d = dirs[Math.floor(Math.random() * 4)];
        const [dx, dy] = DIRS[d];
        const nx = n.x + dx, ny = n.y + dy;
        n.dir = d;
        if (Math.abs(nx - n.home[0]) + Math.abs(ny - n.home[1]) <= 3 && passable(nx, ny) && !(p.moving && p.fx === nx && p.fy === ny) && !map().warps.has(map().key(nx, ny))) {
            n.fx = nx; n.fy = ny; n.moving = true; n.t = 0;
        }
    }
}

// ------------------------------------------------------------ Render

let scale = 3;
function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    const portrait = canvas.width < canvas.height;
    scale = Math.max(1, Math.floor(Math.min(canvas.width / ((portrait ? 13 : 22) * T), canvas.height / ((portrait ? 12 : 13) * T))));
    ctx.imageSmoothingEnabled = false;
}
window.addEventListener("resize", resize);

const lerp = (a, b, t) => a + (b - a) * Math.min(1, t);

function entityPos(e) {
    const t = e.moving ? Math.min(1, e.t) : 0;
    return [lerp(e.x, e.fx, e.moving ? t : 0) * T, lerp(e.y, e.fy, e.moving ? t : 0) * T];
}

function characterFrame(sheet, e) {
    const frames = sheet[e.dir];
    const t = e.moving ? Math.min(1, e.t) : 0;
    // Mid-step shows the stepping frame; alternate feet between steps.
    const idx = e.moving && t > 0.2 && t < 0.8 ? (e.step % 2 ? 3 : 1) : 0;
    return frames[idx];
}

function lookFor(n) {
    if (!npcLooks.has(n.id)) npcLooks.set(n.id, makeCharacter(n.look));
    return npcLooks.get(n.id);
}

function shadow(x, y) {
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(x + 3, y + 13, 10, 2);
    ctx.fillRect(x + 4, y + 12, 8, 4);
}

function drawVehicle(type, dir, x, y, riderFrame) {
    if (type === "car") {
        const img = car[dir];
        ctx.drawImage(img, Math.round(x + 8 - img.width / 2), Math.round(y + 12 - img.height / 2 - (dir === "left" || dir === "right" ? 2 : 0)));
    } else {
        const img = bike[dir];
        const vertical = dir === "up" || dir === "down";
        ctx.drawImage(img, Math.round(x + 8 - img.width / 2), Math.round(y + (vertical ? -6 : 0)));
        if (riderFrame) {
            if (!riders.has(riderFrame)) riders.set(riderFrame, upperBody(riderFrame));
            ctx.drawImage(riders.get(riderFrame), Math.round(x), Math.round(y - 9));
        }
    }
}

function render(t) {
    const m = map();
    if (!grounds[m.id]) grounds[m.id] = prerender(m);
    const vw = canvas.width / scale, vh = canvas.height / scale;
    const [ppx, ppy] = entityPos(state.p);
    const mw = m.w * T, mh = m.h * T;
    let cx = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, ppx + 8 - vw / 2));
    let cy = mh <= vh ? (mh - vh) / 2 : Math.max(0, Math.min(mh - vh, ppy + 8 - vh / 2));
    cx = Math.round(cx * scale) / scale;
    cy = Math.round(cy * scale) / scale;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = m.outdoor ? C.treeDark : C.black;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, -cx * scale, -cy * scale);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(grounds[m.id], 0, 0);

    // Water shimmer on visible tiles.
    const x0 = Math.max(0, Math.floor(cx / T)), y0 = Math.max(0, Math.floor(cy / T));
    const x1 = Math.min(m.w - 1, Math.ceil((cx + vw) / T)), y1 = Math.min(m.h - 1, Math.ceil((cy + vh) / T));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m.ground[y][x] === "w") drawWaterSparkle(ctx, x * T, y * T, x, y, t);

    // Everything with depth, sorted by where it touches the ground.
    const draw = [];
    for (const pr of m.props) draw.push([pr.sortY, () => ctx.drawImage(pr.img, Math.round(pr.px), Math.round(pr.py))]);
    for (const n of m.npcs) {
        const [x, y] = entityPos(n);
        draw.push([y + T, () => { shadow(x, y); ctx.drawImage(characterFrame(lookFor(n), n), Math.round(x), Math.round(y - 4)); }]);
    }
    if (m.id === "world") {
        for (const v of state.vehicles) draw.push([v.y * T + T, () => drawVehicle(v.type, v.dir, v.x * T, v.y * T)]);
    }
    const p = state.p;
    draw.push([ppy + T + 0.5, () => {
        if (p.mount === "car") drawVehicle("car", p.dir, ppx, ppy);
        else if (p.mount === "bike") { shadow(ppx, ppy); drawVehicle("bike", p.dir, ppx, ppy, characterFrame(hero, { ...p, moving: false })); }
        else { shadow(ppx, ppy); ctx.drawImage(characterFrame(hero, p), Math.round(ppx), Math.round(ppy - 4)); }
    }]);
    draw.sort((a, b) => a[0] - b[0]);
    for (const [, fn] of draw) fn();
}

// ------------------------------------------------------------ Boot

function loop() {
    let last = performance.now();
    const frame = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        update(dt, now / 1000);
        render(now / 1000);
        requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
}

async function start() {
    const title = document.getElementById("title");
    title.hidden = true;
    state.started = true;
    canvas.focus();
    UI.banner(map().name);
    let seen = false;
    try { seen = localStorage.getItem("jl-seen") === "1"; localStorage.setItem("jl-seen", "1"); } catch { /* storage blocked */ }
    if (!seen) run(async () => {
        await UI.say("Welcome to JOSE's hometown! This is his house. His résumé and trophies are inside.");
        await howToPlay();
    });
}

(async () => {
    try { await document.fonts.load("8px 'Press Start 2P'"); } catch { /* fallback font */ }
    // Buildings with signs were drawn before the font loaded; rebuild them now.
    Object.assign(maps, buildMaps(S));
    for (const m of Object.values(maps)) {
        for (const n of m.npcs) Object.assign(n, { home: [n.x, n.y], moving: false, t: 0, fx: n.x, fy: n.y, next: 2 + Math.random() * 3, step: 0 });
    }
    resize();
    loop();
    const go = document.getElementById("start");
    go.disabled = false;
    go.addEventListener("click", start);
    window.addEventListener("keydown", function once(e) {
        if (state.started || e.target.closest?.("a")) return;
        if (["Enter", "Space", "KeyZ"].includes(e.code)) { e.preventDefault(); window.removeEventListener("keydown", once); start(); }
    });
    // Handy for debugging from the console.
    window.__game = { state, maps, warp };
})();
