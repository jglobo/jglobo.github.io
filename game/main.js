import * as THREE from "three";
import { AREAS, CARDS } from "./content.js";
import { buildWorld, ISLAND_RADIUS } from "./world.js";
import { initUI } from "./ui.js";

const canvas = document.getElementById("scene");

let renderer;
try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch {
    // No WebGL: the classic site still has everything.
    location.replace("classic/");
    throw new Error("WebGL unavailable");
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd8f5);
scene.fog = new THREE.Fog(0x9fd8f5, 60, 150);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);

scene.add(new THREE.HemisphereLight(0xdff3ff, 0x5b8a4a, 1.1));
const sun = new THREE.DirectionalLight(0xfff2d6, 2.2);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -65, right: 65, top: 65, bottom: -65, near: 1, far: 140 });
sun.shadow.bias = -0.0005;
scene.add(sun);

const { colliders, interactables, animated } = buildWorld(scene);

// ---------- Player ----------

const PLAYER_RADIUS = 0.5;
const player = new THREE.Group();
const limbs = {};
{
    const skin = new THREE.MeshStandardMaterial({ color: 0xc68642, flatShading: true });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x2f6fde, flatShading: true });
    const pants = new THREE.MeshStandardMaterial({ color: 0x2d3142, flatShading: true });
    const hair = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, flatShading: true });
    const part = (geo, material, x, y, z) => {
        const m = new THREE.Mesh(geo, material);
        m.position.set(x, y, z);
        m.castShadow = true;
        return m;
    };
    // Limbs hang from a pivot at the shoulder or hip so they swing naturally.
    const limb = (geo, material, x, y) => {
        const pivot = new THREE.Group();
        pivot.position.set(x, y, 0);
        pivot.add(part(geo, material, 0, -geo.parameters.height / 2, 0));
        player.add(pivot);
        return pivot;
    };
    player.add(part(new THREE.BoxGeometry(0.9, 1, 0.5), shirt, 0, 1.45, 0));
    player.add(part(new THREE.BoxGeometry(0.62, 0.62, 0.62), skin, 0, 2.3, 0));
    player.add(part(new THREE.BoxGeometry(0.66, 0.2, 0.66), hair, 0, 2.66, -0.02));
    player.add(part(new THREE.BoxGeometry(0.1, 0.1, 0.05), hair, -0.14, 2.35, 0.31));
    player.add(part(new THREE.BoxGeometry(0.1, 0.1, 0.05), hair, 0.14, 2.35, 0.31));
    limbs.armL = limb(new THREE.BoxGeometry(0.26, 0.9, 0.26), shirt, -0.6, 1.9);
    limbs.armR = limb(new THREE.BoxGeometry(0.26, 0.9, 0.26), shirt, 0.6, 1.9);
    limbs.legL = limb(new THREE.BoxGeometry(0.34, 0.95, 0.34), pants, -0.22, 0.95);
    limbs.legR = limb(new THREE.BoxGeometry(0.34, 0.95, 0.34), pants, 0.22, 0.95);
}
player.position.set(0, 0, 4);
player.rotation.y = Math.PI; // facing Home
scene.add(player);

const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false })
);
blob.rotation.x = -Math.PI / 2;
scene.add(blob);

// ---------- Input ----------

const keys = new Set();
const move = { x: 0, y: 0 }; // from the on-screen joystick
const view = { yaw: 0, pitch: 0.42, distance: 10 };
let velocityY = 0;

const ui = initUI({
    onJoystick: (x, y) => { move.x = x; move.y = y; },
    onLook: (dx, dy) => {
        view.yaw -= dx * 0.006;
        view.pitch = THREE.MathUtils.clamp(view.pitch + dy * 0.004, 0.08, 1.2);
    },
    onZoom: (delta) => { view.distance = THREE.MathUtils.clamp(view.distance + delta, 5, 18); },
    onInteract: () => { if (nearest) ui.openCard(nearest.card); },
    onTeleport: (areaId) => teleportTo(areaId),
});

window.addEventListener("keydown", (e) => {
    if (ui.isBusy()) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if ((e.code === "KeyE" || e.code === "Enter") && nearest) ui.openCard(nearest.card);
    if (e.code === "Space" && player.position.y <= 0.001) velocityY = 9;
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());

function teleportTo(areaId) {
    const area = AREAS.find((a) => a.id === areaId);
    const [ax, az] = area.pos;
    const len = Math.hypot(ax, az);
    // Drop the player on the path just in front of the area, facing it.
    const stand = Math.max(len - 8, 0);
    player.position.set((ax / len) * stand, 0, (az / len) * stand);
    player.rotation.y = Math.atan2(ax, az);
    view.yaw = player.rotation.y + Math.PI;
}

// ---------- Loop ----------

const clock = new THREE.Clock();
const forward = new THREE.Vector3();
let nearest = null;
let walkPhase = 0;

function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 70 : 55;
    camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

function update(dt, t) {
    // Keyboard and joystick combine into one camera-relative direction.
    let ix = move.x;
    let iy = move.y;
    if (!ui.isBusy()) {
        if (keys.has("KeyW") || keys.has("ArrowUp")) iy += 1;
        if (keys.has("KeyS") || keys.has("ArrowDown")) iy -= 1;
        if (keys.has("KeyA") || keys.has("ArrowLeft")) ix -= 1;
        if (keys.has("KeyD") || keys.has("ArrowRight")) ix += 1;
    } else {
        ix = iy = 0;
    }
    const mag = Math.min(1, Math.hypot(ix, iy));
    const running = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const speed = (running ? 12 : 7) * mag;

    if (mag > 0.05) {
        const angle = Math.atan2(ix, iy);
        const heading = view.yaw + Math.PI - angle;
        forward.set(Math.sin(heading), 0, Math.cos(heading));
        player.position.addScaledVector(forward, speed * dt);
        // Turn smoothly toward the direction of travel.
        let diff = heading - player.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        player.rotation.y += diff * Math.min(1, dt * 12);
    }

    // Keep out of props and on the island.
    for (const c of colliders) {
        const dx = player.position.x - c.x;
        const dz = player.position.z - c.z;
        const d = Math.hypot(dx, dz);
        const min = c.r + PLAYER_RADIUS;
        if (d < min && d > 1e-4) {
            player.position.x = c.x + (dx / d) * min;
            player.position.z = c.z + (dz / d) * min;
        }
    }
    const fromCentre = Math.hypot(player.position.x, player.position.z);
    if (fromCentre > ISLAND_RADIUS) player.position.multiplyScalar(ISLAND_RADIUS / fromCentre);

    // Jump.
    velocityY -= 26 * dt;
    player.position.y = Math.max(0, player.position.y + velocityY * dt);
    if (player.position.y === 0) velocityY = Math.max(velocityY, 0);

    // Walk cycle.
    const swing = speed > 0.1 ? 0.7 : 0;
    walkPhase += dt * (running ? 14 : 10) * (speed > 0.1 ? 1 : 0);
    const target = Math.sin(walkPhase) * swing;
    const ease = Math.min(1, dt * 15);
    limbs.legL.rotation.x += (target - limbs.legL.rotation.x) * ease;
    limbs.legR.rotation.x += (-target - limbs.legR.rotation.x) * ease;
    limbs.armL.rotation.x += (-target - limbs.armL.rotation.x) * ease;
    limbs.armR.rotation.x += (target - limbs.armR.rotation.x) * ease;
    blob.position.set(player.position.x, 0.03, player.position.z);

    // Follow camera orbiting the player.
    const cp = Math.cos(view.pitch);
    const desired = new THREE.Vector3(
        player.position.x + Math.sin(view.yaw) * view.distance * cp,
        player.position.y + 1.6 + Math.sin(view.pitch) * view.distance,
        player.position.z + Math.cos(view.yaw) * view.distance * cp
    );
    camera.position.lerp(desired, Math.min(1, dt * 8));
    camera.lookAt(player.position.x, player.position.y + 1.8, player.position.z);

    // Nearest thing to interact with.
    let best = null;
    let bestD = Infinity;
    for (const it of interactables) {
        const d = Math.hypot(player.position.x - it.x, player.position.z - it.z);
        if (d < it.r && d < bestD) { best = it; bestD = d; }
    }
    if (best !== nearest) {
        nearest = best;
        ui.setPrompt(nearest ? nearest.title : null);
    }

    for (const fn of animated) fn(t);
}

// Snap the camera into place on the first frame instead of flying in.
view.yaw = player.rotation.y + Math.PI;
update(0, 0);
camera.position.set(
    player.position.x + Math.sin(view.yaw) * view.distance * Math.cos(view.pitch),
    1.6 + Math.sin(view.pitch) * view.distance,
    player.position.z + Math.cos(view.yaw) * view.distance * Math.cos(view.pitch)
);

renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    update(dt, clock.elapsedTime);
    renderer.render(scene, camera);
});

// Handy for debugging from the console.
window.__game = { player, view, interactables, CARDS };
