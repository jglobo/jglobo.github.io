// Vite plugin: renders the portfolio content JSON into plain HTML inside index.html so
// search engines and visitors without JavaScript get the whole portfolio.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

export function seoContent(root = 'src/content'): Plugin {
  return {
    name: 'portfolio-seo-content',
    transformIndexHtml(html) {
      const profile = read(join(root, 'profile.json'));
      const skills = read(join(root, 'skills.json')) as { group: string; items: string[] }[];
      const experience = read(join(root, 'experience.json')) as { role: string; org: string; when: string; summary: string }[];
      const education = read(join(root, 'education.json')) as { institution: string; credential: string; when: string }[];
      const sections = [
        ['data-science', 'Data Science'],
        ['games', 'Games'],
        ['software', 'Software'],
      ] as const;
      const projectHtml = sections
        .map(([dir, title]) => {
          const files = readdirSync(join(root, dir)).filter((f) => f.endsWith('.json'));
          const items = files
            .map((f) => read(join(root, dir, f)))
            .map((p) => {
              const link = p.demoUrl ?? p.githubUrl ?? p.downloadUrl;
              const name = link ? `<a href="${esc(link)}">${esc(p.title)}</a>` : esc(p.title);
              return `<li><strong>${name}</strong>: ${esc(p.shortDescription)} <em>(${esc(p.technologies.join(', '))})</em></li>`;
            })
            .join('');
          return `<h3>${title}</h3><ul>${items}</ul>`;
        })
        .join('');
      const content = `
      <h1>${esc(profile.name)}</h1>
      <p><strong>${esc(profile.title)}</strong></p>
      <p>${esc(profile.summary)}</p>
      <h2>Projects</h2>${projectHtml}
      <h2>Experience</h2><ul>${experience.map((e) => `<li><strong>${esc(e.role)}</strong>, ${esc(e.org)} (${esc(e.when)}): ${esc(e.summary)}</li>`).join('')}</ul>
      <h2>Education</h2><ul>${education.map((e) => `<li>${esc(e.institution)}: ${esc(e.credential)} (${esc(e.when)})</li>`).join('')}</ul>
      <h2>Skills</h2><ul>${skills.map((s) => `<li>${esc(s.group)}: ${esc(s.items.join(', '))}</li>`).join('')}</ul>
      <h2>Contact</h2>
      <p><a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a> · <a href="${esc(profile.links.github)}">GitHub</a> · <a href="${esc(profile.links.linkedin)}">LinkedIn</a> · <a href="${esc(profile.links.resumePdf)}">Resume (PDF)</a> · <a href="${esc(profile.links.classicSite)}">Classic site</a></p>`;
      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: profile.name,
        jobTitle: profile.title,
        description: profile.tagline,
        url: 'https://jglobo.github.io/',
        sameAs: [profile.links.github, profile.links.linkedin],
        knowsAbout: skills.flatMap((s) => s.items).slice(0, 20),
      };
      return html
        .replace('<!--SEO_CONTENT-->', content)
        .replace('<!--SEO_JSONLD-->', `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`);
    },
  };
}
