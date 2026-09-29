import { AREAS, CARDS } from "./content.js";

const $ = (sel) => document.querySelector(sel);

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function cardHtml(card) {
    const parts = [];
    if (card.image) parts.push(`<img class="card-image" src="${card.image}" alt="${escapeHtml(card.title)}" loading="lazy">`);
    parts.push(`<p class="card-tag">${escapeHtml(card.tag)}</p>`);
    parts.push(`<h2 id="card-title">${escapeHtml(card.title)}</h2>`);
    for (const p of card.body ?? []) parts.push(`<p>${escapeHtml(p)}</p>`);
    if (card.stats) {
        parts.push(`<div class="card-stats">${card.stats
            .map(([n, label]) => `<div><strong>${escapeHtml(n)}</strong><span>${escapeHtml(label)}</span></div>`)
            .join("")}</div>`);
    }
    if (card.skills) {
        parts.push(`<div class="card-skills">${card.skills
            .map(([name, pct]) => `<div class="skill"><span>${escapeHtml(name)}</span><div class="bar"><div style="width:${pct}%"></div></div></div>`)
            .join("")}</div>`);
    }
    if (card.links?.length) {
        parts.push(`<div class="card-links">${card.links
            .map((l, i) => {
                const external = /^https?:/.test(l.href);
                const attrs = l.download ? " download" : external ? ' target="_blank" rel="noopener"' : "";
                return `<a class="btn${i === 0 ? " primary" : ""}" href="${l.href}"${attrs}>${escapeHtml(l.label)}</a>`;
            })
            .join("")}</div>`);
    }
    return parts.join("");
}

/**
 * Wires up the HTML overlay: intro screen, interaction prompt, project cards,
 * the directory menu, and touch controls. Callbacks drive the 3D side.
 */
export function initUI({ onJoystick, onLook, onZoom, onInteract, onTeleport }) {
    const intro = $("#intro");
    const prompt = $("#prompt");
    const promptTitle = $("#prompt-title");
    const card = $("#card");
    const cardBody = $("#card-body");
    const menu = $("#menu");
    const isTouch = matchMedia("(pointer: coarse)").matches;
    document.body.classList.toggle("touch", isTouch);

    let open = null; // the element currently covering the game, if any
    let lastFocus = null;

    function show(el) {
        lastFocus = document.activeElement;
        open = el;
        el.hidden = false;
        el.querySelector("[data-autofocus]")?.focus();
        onJoystick(0, 0);
    }
    function hide() {
        if (!open) return;
        open.hidden = true;
        open = null;
        lastFocus?.focus?.();
    }

    function openCard(id) {
        cardBody.innerHTML = cardHtml(CARDS[id]);
        card.scrollTop = 0;
        show(card);
    }

    // Intro.
    $("#start").addEventListener("click", () => { intro.hidden = true; open = null; $("#scene").focus(); });
    open = intro;

    // Cards and menu close on the X, the backdrop, or Escape.
    for (const el of [card, menu]) {
        el.addEventListener("click", (e) => { if (e.target === el || e.target.closest("[data-close]")) hide(); });
    }
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") hide();
        if ((e.key === "m" || e.key === "M") && !open) show(menu);
    });

    // Directory: every project in one list, for visitors in a hurry.
    $("#menu-list").innerHTML = AREAS.map((a) => `
        <li>
            <button class="menu-area" data-area="${a.id}">${escapeHtml(a.label)} <span>Go there</span></button>
            <ul>${a.cards.map((c) => `<li><button data-card="${c}">${escapeHtml(CARDS[c].title)}</button></li>`).join("")}</ul>
        </li>`).join("");
    $("#menu-list").addEventListener("click", (e) => {
        const cardBtn = e.target.closest("[data-card]");
        const areaBtn = e.target.closest("[data-area]");
        if (cardBtn) { hide(); openCard(cardBtn.dataset.card); }
        else if (areaBtn) { hide(); onTeleport(areaBtn.dataset.area); }
    });
    $("#menu-btn").addEventListener("click", () => show(menu));

    prompt.addEventListener("click", () => onInteract());

    // Look around: drag anywhere on the canvas (or right half on touch).
    const sceneEl = $("#scene");
    let lookId = null;
    let lx = 0;
    let ly = 0;
    sceneEl.addEventListener("pointerdown", (e) => {
        if (lookId !== null) return;
        lookId = e.pointerId;
        lx = e.clientX;
        ly = e.clientY;
        sceneEl.setPointerCapture(e.pointerId);
    });
    sceneEl.addEventListener("pointermove", (e) => {
        if (e.pointerId !== lookId) return;
        onLook(e.clientX - lx, e.clientY - ly);
        lx = e.clientX;
        ly = e.clientY;
    });
    const endLook = (e) => { if (e.pointerId === lookId) lookId = null; };
    sceneEl.addEventListener("pointerup", endLook);
    sceneEl.addEventListener("pointercancel", endLook);
    sceneEl.addEventListener("wheel", (e) => { e.preventDefault(); onZoom(Math.sign(e.deltaY) * 1.2); }, { passive: false });

    // Virtual joystick for phones.
    const joy = $("#joystick");
    const knob = $("#joystick-knob");
    let joyId = null;
    const RADIUS = 48;
    function joyMove(e) {
        const r = joy.getBoundingClientRect();
        let dx = e.clientX - (r.left + r.width / 2);
        let dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy);
        if (d > RADIUS) { dx *= RADIUS / d; dy *= RADIUS / d; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        onJoystick(dx / RADIUS, -dy / RADIUS);
    }
    joy.addEventListener("pointerdown", (e) => {
        joyId = e.pointerId;
        joy.setPointerCapture(e.pointerId);
        joyMove(e);
    });
    joy.addEventListener("pointermove", (e) => { if (e.pointerId === joyId) joyMove(e); });
    const endJoy = (e) => {
        if (e.pointerId !== joyId) return;
        joyId = null;
        knob.style.transform = "";
        onJoystick(0, 0);
    };
    joy.addEventListener("pointerup", endJoy);
    joy.addEventListener("pointercancel", endJoy);

    return {
        openCard,
        isBusy: () => open !== null,
        setPrompt(title) {
            prompt.hidden = !title;
            if (title) promptTitle.textContent = title;
        },
    };
}
