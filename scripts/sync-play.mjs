// Copies Jose's browser games from local clones of their repos into play/<id>/, so the
// portfolio can run them in the Retro Bedroom (desk computer and TV) and link to them.
// Only the files each game needs at runtime are copied: no servers, tools or tests.
//
//   node scripts/sync-play.mjs <folder with the clones>
//
// e.g. git clone https://github.com/jglobo/Hoops ../games/Hoops (same for Tetris-Clone
// and Ant-Farm), then: node scripts/sync-play.mjs ../games
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const GAMES = {
  'neon-blocks': {
    repo: 'Tetris-Clone',
    // Same file list as the repo's own scripts/stage-public.mjs.
    files: [
      'index.html', 'styles/main.css', 'src/audio.js', 'src/hud.js', 'src/input.js', 'src/main.js', 'src/tetris.js',
      'src/scene/blocks.js', 'src/scene/palette.js', 'src/scene/particles.js', 'src/scene/renderer.js',
      'vendor/three/three.module.js', 'vendor/three/jsm/environments/RoomEnvironment.js',
      'vendor/three/jsm/geometries/RoundedBoxGeometry.js', 'vendor/three/jsm/postprocessing/EffectComposer.js',
      'vendor/three/jsm/postprocessing/MaskPass.js', 'vendor/three/jsm/postprocessing/OutputPass.js',
      'vendor/three/jsm/postprocessing/Pass.js', 'vendor/three/jsm/postprocessing/RenderPass.js',
      'vendor/three/jsm/postprocessing/ShaderPass.js', 'vendor/three/jsm/postprocessing/UnrealBloomPass.js',
      'vendor/three/jsm/shaders/CopyShader.js', 'vendor/three/jsm/shaders/LuminosityHighPassShader.js',
      'vendor/three/jsm/shaders/OutputShader.js',
    ],
  },
  hoops: { repo: 'Hoops', files: ['index.html', 'styles.css', 'physics.js', 'game.js'] },
  'ant-farm': { repo: 'Ant-Farm', files: ['index.html', 'css/style.css', ...['util', 'pixel', 'world', 'entities', 'catalog', 'ants', 'events', 'ui', 'game', 'main'].map((f) => `js/${f}.js`)] },
};

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/sync-play.mjs <folder with the game clones>');
  process.exit(1);
}
for (const [id, { repo, files }] of Object.entries(GAMES)) {
  const from = path.join(src, repo);
  if (!existsSync(from)) {
    console.warn(`skip ${id}: ${from} not found`);
    continue;
  }
  const to = path.join('play', id);
  rmSync(to, { recursive: true, force: true });
  for (const f of files) {
    mkdirSync(path.dirname(path.join(to, f)), { recursive: true });
    cpSync(path.join(from, f), path.join(to, f));
  }
  console.log(`play/${id}: ${files.length} files from ${repo}`);
}
console.log('Folders now in play/:', readdirSync('play').join(', '));
