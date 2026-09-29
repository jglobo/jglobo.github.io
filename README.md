# Portfolio Website created using HTML, CSS, and Javascript
 - Included the projects I wanted to showcase but will update them as I improve them.
 - Will upload better projects once I finish them.
 - My games are created with python using pygame, except for Snake(I used html with JavaScripted into the html file)
 - My contact form uses a thirdparty site to directly connect to my personal email.
 - I used personal images, and some googled images to enhance my site. I plan on learning on how to make my own pixel and texture art so that one day I can improve my website to a more desired theme of my choice.

## Portfolio Town (pixel-art game)
 - The home page (`index.html`) is a small top-down pixel-art game in the style of the Gen-4 handheld RPGs. It is plain JavaScript and Canvas with no build step or libraries, so GitHub Pages serves it as-is.
 - All text, links, the home address, résumé, achievements and project lists live in `game/content.js`. Edit that file to update the portfolio.
 - `game/art.js` draws all the pixel art in code, `game/maps.js` lays out the town and interiors, `game/main.js` runs movement, vehicles and scripts, and `game/ui.js` handles dialog boxes, panels, the arcade host and touch controls.
 - The arcade games in `arcade/` are browser remakes of the Pygame games (Pirate Platformer, Flappy Bird, Space Duel, Pong) using the original art and sounds. Each has a standalone `index.html` too.
 - The mailbox sends messages through FormSubmit to the address in `game/content.js`.
 - The original site lives at `/classic/`.
 - To try it locally, serve the folder (for example `python3 -m http.server`) and open http://localhost:8000.
