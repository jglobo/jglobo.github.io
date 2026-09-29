# Portfolio Website created using HTML, CSS, and Javascript
 - Included the projects I wanted to showcase but will update them as I improve them.
 - Will upload better projects once I finish them.
 - My games are created with python using pygame, except for Snake(I used html with JavaScripted into the html file)
 - My contact form uses a thirdparty site to directly connect to my personal email.
 - I used personal images, and some googled images to enhance my site. I plan on learning on how to make my own pixel and texture art so that one day I can improve my website to a more desired theme of my choice.

## Portfolio Island (3D game)
 - The home page (`index.html`) is now a small third-person game built with Three.js, loaded from a CDN, so there is still no build step.
 - All projects, text and links shown in the game live in `game/content.js`; `game/world.js` builds the island, `game/main.js` runs the player and camera, `game/ui.js` handles cards, menu and touch controls.
 - The original site lives at `/classic/`, linked from the game's top bar and intro screen.
 - To try it locally, serve the folder (for example `python3 -m http.server`) and open http://localhost:8000.
