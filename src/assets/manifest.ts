// Every asset URL the game uses lives here. The vertical slice is procedural
// (geometry + shaders + synthesized audio), so the only files are the existing
// portfolio images and downloads. Sources and licences: docs/ASSETS.md.
import { assetUrl } from '../content';

export const assets = {
  resumePdf: assetUrl('Jose_Lobo_pdf_Resume.pdf'),
  resumeDocx: assetUrl('JoseLoboPortfolioResume.docx'),
  portrait: assetUrl('images/portphoto.jpg'),
  logo: assetUrl('images/logo.png'),
  // Future binary assets, e.g.:
  // astronaut: assetUrl('assets/models/astronaut.glb'),
  // earthAlbedo: assetUrl('assets/textures/earth_albedo.ktx2'),
} as const;
