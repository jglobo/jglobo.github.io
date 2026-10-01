// Renders resume.json to Jose_Lobo_pdf_Resume.pdf (repo root) with headless Chromium.
// Manual tool, not part of the site build:
//   npm install --no-save playwright-core && node scripts/resume/build-pdf.mjs
// Set CHROMIUM_PATH if Chromium is not at the default Playwright location.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = fileURLToPath(new URL('.', import.meta.url));
const r = JSON.parse(readFileSync(here + 'resume.json', 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const list = (items) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: Letter; margin: 0.55in 0.6in; }
  body { font: 10.2pt/1.38 "Helvetica Neue", Arial, sans-serif; color: #1c1c24; margin: 0; }
  h1 { font-size: 22pt; margin: 0; letter-spacing: 0.02em; }
  .contact { color: #444; margin: 2px 0 10px; }
  .contact a { color: #2b5bd7; text-decoration: none; }
  h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: 0.08em; color: #2b5bd7; border-bottom: 1.2px solid #c9d4f2; padding-bottom: 2px; margin: 14px 0 6px; }
  .job { break-inside: avoid; margin-bottom: 8px; }
  .job-head { display: flex; justify-content: space-between; font-weight: 700; }
  .dates { font-weight: 400; color: #555; white-space: nowrap; margin-left: 12px; }
  .note { font-style: italic; color: #555; font-size: 9.2pt; margin: 1px 0 2px; }
  ul { margin: 2px 0 0; padding-left: 16px; }
  li { margin: 1px 0; }
  p { margin: 0; }
  .skills div { margin: 1px 0; }
  .skills b, .edu b { color: #1c1c24; }
  .edu div { margin: 2px 0; }
  .cols { columns: 2; column-gap: 22px; }
  .cols li { break-inside: avoid; }
</style></head><body>
<h1>${esc(r.name)}</h1>
<div class="contact">${r.contact.map((c) => (c.includes('.io') ? `<a href="https://${c}">${c}</a>` : c.includes('@') ? `<a href="mailto:${c}">${c}</a>` : esc(c))).join(' &nbsp;|&nbsp; ')}</div>
<h2>Professional Summary</h2><p>${esc(r.summary)}</p>
<h2>Professional Experience</h2>
${r.experience.map((j) => `<div class="job"><div class="job-head"><span>${esc(j.org)} · ${esc(j.role)}</span><span class="dates">${esc(j.dates)}</span></div>${j.note ? `<div class="note">${esc(j.note)}</div>` : ''}${list(j.bullets)}</div>`).join('')}
<h2>Technical Skills</h2><div class="skills">${r.skills.map(([k, v]) => `<div><b>${esc(k)}:</b> ${esc(v)}</div>`).join('')}</div>
<h2>Education</h2><div class="edu">${r.education.map(([k, v]) => `<div><b>${esc(k)}</b> · ${esc(v)}</div>`).join('')}</div>
<h2>Certifications</h2><div class="cols">${list(r.certifications)}</div>
<h2>Clinical Experience</h2>${list(r.clinical)}
<h2>Volunteer Experience</h2>${list(r.volunteer)}
<h2>Presentations and Lectures</h2>${list(r.presentations)}
</body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.pdf({ path: here + '../../Jose_Lobo_pdf_Resume.pdf', format: 'Letter', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log('wrote Jose_Lobo_pdf_Resume.pdf');
