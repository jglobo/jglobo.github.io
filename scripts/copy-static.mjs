// Copies the files that are served as-is (old site, images, game downloads, resume)
// into dist/ after the Vite build, so they keep their current URLs.
import { cpSync, existsSync } from 'node:fs';

const items = ['classic', 'images', 'Games', 'Jose_Lobo_pdf_Resume.pdf', 'JoseLoboPortfolioResume.docx', '.nojekyll'];
for (const item of items) {
  if (existsSync(item)) cpSync(item, `dist/${item}`, { recursive: true });
}
console.log('Copied static files:', items.filter(existsSync).join(', '));
