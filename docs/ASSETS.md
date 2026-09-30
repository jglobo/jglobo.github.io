# Assets and licences

Every asset used by the game is listed here with its source and licence.

| Asset | Where | Source | Licence |
| --- | --- | --- | --- |
| Hub room, launcher, portal, astronaut, Earth, stars, nebula, asteroids, station, satellite | Generated in code (`src/worlds/**`, GLSL in components) | Original, written for this project | Same as the repository |
| All sound (ambience, portal, jetpack, UI) | Synthesized at runtime (`src/engine/audio/AudioManager.ts`) | Original | Same as the repository |
| Project screenshots and GIFs (`images/`) | Quick Portfolio, inspector | Jose's own project captures | Jose Lobo |
| Portrait (`images/portphoto.jpg`) | Quick Portfolio "About" | Jose's own photo | Jose Lobo |
| Fonts | System font stack, no downloads | n/a | n/a |

When adding third-party models, textures or audio, prefer CC0 (e.g. Kenney, Poly Haven, NASA public-domain imagery), add them to
`src/assets/manifest.ts`, and add a row here with the exact source URL and licence.
