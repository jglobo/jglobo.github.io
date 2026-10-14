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
| Game Development: Retro Bedroom (first person, playable TV games) | Playable |
| Software Engineering: Vehicle Playground (elevated third person, sports car + bicycle) | Playable |
| My Journey: HD-2D Life Town (pixel-art characters in a 3D town, dialogue, career timeline) | Playable |

The original 2021 site lives on at [`/classic/`](classic/).

## Run it locally

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173 (debug overlay on; press ` to toggle)
npm test           # unit tests (physics, layouts, sprites, dialogue)
npm run build      # production build into dist/
npm run preview    # serve the production build at http://localhost:4173
```

Add `?debug` to a production URL to see FPS, draw calls, memory and world teleports.

## Controls

* **Hub**: WASD move, mouse look (click to capture, or drag), `1`–`4` or scroll to pick a
  destination, click to fire a portal, `E` interact, `Shift` sprint.
* **Orbital world**: WASD / arrows fly the jetpack, `Shift` boost, `E` inspect a site,
  hold `R` to summon a return portal.
* **Retro Bedroom**: WASD walk, mouse look, look at a game box on the shelf and press `E`
  (or click) to pick it up, drag or WASD to turn it, `E` to play it on the TV, `I` for the
  manual, `Q`/`Esc` to put it down. At the TV: arrows/`W`/`S` and `Enter` in the menu,
  `Esc` to back out or stand up. Walk back into the portal to return to the Hub.
* **Vehicle Playground**: WASD walk, `E` next to the car or bike to ride. Car: `W`/`S`
  gas and brake, `A`/`D` steer, `Space` handbrake to drift. Bicycle: `Space` hops, `A`/`D`
  in the air spins. Drive onto a billboard's glowing pad and press `E` to inspect the
  app; `E` elsewhere gets you off. Hold `R` for a return portal.
* **HD-2D Life Town**: WASD walk, `Shift` run, `E` to talk to Jose, pet the dog, check
  the mailbox or read a building's memory. In a conversation: arrows/`W`/`S` or `1`–`9`
  to pick a question, `E`/`Enter` to ask, `Esc` to leave. In a memory: `←`/`→` for the
  earlier or later chapter. Hold `R` for a return portal, or use the portal at the end
  of the road.
* Everywhere: `Tab` Quick Portfolio, `Esc` menu (worlds map, settings, resume, contact).

## Adding a project

1. Add a JSON file to `src/content/data-science/`, `games/` or `software/`
   (see `src/content/schema.ts` for the fields).
2. Put screenshots in `images/` and list them in `screenshots`.
3. To place it in a world, set `location` to a site id (Data Science sites:
   `asteroid-lab`, `station`, `satellite`). Without a location it still appears in the
   menus and Quick Portfolio.
4. Games appear on the bedroom shelf automatically (featured first). `boxColor` sets the
   box colour, and `crtGame` (`space-duel` or `flappy`) links a built-in TV version.
5. Software projects get a billboard automatically (featured first, up to four spots in
   `src/worlds/software/layout.ts`).

## Editing the Journey world

* `src/content/journey.json` lists the timeline chapters in order (oldest first). Each
  one picks a building style, a district and the `education` / `experience` ids it
  shows, plus a short `story` in Jose's voice. Adding a chapter adds a building further
  up the path automatically.
* `src/content/dialogue.json` holds Jose's questions and answers (`question`, `answer`,
  `category`). Every entry appears in the ASK A QUESTION menu.
* The character looks are palettes in `src/worlds/journey/sprites/pixelArt.ts`
  (`LOOKS`), drawn in code at runtime.

## Deploying

`.github/workflows/deploy.yml` builds the site and deploys `dist/` to GitHub Pages on
every push to `main`. In the repository settings, **Pages → Source** must be set to
**GitHub Actions**.

Architecture and roadmap: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Asset
sources and licences: [`docs/ASSETS.md`](docs/ASSETS.md).

## Updating the resume

The downloadable resume files are generated from `scripts/resume/resume.json`. Edit that file, then run:

```sh
npm install --no-save playwright-core && node scripts/resume/build-pdf.mjs   # Jose_Lobo_pdf_Resume.pdf
python3 -m pip install python-docx && python3 scripts/resume/build-docx.py   # JoseLoboPortfolioResume.docx
```

The site's own text (Quick Portfolio, SEO block) comes from `src/content/*.json`, so update both when your experience changes.
