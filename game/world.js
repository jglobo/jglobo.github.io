import * as THREE from "three";
import { AREAS, CARDS, PROP_IMAGES } from "./content.js";

export const ISLAND_RADIUS = 56;

const loader = new THREE.TextureLoader();
const matCache = new Map();

// Flat-shaded, low-poly look: one shared material per colour.
function mat(color) {
    if (!matCache.has(color)) {
        matCache.set(color, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 }));
    }
    return matCache.get(color);
}

function mesh(geometry, color, { x = 0, y = 0, z = 0, cast = true } = {}) {
    const m = new THREE.Mesh(geometry, typeof color === "string" || typeof color === "number" ? mat(color) : color);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
}

// Seeded random so the island looks the same on every visit.
function rng(seed) {
    return () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
    };
}

// Text rendered to a canvas and shown as a sprite that always faces the camera.
export function makeLabel(text, { size = 1, color = "#1d2433", bg = "rgba(255,255,255,0.92)" } = {}) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const font = "700 64px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 72;
    canvas.width = w;
    canvas.height = 112;
    ctx.font = font;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, 104, 52);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, 60);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
    sprite.scale.set((w / 112) * size, size, 1);
    sprite.renderOrder = 10;
    return sprite;
}

// A picture that keeps its aspect ratio inside a maxW x maxH frame.
function imagePanel(url, maxW, maxH, fallbackText) {
    const material = new THREE.MeshBasicMaterial({ color: 0x223044 });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    panel.scale.set(maxW, maxH, 1);
    if (url) {
        loader.load(url, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 4;
            material.map = tex;
            material.color.set(0xffffff);
            material.needsUpdate = true;
            const aspect = tex.image.width / tex.image.height;
            if (aspect > maxW / maxH) panel.scale.set(maxW, maxW / aspect, 1);
            else panel.scale.set(maxH * aspect, maxH, 1);
        });
    } else if (fallbackText) {
        const label = makeLabel(fallbackText, { size: 0.5, color: "#ffd84d", bg: "rgba(0,0,0,0)" });
        material.map = label.material.map;
        material.color.set(0xffffff);
        panel.scale.set(maxW, maxH, 1);
    }
    return panel;
}

/**
 * Builds the island and returns what the game loop needs:
 * colliders (circles the player can't walk through), interactables
 * (spots that open a card), and a list of things to animate.
 */
export function buildWorld(scene) {
    const colliders = [];
    const interactables = [];
    const animated = [];

    // Sea, beach and grass.
    const water = mesh(new THREE.CircleGeometry(400, 48), new THREE.MeshStandardMaterial({ color: 0x3aa7d8, roughness: 0.3, metalness: 0.1 }), { y: -0.6, cast: false });
    water.rotation.x = -Math.PI / 2;
    scene.add(water);
    animated.push((t) => { water.position.y = -0.6 + Math.sin(t * 0.8) * 0.08; });

    scene.add(mesh(new THREE.CylinderGeometry(ISLAND_RADIUS + 4, ISLAND_RADIUS + 9, 2, 40), 0xf1dca0, { y: -1.05, cast: false }));
    scene.add(mesh(new THREE.CylinderGeometry(ISLAND_RADIUS - 3, ISLAND_RADIUS + 1, 1, 40), 0x7cc26b, { y: -0.5, cast: false }));

    // Sandy paths from the centre to every area.
    const pathMat = mat(0xe3cf95);
    for (const area of AREAS) {
        const [ax, az] = area.pos;
        const len = Math.hypot(ax, az);
        const path = new THREE.Mesh(new THREE.PlaneGeometry(2.6, len), pathMat);
        path.rotation.x = -Math.PI / 2;
        path.rotation.z = Math.atan2(ax, az);
        path.position.set(ax / 2, 0.01, az / 2);
        path.receiveShadow = true;
        scene.add(path);
    }
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(5, 24), pathMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.012;
    plaza.receiveShadow = true;
    scene.add(plaza);

    const builders = { home: buildHome, arcade: buildArcade, workshop: buildWorkshop, gallery: buildGallery, yard: buildYard, mailbox: buildMailbox };

    for (const area of AREAS) {
        const group = new THREE.Group();
        group.position.set(area.pos[0], 0, area.pos[1]);
        // Face the island centre so the front of every area greets the player.
        group.lookAt(0, 0, 0);
        scene.add(group);

        const parts = builders[area.id](group, area);
        group.updateMatrixWorld(true);

        for (const c of parts.colliders) {
            const p = group.localToWorld(new THREE.Vector3(c.x, 0, c.z));
            colliders.push({ x: p.x, z: p.z, r: c.r });
        }
        for (const it of parts.interactables) {
            const p = group.localToWorld(new THREE.Vector3(it.x, 0, it.z));
            interactables.push({ x: p.x, z: p.z, r: it.r ?? 2.2, card: it.card, title: CARDS[it.card].prompt ?? CARDS[it.card].title });
        }
        if (parts.animate) animated.push(parts.animate);

        const label = makeLabel(area.label, { size: 1.5 });
        label.position.set(0, parts.labelHeight ?? 7, 0);
        group.add(label);
    }

    addNature(scene, colliders);
    addClouds(scene, animated);

    return { colliders, interactables, animated };
}

function buildHome(g) {
    // House body, pitched roof, door and windows.
    g.add(mesh(new THREE.BoxGeometry(9, 4.5, 7), 0xf4efe6, { y: 2.25, z: -1 }));
    const roof = mesh(new THREE.ConeGeometry(7, 3.2, 4), 0xc8553d, { y: 6.1, z: -1 });
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.8);
    g.add(roof);
    g.add(mesh(new THREE.BoxGeometry(1.6, 2.6, 0.2), 0x7a4a2a, { y: 1.3, z: 2.55 }));
    for (const x of [-2.9, 2.9]) {
        g.add(mesh(new THREE.BoxGeometry(1.6, 1.4, 0.2), 0x9fd3f0, { x, y: 2.6, z: 2.55 }));
    }
    g.add(mesh(new THREE.BoxGeometry(0.9, 2, 0.9), 0xa9a9a9, { x: 2.6, y: 6.4, z: -2 }));

    // Easel with a portrait next to the door.
    const easel = new THREE.Group();
    easel.position.set(-3.2, 0, 4.4);
    easel.rotation.y = 0.35;
    easel.add(mesh(new THREE.BoxGeometry(0.15, 3, 0.15), 0x7a4a2a, { x: -0.8, y: 1.5 }));
    easel.add(mesh(new THREE.BoxGeometry(0.15, 3, 0.15), 0x7a4a2a, { x: 0.8, y: 1.5 }));
    easel.add(mesh(new THREE.BoxGeometry(2.1, 2.5, 0.1), 0x3b2a1e, { y: 2.1, z: 0.1 }));
    const photo = imagePanel(PROP_IMAGES.about, 1.9, 2.3);
    photo.position.set(0, 2.1, 0.17);
    easel.add(photo);
    g.add(easel);

    return {
        colliders: [
            { x: -3, z: -1, r: 3.6 }, { x: 3, z: -1, r: 3.6 }, { x: 0, z: -1, r: 3.6 },
            { x: -3.2, z: 4.4, r: 0.9 },
        ],
        interactables: [{ card: "about", x: -0.8, z: 5, r: 3 }],
        labelHeight: 9.2,
    };
}

function buildArcade(g) {
    g.add(mesh(new THREE.BoxGeometry(15, 0.2, 7), 0x2b2540, { y: 0.1, z: -0.5, cast: false }));
    // Neon sign on two posts.
    for (const x of [-7, 7]) g.add(mesh(new THREE.BoxGeometry(0.3, 5, 0.3), 0x444444, { x, y: 2.5, z: -3.5 }));
    const sign = mesh(new THREE.BoxGeometry(14.6, 0.9, 0.3), new THREE.MeshStandardMaterial({ color: 0xff4fa3, emissive: 0xff4fa3, emissiveIntensity: 0.6 }), { y: 5, z: -3.5 });
    g.add(sign);

    const ids = ["pirate", "flappy", "spaceduel", "rpg"];
    const colors = [0x3d5afe, 0xffb300, 0x00b894, 0xe53935];
    const screens = [];
    ids.forEach((id, i) => {
        const x = -5.1 + i * 3.4;
        const cab = new THREE.Group();
        cab.position.set(x, 0.2, -1.2);
        cab.add(mesh(new THREE.BoxGeometry(2, 3.2, 1.5), colors[i], { y: 1.6 }));
        cab.add(mesh(new THREE.BoxGeometry(2.1, 0.5, 1.6), 0x222222, { y: 3.35 }));
        cab.add(mesh(new THREE.BoxGeometry(2, 0.25, 0.7), 0x222222, { y: 1.35, z: 0.95 }));
        cab.add(mesh(new THREE.SphereGeometry(0.12, 8, 6), 0xff1744, { x: -0.4, y: 1.55, z: 1.05 }));
        const screen = imagePanel(PROP_IMAGES[id], 1.6, 1.3, "?  RPG  ?");
        screen.position.set(0, 2.45, 0.77);
        cab.add(screen);
        screens.push(screen);
        g.add(cab);
    });

    return {
        colliders: ids.map((_, i) => ({ x: -5.1 + i * 3.4, z: -1.2, r: 1.2 })),
        interactables: ids.map((card, i) => ({ card, x: -5.1 + i * 3.4, z: 0.9, r: 1.8 })),
        labelHeight: 7,
        animate: (t) => { sign.material.emissiveIntensity = 0.45 + Math.sin(t * 3) * 0.2; },
    };
}

function buildWorkshop(g) {
    // Open shed: four posts and a flat roof.
    for (const [x, z] of [[-6.5, -3], [6.5, -3], [-6.5, 2], [6.5, 2]]) {
        g.add(mesh(new THREE.BoxGeometry(0.35, 4, 0.35), 0x8d6e4a, { x, y: 2, z }));
    }
    g.add(mesh(new THREE.BoxGeometry(14.2, 0.35, 6), 0x5d7d8f, { y: 4.1, z: -0.5 }));

    const ids = ["studyclock", "calculator", "heatmap"];
    ids.forEach((id, i) => {
        const x = -4.2 + i * 4.2;
        g.add(mesh(new THREE.BoxGeometry(3, 0.2, 1.4), 0xb07d4f, { x, y: 1.1, z: -1 }));
        for (const dx of [-1.3, 1.3]) g.add(mesh(new THREE.BoxGeometry(0.15, 1.1, 1.2), 0x7a5230, { x: x + dx, y: 0.55, z: -1 }));
        g.add(mesh(new THREE.BoxGeometry(0.3, 0.6, 0.3), 0x333333, { x, y: 1.5, z: -1.3 }));
        g.add(mesh(new THREE.BoxGeometry(2.6, 1.8, 0.15), 0x222222, { x, y: 2.6, z: -1.35 }));
        const screen = imagePanel(PROP_IMAGES[id], 2.4, 1.6);
        screen.position.set(x, 2.6, -1.26);
        g.add(screen);
    });

    return {
        colliders: ids.map((_, i) => ({ x: -4.2 + i * 4.2, z: -1, r: 1.5 })),
        interactables: ids.map((card, i) => ({ card, x: -4.2 + i * 4.2, z: 1, r: 1.9 })),
        labelHeight: 6.4,
    };
}

function buildGallery(g) {
    const ids = ["covid", "movies"];
    ids.forEach((id, i) => {
        const x = -3.6 + i * 7.2;
        for (const dx of [-2.4, 2.4]) g.add(mesh(new THREE.BoxGeometry(0.3, 5.5, 0.3), 0x555555, { x: x + dx, y: 2.75, z: -1 }));
        g.add(mesh(new THREE.BoxGeometry(5.6, 3.8, 0.25), 0xfafafa, { x, y: 3.6, z: -1 }));
        const img = imagePanel(PROP_IMAGES[id], 5.2, 3.4);
        img.position.set(x, 3.6, -0.86);
        g.add(img);
    });
    return {
        colliders: ids.flatMap((_, i) => [-2.4, 2.4].map((dx) => ({ x: -3.6 + i * 7.2 + dx, z: -1, r: 0.5 }))),
        interactables: ids.map((card, i) => ({ card, x: -3.6 + i * 7.2, z: 1.2, r: 2.4 })),
        labelHeight: 7.4,
    };
}

function buildYard(g) {
    // Low fence around a sparring ground with one pillar per skill.
    g.add(mesh(new THREE.CylinderGeometry(6.5, 6.5, 0.1, 24), 0xd8b98a, { y: 0.05, cast: false }));
    const skills = CARDS.skills.skills;
    const colors = [0xf7df1e, 0x3776ab, 0xe38c00, 0x659ad2];
    skills.forEach(([name, pct], i) => {
        const x = -4.5 + i * 3;
        const h = 0.6 + (pct / 100) * 5;
        g.add(mesh(new THREE.BoxGeometry(1.4, h, 1.4), colors[i], { x, y: h / 2, z: -2 }));
        const label = makeLabel(name, { size: 0.55 });
        label.position.set(x, h + 0.6, -2);
        g.add(label);
    });
    // Trophy for certifications.
    const trophy = new THREE.Group();
    trophy.position.set(0, 0, 1.5);
    trophy.add(mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), 0x5b4636, { y: 0.4 }));
    trophy.add(mesh(new THREE.CylinderGeometry(0.15, 0.3, 0.8, 8), 0xffc93c, { y: 1.2 }));
    trophy.add(mesh(new THREE.CylinderGeometry(0.6, 0.25, 0.9, 10), 0xffc93c, { y: 2 }));
    g.add(trophy);

    return {
        colliders: [...skills.map((_, i) => ({ x: -4.5 + i * 3, z: -2, r: 1 })), { x: 0, z: 1.5, r: 0.9 }],
        interactables: [{ card: "skills", x: 0, z: 3, r: 3 }],
        labelHeight: 8,
        animate: (t) => { trophy.rotation.y = t * 0.8; },
    };
}

function buildMailbox(g) {
    g.add(mesh(new THREE.BoxGeometry(0.25, 1.4, 0.25), 0x7a4a2a, { y: 0.7 }));
    g.add(mesh(new THREE.BoxGeometry(0.9, 0.7, 1.3), 0x2f6fde, { y: 1.65 }));
    const top = mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.3, 12, 1, false, 0, Math.PI), 0x2f6fde, { y: 2 });
    top.rotation.z = Math.PI / 2;
    top.rotation.y = Math.PI / 2;
    g.add(top);
    const flag = mesh(new THREE.BoxGeometry(0.06, 0.6, 0.35), 0xe53935, { x: 0.5, y: 2.1, z: -0.2 });
    g.add(flag);
    return {
        colliders: [{ x: 0, z: 0, r: 0.7 }],
        interactables: [{ card: "contact", x: 0, z: 1.2, r: 2.2 }],
        labelHeight: 3.6,
        animate: (t) => { flag.rotation.x = Math.sin(t * 2) * 0.25; },
    };
}

function addNature(scene, colliders) {
    const rand = rng(42);
    const clear = (x, z) =>
        Math.hypot(x, z) > 8 &&
        AREAS.every((a) => Math.hypot(x - a.pos[0], z - a.pos[1]) > 10) &&
        // Keep the paths clear: distance from each centre-to-area segment.
        AREAS.every((a) => {
            const [ax, az] = a.pos;
            const t = Math.max(0, Math.min(1, (x * ax + z * az) / (ax * ax + az * az)));
            return Math.hypot(x - ax * t, z - az * t) > 3;
        });

    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 1.6, 6);
    const leafGeo = new THREE.ConeGeometry(1.5, 3.4, 7);
    const bushGeo = new THREE.IcosahedronGeometry(1, 0);
    let placed = 0;
    for (let i = 0; i < 400 && placed < 80; i++) {
        const angle = rand() * Math.PI * 2;
        const dist = 6 + Math.sqrt(rand()) * (ISLAND_RADIUS - 10);
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        if (!clear(x, z)) continue;
        const s = 0.8 + rand() * 0.7;
        if (rand() < 0.75) {
            const tree = new THREE.Group();
            tree.add(mesh(trunkGeo, 0x7a4a2a, { y: 0.8 }));
            tree.add(mesh(leafGeo, rand() < 0.5 ? 0x2e8b57 : 0x3fa34d, { y: 3 }));
            tree.position.set(x, 0, z);
            tree.scale.setScalar(s);
            tree.rotation.y = rand() * Math.PI;
            scene.add(tree);
            colliders.push({ x, z, r: 0.5 * s });
        } else {
            const bush = mesh(bushGeo, 0x5aa84a, { x, y: 0.5 * s, z });
            bush.scale.set(s, s * 0.8, s);
            scene.add(bush);
        }
        placed++;
    }

    // A few rocks on the beach.
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < 18; i++) {
        const angle = rand() * Math.PI * 2;
        const dist = ISLAND_RADIUS - 1 + rand() * 4;
        const s = 0.4 + rand() * 0.9;
        const rock = mesh(rockGeo, 0x9e9e9e, { x: Math.cos(angle) * dist, y: -0.1, z: Math.sin(angle) * dist });
        rock.scale.setScalar(s);
        rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
        scene.add(rock);
    }
}

function addClouds(scene, animated) {
    const rand = rng(7);
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 });
    const geo = new THREE.IcosahedronGeometry(2.4, 0);
    const clouds = new THREE.Group();
    for (let i = 0; i < 12; i++) {
        const cloud = new THREE.Group();
        for (let j = 0; j < 3; j++) {
            const puff = new THREE.Mesh(geo, white);
            puff.position.set(j * 2.6 - 2.6, rand(), rand() * 1.5);
            puff.scale.setScalar(0.7 + rand() * 0.6);
            cloud.add(puff);
        }
        const a = rand() * Math.PI * 2;
        const d = 30 + rand() * 60;
        cloud.position.set(Math.cos(a) * d, 26 + rand() * 12, Math.sin(a) * d);
        clouds.add(cloud);
    }
    scene.add(clouds);
    animated.push((t) => { clouds.rotation.y = t * 0.01; });
}
