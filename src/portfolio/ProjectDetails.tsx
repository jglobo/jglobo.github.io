// One renderer for a project's content, used by the in-world inspector (themed per
// world) and by the Quick Portfolio. Missing links/media are simply hidden.
import { useState } from 'react';
import { assetUrl, type PortfolioProject, type ProjectVisualization } from '../content';
import { track, type AnalyticsEvent } from '../analytics/track';
import { correlatedPoints } from '../utils/random';

export function ExtLink({ href, event, children, className = 'btn', download }: { href: string; event?: AnalyticsEvent; children: React.ReactNode; className?: string; download?: boolean }) {
  const external = /^https?:/.test(href);
  return (
    <a
      className={className}
      href={external ? href : assetUrl(href)}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      download={download || undefined}
      onClick={() => event && track(event, { href })}
    >
      {children}
    </a>
  );
}

export function ProjectLinks({ project }: { project: PortfolioProject }) {
  return (
    <div className="project-links">
      {project.demoUrl && <ExtLink href={project.demoUrl} event="demo_clicked" className="btn primary">Live demo ↗</ExtLink>}
      {project.githubUrl && <ExtLink href={project.githubUrl} event="github_clicked">Source code ↗</ExtLink>}
      {project.videoUrl && <ExtLink href={project.videoUrl} event="demo_clicked">Video ↗</ExtLink>}
      {project.downloadUrl && <ExtLink href={project.downloadUrl} event="game_played" download>Download build</ExtLink>}
    </div>
  );
}

function Screenshot({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img className="shot" src={assetUrl(src)} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

export function ProjectDetails({ project }: { project: PortfolioProject }) {
  const d = project.technicalDetails;
  return (
    <div className="project-details">
      <p className="lede">{project.shortDescription}</p>
      <ProjectLinks project={project} />
      <p>{project.description}</p>
      {project.screenshots.length > 0 && (
        <div className="shots">
          {project.screenshots.map((s) => (
            <Screenshot key={s} src={s} alt={`${project.title} screenshot`} />
          ))}
        </div>
      )}
      {d && (
        <dl className="tech-details">
          {d.problem && (<><dt>Problem</dt><dd>{d.problem}</dd></>)}
          {d.dataset && (<><dt>Dataset</dt><dd>{d.dataset}</dd></>)}
          {d.approach && (<><dt>Approach</dt><dd>{d.approach}</dd></>)}
          {d.architecture && (<><dt>Architecture</dt><dd>{d.architecture}</dd></>)}
          {d.challenges?.length ? (<><dt>Challenges</dt><dd><ul>{d.challenges.map((c) => <li key={c}>{c}</li>)}</ul></dd></>) : null}
          {d.results?.length ? (<><dt>Results</dt><dd><ul>{d.results.map((c) => <li key={c}>{c}</li>)}</ul></dd></>) : null}
        </dl>
      )}
      {project.visualization && <MiniChart viz={project.visualization} />}
      <div className="chips" aria-label="Technologies">
        {project.technologies.map((t) => (
          <span className="chip" key={t}>{t}</span>
        ))}
      </div>
    </div>
  );
}

/** Small SVG version of the in-world hologram, readable without WebGL. */
export function MiniChart({ viz }: { viz: ProjectVisualization }) {
  const W = 320;
  const H = 180;
  const pad = 24;
  let body: React.ReactNode = null;
  if (viz.kind === 'scatter') {
    const pts = correlatedPoints(viz.seed ?? 1, viz.count ?? 60, viz.correlation ?? 0.5);
    body = pts.map(([x, y], i) => <circle key={i} cx={pad + x * (W - pad * 2)} cy={H - pad - y * (H - pad * 2)} r={3} />);
  } else if (viz.kind === 'bars') {
    const v = viz.values ?? [];
    const bw = (W - pad * 2) / v.length;
    body = v.map((val, i) => (
      <g key={i}>
        <rect x={pad + i * bw + bw * 0.2} y={H - pad - val * (H - pad * 2)} width={bw * 0.6} height={val * (H - pad * 2)} rx={2} />
        {viz.categories?.[i] && <text x={pad + i * bw + bw / 2} y={H - 8} textAnchor="middle">{viz.categories[i]}</text>}
      </g>
    ));
  } else {
    const v = viz.values ?? [];
    const pts = v.map((val, i) => `${pad + (i / Math.max(1, v.length - 1)) * (W - pad * 2)},${H - pad - val * (H - pad * 2)}`).join(' ');
    body = <polyline points={pts} fill="none" strokeWidth={2.5} />;
  }
  return (
    <figure className="mini-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={viz.label}>
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} className="axis" />
        <line x1={pad} y1={pad} x2={pad} y2={H - pad} className="axis" />
        {body}
      </svg>
      <figcaption>
        {viz.label}
        {viz.illustrative && <span className="muted"> · illustrative shape, see the project for real figures</span>}
      </figcaption>
    </figure>
  );
}
