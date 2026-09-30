# Jose Lobo · Playable Portfolio

A portfolio that plays like a small indie game. Visitors start in a first-person
**Portal Hub**, pick a destination on a dimensional launcher, fire a portal at a wall
and walk into a world built around one part of my work. A **Quick Portfolio** (button
or `Tab`) shows everything instantly for visitors in a hurry, and the page ships
indexable HTML for search engines and no-JavaScript visitors.

| World | Status |
| --- | --- |
| Portal Hub (first person) | Playable |
| Data Science: Orbital Data World (2.5D jetpack astronaut) | Playable |
| Game Development: Retro Bedroom | Planned |
| Software Engineering: Vehicle Playground | Planned |
| My Journey: HD-2D Life Town | Planned |

The original 2021 site lives on at [`/classic/`](classic/).

## Run it locally

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173 (debug overlay on; press ` to toggle)
npm test           # unit tests (jetpack physics)
npm run build      # production build into dist/
npm run preview    # serve the production build at http://localhost:4173
```

Add `?debug` to a production URL to see FPS, draw calls, memory and world teleports.

## Controls

* **Hub**: WASD move, mouse look (click to capture, or drag), `1`–`4` or scroll to pick a
  destination, click to fire a portal, `E` interact, `Shift` sprint.
* **Orbital world**: WASD / arrows fly the jetpack, `Shift` boost, `E` inspect a site,
  hold `R` to summon a return portal.
* Everywhere: `Tab` Quick Portfolio, `Esc` menu (worlds map, settings, resume, contact).

## Adding a project

1. Add a JSON file to `src/content/data-science/`, `games/` or `software/`
   (see `src/content/schema.ts` for the fields).
2. Put screenshots in `images/` and list them in `screenshots`.
3. To place it in a world, set `location` to a site id (Data Science sites:
   `asteroid-lab`, `station`, `satellite`). Without a location it still appears in the
   menus and Quick Portfolio.

## Deploying

`.github/workflows/deploy.yml` builds the site and deploys `dist/` to GitHub Pages on
every push to `main`. In the repository settings, **Pages → Source** must be set to
**GitHub Actions**.

Architecture and roadmap: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Asset
sources and licences: [`docs/ASSETS.md`](docs/ASSETS.md).
