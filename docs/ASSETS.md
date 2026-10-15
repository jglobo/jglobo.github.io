# Assets and licences

Every asset used by the game is listed here with its source and licence.

| Asset | Where | Source | Licence |
| --- | --- | --- | --- |
| Hub room, launcher, portal, Earth, stars, nebula, asteroids, station, satellite | Generated in code (`src/worlds/**`, GLSL in components) | Original, written for this project | Same as the repository |
| Journey world pixel-art characters (visitor robot, Jose, his wife and son, dog), town textures, signs | Drawn in code (`src/worlds/journey/sprites/pixelArt.ts`, `src/worlds/journey/textures.ts`) | Original, written for this project | Same as the repository |
| All sound (ambience, portal, jetpack, UI) | Synthesized at runtime (`src/engine/audio/AudioManager.ts`) | Original | Same as the repository |
| Project screenshots and GIFs (`images/`) | Quick Portfolio, inspector | Jose's own project captures | Jose Lobo |
| Portrait (`images/portphoto.jpg`) | Quick Portfolio "About" | Jose's own photo | Jose Lobo |
| New project screenshots (`images/neonblocks.jpg`, `hoops.jpg`, `breathingapp.jpg`, `digitalclock.jpg`, `antfarm.png`) | Quick Portfolio, inspector, billboards | Captured from Jose's own repos (Ant Farm image is from its `shots/` folder) | Jose Lobo |
| Astronaut model and its six flight animations (`src/worlds/data-science/assets/astronaut.glb`), loaded by his controller (`astronautController.ts`) | Data Science world player | Jose's own model, made in Blender | Jose Lobo |
| Browser games in `play/` (Neon Blocks, Hoops, Ant Farm) | Desk computer and TV in the Games world | Jose's own repos; Neon Blocks bundles three.js (MIT) | Jose Lobo; three.js MIT |
| Fonts | System font stack, no downloads | n/a | n/a |

When adding third-party models, textures or audio, prefer CC0 (e.g. Kenney, Poly Haven, NASA public-domain imagery), add them to
`src/assets/manifest.ts`, and add a row here with the exact source URL and licence.
