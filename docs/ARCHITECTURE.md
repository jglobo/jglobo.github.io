# Portal Hub Portfolio: Architecture

This is the first deliverable of the master prompt: an assessment of the existing
repository and the architecture for the game-world portfolio. Implementation
starts with the vertical slice described in section 13 (Landing, Hub, Data
Science portal, one project, return).

## 1. Current repository assessment

| Item | State | Decision |
| --- | --- | --- |
| `index.html`, `css/style.css`, `js/app.js` | Single static page from 2021 (jQuery, Isotope, Swiper, FontAwesome from CDNs). About, a 9-project grid, skill bars, certifications, contact form via FormSubmit. Blog/Testimonials sections were placeholder jokes and are commented out. | **Preserved** unchanged at `/classic/` (paths fixed). Home address and phone number removed from it, per the project rule. |
| `images/` | Project screenshots and GIFs (the two GIFs are ~15 MB together). | **Reused** by the new content files as project screenshots. Served as static files, never bundled. |
| `Games/*.zip` | Pygame builds (Windows executables). `RPG.zip` is referenced but missing. | **Kept** as download links on game projects. |
| `Jose_Lobo_pdf_Resume.pdf`, `.docx` | Current resume. | **Kept** at the same URL; linked from the Hub's personnel terminal and every menu. |
| Branch `claude/project-thread-vza7ft` (draft PR #1) | Earlier top-down pixel-art town. Its `game/content.js` holds the cleanest version of the portfolio text, and `arcade/` holds browser ports of the Pygame games. | **Untouched.** Its content data was copied into `src/content/*.json`. The browser game ports are the planned "one actual game" for the Game Room phase and will be brought over then. |
| Hosting | GitHub Pages, deploy from branch, no build step. | Vite needs a build, so a GitHub Actions workflow builds and deploys. The Pages source must be switched to "GitHub Actions" when going live. |

Nothing that works today is deleted: the old page keeps working at `/classic/`
and every asset keeps its URL.

## 2. Proposed architecture

```
index.html (indexable SEO content + mount point)
   └─ React app (src/main.tsx → app/App.tsx)
        ├─ Landing screen          (no three.js downloaded yet)
        ├─ QuickPortfolio          (plain DOM, always one key away)
        └─ GameShell (lazy chunk: three, R3F)
             ├─ <Canvas> → WorldHost → one active world (lazy chunk per world)
             └─ DOM overlays: HUD, prompts, nav arrows, PauseMenu, ProjectInspector,
                TransitionOverlay, DebugOverlay
```

Principles:

* **One world mounted at a time.** `WorldHost` renders only `currentWorld`. Leaving
  a world unmounts its React tree, which disposes R3F-owned geometry, materials
  and textures; world-owned resources that R3F does not own are released in the
  world's cleanup effect.
* **Worlds never import each other.** They talk to the rest of the app only through
  the stores, the interaction registry and the world registry.
* **The portfolio is data.** Components render whatever is in `src/content`.
* **DOM for reading, WebGL for wonder.** Long text (inspector, menus) is DOM so it
  scrolls, selects, zooms and is screen-reader friendly; the 3D scene shows
  holograms, charts and signposts that open it.

## 3. Technology and dependency decisions

| Dependency | Why it is here |
| --- | --- |
| React 19 + TypeScript | UI, overlays and world composition. |
| Vite | Dev server, TS, code splitting by dynamic `import()`. |
| three + @react-three/fiber | Rendering; R3F gives declarative scene graphs with automatic disposal on unmount. |
| @react-three/drei | Only `Html` (anchoring labels to 3D objects) and `PerformanceMonitor` (automatic quality downshift). Nothing that fetches from a CDN (e.g. drei `Text` fonts) is used. |
| zustand | Global game state with selectors, readable from inside `useFrame` without re-renders. |

Deferred until a phase needs them (not installed yet):

* **Rapier** (`@react-three/rapier`) for the Software world vehicles. The Hub and
  the Space world use simple kinematic movement with analytic collision (room
  bounds, spheres), which costs nothing to download.
* **postprocessing** for bloom on High/Ultra, once profiled.
* **Howler** is not needed: audio is synthesized with the Web Audio API, which also
  means every sound is original.
* GSAP / Framer Motion are not needed; CSS transitions and `useFrame` easing cover it.

## 4. Directory structure

```
src/
  app/            App shell, GameShell, capability detection
  engine/
    audio/        AudioManager (Web Audio, synthesized ambience + SFX)
    input/        Input manager (key bindings, remapping, look deltas)
    interaction/  Interaction registry (nearest interactable → prompt → E)
    loading/      World registry (lazy imports, preloading)
    portals/      Portal visual, destination metadata
    debug/        Debug overlay (FPS, draw calls, triangles, positions)
  worlds/
    WorldHost.tsx
    hub/          HubWorld, HubEnvironment, HubFirstPersonController, PortalLauncher,
                  ResumeTerminal
    data-science/ DataScienceWorld, SpaceEnvironment, Earth, Astronaut,
                  JetpackController (pure physics), SpacePlatformCamera, ProjectSite,
                  DataHologram, NavigationArrows, ReturnPortal
    placeholder/  Shared "coming soon" behaviour for worlds not built yet
  portfolio/      ProjectInspector, QuickPortfolio, content helpers
  content/        JSON content + schema.ts + index.ts (loader)
  stores/         gameStore, settingsStore, persistence
  ui/             Landing, HUD, PauseMenu, WorldMap, Settings, TransitionOverlay
  assets/         manifest.ts (every asset URL in one place)
  analytics/      track.ts (privacy-conscious, no-op by default)
docs/             This file, ASSETS.md (sources and licences)
classic/          The original 2021 site
```

## 5. World architecture

A world is a registry entry plus a lazily loaded React component:

```ts
interface WorldDefinition {
  id: WorldId;                 // 'hub' | 'data-science' | 'games' | 'software' | 'journey'
  name: string; short: string; // "Orbital Data World"
  theme: { color: string; symbol: string; label: string };
  status: 'playable' | 'coming-soon';
  load: () => Promise<{ default: ComponentType }>; // dynamic import = its own chunk
}
```

The conceptual `load / enter / update / exit / unload` contract maps onto React:

| Contract | Implementation |
| --- | --- |
| `load()` | `definition.load()`, started when the portal is fired so it downloads while the portal opens. |
| `enter()` | Component mount; the world sets its spawn point, camera controller and ambience. |
| `update(dt)` | `useFrame` hooks inside the world only. |
| `exit()` / `unload()` | Unmount. R3F disposes owned objects; effects remove listeners, stop audio, dispose custom render targets. |

Each world owns its own player controller and camera controller
(`HubFirstPersonController`, `SpaceAstronautController` + `SpacePlatformCamera`,
later `BedroomFirstPersonController`, `VehicleController`, `HD2DCamera`). There is no
shared camera component with per-world conditionals.

## 6. State-management architecture

Two zustand stores:

* **gameStore**: `currentWorld`, `previousWorld`, `portalDestination`, `portal`
  (placed portal position/normal/state), `transition` (phase + target),
  `visitedWorlds`, `discoveredProjects`, `selectedProject`, `completedInteractions`,
  `ui` (pause menu, quick portfolio, inspector, map), `prompt`, `hint`, and slots for
  `vehicleSelection`, `currentVehicle`, `dialogueProgress`.
* **settingsStore**: graphics quality, audio levels (master/music/sfx/ambience),
  mouse sensitivity, invert Y, reduced motion, reduced particles, high contrast,
  subtitles, key bindings.

Per-frame values (player position, velocity) live in refs inside controllers, not in
React state, so the render loop never causes React re-renders. Progress and settings
are persisted to `localStorage` under versioned keys (`portal-hub:progress:v1`,
`portal-hub:settings:v1`); a failed read falls back to defaults.

## 7. Asset-loading strategy

1. **Landing** ships only React + the landing UI (small). No three.js.
2. **Enter Portfolio** downloads the `GameShell` chunk (three, R3F) and the Hub chunk.
3. **Firing a portal** starts `import()` of the destination chunk, hidden behind the
   portal opening animation (≈1.5 s). Crossing waits for it only if still loading,
   showing a destination-themed loader.
4. All asset URLs live in `src/assets/manifest.ts`. Project screenshots are plain
   static files loaded by `<img>` in the inspector only when opened.
5. When real models arrive: GLB with Meshopt compression, KTX2 textures, loaded by
   `useGLTF` per world so they are released with the world. Instanced meshes for
   repeated props (asteroids already use `InstancedMesh`).

The vertical slice uses procedural geometry and shaders only, so there are no
binary assets to download for the Hub or the Space world.

## 8. Performance strategy

* Targets: 60 fps on integrated laptop GPUs at Medium; under 250 KB gzip before
  entering the game; each world chunk under 150 KB gzip before art.
* Quality presets Low / Medium / High / Ultra control pixel ratio cap, shadow maps,
  star and particle counts, asteroid count, Earth shader detail and (later) bloom.
* Automatic detection: WebGL2 availability, `hardwareConcurrency`, device memory and
  a mobile check pick the initial preset; drei `PerformanceMonitor` steps down when
  frame rate drops.
* Draw calls kept low with `InstancedMesh`, merged static geometry, few lights
  (Hub: one hemisphere + a few emissive strips + one shadow-casting light on High+).
* Debug overlay (backtick key, or `?debug` in production) shows FPS, frame time,
  draw calls, triangles, geometries, textures, world and positions, so repeated
  world switches can be checked for leaks.

## 9. Portal implementation strategy

* **Aim**: the Hub controller raycasts from the camera centre against meshes tagged
  `userData.portalSurface`. The crosshair turns into the destination symbol when a
  valid surface is under it; surfaces have a faint grid that brightens when aimed at.
* **Fire**: a projectile travels from the launcher to the hit point (≈0.25 s), then
  the portal is placed flush with the surface and expands with an eased scale.
* **Window effect**: an optimized illusion rather than a second render pass. The
  portal disc uses a fragment shader that draws a parallax preview of the
  destination (for Data Science: star field, nebula and the Earth's limb scrolling
  with view angle) inside a distorted swirling rim. It costs one draw call.
  A true render-to-texture view is possible later on Ultra.
* **Cross**: when the player enters the portal's trigger volume, the transition
  starts: tunnel/chromatic overlay, audio crossfade, world swap, reveal.
* **Return**: in any world, holding **R** for 0.8 s opens a return portal in front of
  the player; the pause menu also has "Return to Hub".

## 10. Physics strategy

* **Hub**: kinematic first-person movement with acceleration/friction, circle-vs-box
  collision against the room bounds and the central console.
* **Space**: custom zero-g integrator in `JetpackController.ts` (pure function, unit
  tested): thrust acceleration, soft speed cap, linear damping for inertia, boost with
  cooldown, bounds on a 2D plane, and soft sphere collision with asteroids.
* **Bedroom**: kinematic again, with raycast pickup.
* **Software world**: Rapier (lazy loaded with that world only) for vehicles and
  terrain, created when the world mounts and destroyed when it unmounts.
* **Journey**: kinematic tile/nav-mesh movement.

## 11. Content schema

All content is JSON in `src/content`, typed by `src/content/schema.ts`:

```ts
interface PortfolioProject {
  id: string; title: string;
  category: 'data-science' | 'games' | 'software' | 'journey';
  shortDescription: string; description: string;
  technologies: string[]; screenshots: string[];
  githubUrl?: string; demoUrl?: string; videoUrl?: string; downloadUrl?: string;
  featured: boolean;
  world: WorldId; location?: string;          // which site in the world hosts it
  technicalDetails?: { problem?; dataset?; approach?; architecture?; challenges?: string[]; results?: string[] };
  visualization?: { kind: 'scatter' | 'bars' | 'line'; label: string; points: number[][] };
}
```

Plus `profile.json` (name, title, summary, links, email), `skills.json`,
`experience.json`, `education.json`, `achievements.json` and `dialogue.json`
(`{ question, answer, category }`). Project files are discovered with
`import.meta.glob`, so adding a project means adding one JSON file (and optionally
media). A project with a `location` matching a site in its world appears there; one
without a location still appears in the menus and Quick Portfolio.

## 12. Development roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 0 Architecture | This document, Vite/TS/R3F app, stores, content, input, audio, settings, world registry, debug overlay, CI deploy | In this PR |
| 1 Portal Hub MVP | First-person lab, launcher, selector, aim + fire + portal, interaction system, transition, Quick Portfolio, pause menu, resume terminal | In this PR |
| 2 Data Science MVP | Space, Earth, astronaut, jetpack, 2.5D movement, nav arrows, asteroid lab, station, real project, inspector, return portal | In this PR |
| 3 Game Room | Bedroom, pickup/inspect, CRT, console menu, Space Duel and Flappy rebuilt for the TV with original vector art (the old ports' sprites were not reused because their licences are unclear) | Done (draft PR #2) |
| 4 Software world | Garage, compact test map, sports car + bicycle, billboard, Rapier | Later |
| 5 Journey world | HD-2D style, home, NPCs, dialogue, timeline town | Later |
| 6–9 | Content, polish, optimization, cross-browser testing | Ongoing |

## 13. MVP definition (first milestone)

A visitor can: open the site and see name + three choices; open Quick Portfolio and
read everything without WebGL; enter the Hub, look around and move; choose
**Data Science** on the launcher; aim at a wall and fire; watch the portal open; walk
through; fly the astronaut with inertia; follow an edge arrow to the asteroid lab or
the station; press E to open the holographic inspector for a real project with a
3D data visualization and working links; hold R to open a return portal; and arrive
back in the Hub, where Data Science now shows as visited. It works with pointer lock
or click-and-drag look, keyboard-only menus, and survives repeated round trips.

## 14. Risks

* **Scope.** Four worlds of indie-game quality is a lot; the vertical-slice rule and
  primitives-first art keep it moving.
* **Performance on integrated GPUs**, especially the Earth shader and the portal
  shader on high-DPI screens: capped pixel ratio and presets.
* **Pointer lock** is unavailable in some embeds and browsers: drag-to-look fallback
  and arrow-key turning.
* **Recruiter friction**: mitigated by the Quick Portfolio button on the landing
  screen, the Tab shortcut everywhere and the indexable HTML.
* **Content thinness**: several projects are older learning projects; the schema
  makes it cheap to add better ones as they are finished.
* **Vehicle physics** can swallow time; it is deliberately last among the worlds.

## 15. Unknowns

* Which Data Science projects Jose wants featured beyond the current three, and
  whether any have metrics or datasets to visualize for real.
* Final art direction (stylized low-poly vs. more realistic) and whether commissioned
  or CC0 models will be used.
* Whether Jose wants the family NPCs at all, and how they should look.
* LinkedIn/email preferences for the contact panel (email currently shown, since it
  was public on the old site).
* Whether Pirate Platformer etc. should run inside the CRT (iframe) or full screen.

## 16. Asset requirements

For the slice: none (procedural). Later, all original or CC0:

* Hub: lab kit (panels, pipes, consoles), launcher model, portal sound set.
* Space: astronaut GLB with idle/thrust clips, satellite, station, asteroid set,
  Earth albedo/night/cloud textures (NASA Blue Marble is public domain).
* Game Room: bedroom furniture, CRT, fictional console, box art for Jose's games. All drawn procedurally in `src/worlds/games/textures.ts`; sounds are synthesized.
* Software: eight vehicles, road/terrain kit, billboards.
* Journey: pixel-art character sheets (Jose, spouse, toddler, dog), town buildings.
* Audio: per-world ambience loops (currently synthesized), UI SFX.

Every third-party asset is recorded in `docs/ASSETS.md` with source and licence.
