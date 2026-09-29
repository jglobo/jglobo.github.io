// HTML layer on top of the canvas: dialog box, choice menus, info panels,
// the arcade game host and touch controls. Styled like a handheld RPG.

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export { esc };

let active = null; // { kind, onButton(btn), onDir(dir) }
const stack = [];

function push(widget) { stack.push(widget); active = widget; }
function pop(widget) {
    const i = stack.indexOf(widget);
    if (i >= 0) stack.splice(i, 1);
    active = stack[stack.length - 1] ?? null;
}
export const isBusy = () => active !== null;

/** Routes A/B/START presses to whatever is on screen. Returns true if consumed. */
export function button(btn) {
    if (!active) return false;
    active.onButton?.(btn);
    return true;
}
export function dir(d) {
    if (!active) return false;
    active.onDir?.(d);
    return true;
}

// ------------------------------------------------------------ Dialog

const dialog = () => $("#dialog");
let picture = null;

/** Shows one page of text with a typewriter effect; resolves when the player presses A. */
export function say(text, { pic } = {}) {
    return new Promise((resolve) => {
        const box = dialog();
        const body = box.querySelector(".text");
        const more = box.querySelector(".more");
        box.hidden = false;
        more.hidden = true;
        setPicture(pic);
        let shown = 0;
        let done = false;
        const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const render = () => { body.textContent = text.slice(0, shown); };
        const timer = setInterval(() => {
            shown += 2;
            if (shown >= text.length || reduced) finishTyping();
            else render();
        }, 22);
        function finishTyping() {
            clearInterval(timer);
            shown = text.length;
            render();
            done = true;
            more.hidden = false;
        }
        const w = {
            kind: "say",
            onButton(btn) {
                if (btn !== "A" && btn !== "B" && btn !== "ESC") return;
                if (!done) return finishTyping();
                pop(w);
                if (!stack.some((s) => s.kind === "say" || s.kind === "choose")) box.hidden = true;
                resolve();
            },
        };
        box.onclick = () => w.onButton("A");
        push(w);
    });
}

function setPicture(src) {
    const el = $("#picture");
    if (!src) { el.hidden = true; picture = null; return; }
    if (picture !== src) el.querySelector("img").src = src;
    picture = src;
    el.hidden = false;
}

/** Keeps the last dialog line on screen and shows a choice list beside it. */
export function choose(options, { cancel = options.length - 1 } = {}) {
    return new Promise((resolve) => {
        const box = $("#choices");
        let i = 0;
        box.innerHTML = options.map((o, n) => `<li><button data-i="${n}">${esc(o)}</button></li>`).join("");
        box.hidden = false;
        dialog().hidden = false;
        dialog().querySelector(".more").hidden = true;
        const btns = [...box.querySelectorAll("button")];
        const paint = () => btns.forEach((b, n) => b.classList.toggle("sel", n === i));
        paint();
        const finish = (n) => {
            pop(w);
            box.hidden = true;
            dialog().hidden = true;
            setPicture(null);
            resolve(n);
        };
        const w = {
            kind: "choose",
            onDir(d) {
                if (d === "up") i = (i + options.length - 1) % options.length;
                if (d === "down") i = (i + 1) % options.length;
                paint();
            },
            onButton(btn) {
                if (btn === "A") finish(i);
                if (btn === "B" || btn === "ESC") finish(cancel);
            },
        };
        btns.forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); finish(Number(b.dataset.i)); }));
        push(w);
    });
}

export function closeDialog() {
    dialog().hidden = true;
    setPicture(null);
}

// ------------------------------------------------------------ Panels

/** Opens a framed info panel; resolves when closed. `setup(el, close)` can wire buttons. */
export function panel(html, { title = "", wide = false, setup } = {}) {
    return new Promise((resolve) => {
        const wrap = $("#panel");
        wrap.hidden = false;
        wrap.innerHTML = `
            <div class="frame${wide ? " wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
                <header><h2>${esc(title)}</h2><button class="close" aria-label="Close">✕</button></header>
                <div class="content">${html}</div>
            </div>`;
        const close = () => {
            pop(w);
            wrap.hidden = true;
            wrap.innerHTML = "";
            document.getElementById("scene").focus();
            resolve();
        };
        const w = {
            kind: "panel",
            onButton(btn) { if (btn === "B" || btn === "ESC") close(); },
            onDir(d) {
                const c = wrap.querySelector(".content");
                if (d === "up") c.scrollBy(0, -60);
                if (d === "down") c.scrollBy(0, 60);
            },
        };
        wrap.querySelector(".close").addEventListener("click", close);
        wrap.onclick = (e) => { if (e.target === wrap) close(); };
        push(w);
        setup?.(wrap.querySelector(".content"), close);
        wrap.querySelector(".close").focus();
    });
}

// ------------------------------------------------------------ Arcade host

export function playGame(game, moduleUrl) {
    return new Promise(async (resolve) => {
        const wrap = $("#arcade");
        wrap.hidden = false;
        wrap.innerHTML = `
            <div class="arcade-top"><span>${esc(game.title)}</span><button class="close">EXIT ✕</button></div>
            <div class="arcade-stage"><p class="loading">Loading…</p></div>`;
        const stage = wrap.querySelector(".arcade-stage");
        let cleanup = null;
        const close = () => {
            try { cleanup?.(); } catch (e) { console.warn(e); }
            pop(w);
            wrap.hidden = true;
            wrap.innerHTML = "";
            document.getElementById("scene").focus();
            resolve();
        };
        // The game owns the keyboard while it runs; only Escape reaches us.
        const w = { kind: "game", onButton(btn) { if (btn === "ESC") close(); } };
        push(w);
        wrap.querySelector(".close").addEventListener("click", close);
        try {
            const mod = await import(moduleUrl);
            stage.innerHTML = "";
            cleanup = mod.default.start(stage);
        } catch (e) {
            console.error(e);
            stage.innerHTML = `<p class="loading">Sorry, this game failed to load.</p>`;
        }
    });
}

// ------------------------------------------------------------ Banner & fade

let bannerTimer;
export function banner(text) {
    const el = $("#banner");
    el.textContent = text;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

export function fade(on) {
    const el = $("#fade");
    el.classList.toggle("on", on);
    return new Promise((r) => setTimeout(r, 220));
}

// ------------------------------------------------------------ Touch controls

export function initTouch(onPress, onDirHeld) {
    const coarse = matchMedia("(pointer: coarse)").matches;
    document.body.classList.toggle("touch", coarse);
    const pad = $("#touch");
    const held = new Map();
    pad.addEventListener("pointerdown", (e) => {
        const b = e.target.closest("[data-btn]");
        if (!b) return;
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        b.classList.add("down");
        const v = b.dataset.btn;
        if (["up", "down", "left", "right"].includes(v)) { held.set(e.pointerId, v); onDirHeld(v, true); }
        else onPress(v);
    });
    const up = (e) => {
        const b = e.target.closest("[data-btn]");
        b?.classList.remove("down");
        const v = held.get(e.pointerId);
        if (v) { held.delete(e.pointerId); onDirHeld(v, false); }
    };
    pad.addEventListener("pointerup", up);
    pad.addEventListener("pointercancel", up);
}
