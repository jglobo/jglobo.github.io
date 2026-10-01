// Quick Portfolio: the whole portfolio as plain, fast, accessible HTML. Available
// from the landing page, the HUD button and Tab, with or without WebGL.
import { useEffect, useRef, useState } from 'react';
import { achievements, education, experience, profile, projectsByCategory, skills, type ProjectCategory } from '../content';
import { useGame, type QuickSection } from '../stores/gameStore';
import { assets } from '../assets/manifest';
import { track } from '../analytics/track';
import { ExtLink, ProjectDetails } from './ProjectDetails';

const SECTIONS: { id: QuickSection; label: string }[] = [
  { id: 'about', label: 'About' },
  { id: 'data-science', label: 'Data Science' },
  { id: 'games', label: 'Games' },
  { id: 'software', label: 'Software' },
  { id: 'experience', label: 'Experience' },
  { id: 'resume', label: 'Resume' },
  { id: 'contact', label: 'Contact' },
];

export function QuickPortfolio() {
  const open = useGame((s) => s.overlay === 'quick');
  const section = useGame((s) => s.quickSection);
  const started = useGame((s) => s.started);
  const notice = useGame((s) => s.notice);
  const firstButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      track('quick_portfolio_opened', { section });
      firstButton.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const go = (id: QuickSection) => useGame.setState({ quickSection: id });
  const close = () => useGame.getState().closeOverlay();

  return (
    <div className="quick" role="dialog" aria-modal="true" aria-labelledby="quick-title">
      <aside className="quick-nav">
        <div className="quick-brand">
          <h2 id="quick-title">{profile.name}</h2>
          <p>{profile.title}</p>
        </div>
        <nav aria-label="Portfolio sections">
          {SECTIONS.map((s, i) => (
            <button
              key={s.id}
              ref={i === 0 ? firstButton : undefined}
              className={section === s.id ? 'active' : ''}
              aria-current={section === s.id ? 'page' : undefined}
              onClick={() => go(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <button className="btn primary quick-close" onClick={close}>
          {started ? 'Back to the game' : 'Close'} <kbd>Esc</kbd>
        </button>
      </aside>
      <main className="quick-main">
        {notice && <p className="quick-hint">{notice}</p>}
        {section === 'about' && <About />}
        {(section === 'data-science' || section === 'games' || section === 'software') && <ProjectList category={section as ProjectCategory} />}
        {section === 'experience' && <ExperienceSection />}
        {section === 'resume' && <ResumeSection />}
        {section === 'contact' && <ContactSection />}
      </main>
    </div>
  );
}

function About() {
  return (
    <section>
      <h3>About</h3>
      <div className="about">
        <img src={assets.portrait} alt={`Portrait of ${profile.name}`} className="portrait" onError={(e) => (e.currentTarget.style.display = 'none')} />
        <div>
          <p className="lede">{profile.tagline}</p>
          <p>{profile.summary}</p>
          <div className="project-links">
            <ExtLink href={assets.resumePdf} event="resume_opened" className="btn primary">Resume (PDF)</ExtLink>
            <ExtLink href={profile.links.github} event="github_clicked">GitHub ↗</ExtLink>
            <ExtLink href={profile.links.linkedin} event="contact_clicked">LinkedIn ↗</ExtLink>
          </div>
        </div>
      </div>
      <h4>Skills</h4>
      <dl className="skills">
        {skills.map((g) => (
          <div key={g.group}>
            <dt>{g.group}</dt>
            <dd className="chips">{g.items.map((i) => <span className="chip" key={i}>{i}</span>)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ProjectList({ category }: { category: ProjectCategory }) {
  const list = projectsByCategory(category);
  const discovered = useGame((s) => s.discoveredProjects);
  const [openId, setOpenId] = useState<string | null>(list[0]?.id ?? null);
  const title = { 'data-science': 'Data Science', games: 'Games', software: 'Software', journey: 'Journey' }[category];
  return (
    <section>
      <h3>{title}</h3>
      <div className="project-list">
        {list.map((p) => (
          <article key={p.id} className={`project-card ${openId === p.id ? 'open' : ''}`}>
            <button className="project-card-head" aria-expanded={openId === p.id} onClick={() => setOpenId(openId === p.id ? null : p.id)}>
              <span>
                <strong>{p.title}</strong>
                <span className="muted"> · {p.technologies.slice(0, 3).join(', ')}</span>
              </span>
              <span className={`badge ${discovered.includes(p.id) ? 'found' : ''}`}>
                {discovered.includes(p.id) ? 'Found in game' : 'Not yet found in game'}
              </span>
            </button>
            {openId === p.id && <ProjectDetails project={p} />}
          </article>
        ))}
      </div>
    </section>
  );
}

function ExperienceSection() {
  return (
    <section>
      <h3>Experience</h3>
      <ol className="timeline">
        {experience.map((e) => (
          <li key={e.id}>
            <strong>{e.role}</strong> · {e.org} <span className="muted">({e.when})</span>
            <p>{e.summary}</p>
            {e.highlights && e.highlights.length > 0 && (
              <ul className="highlights">
                {e.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      <h4>Education</h4>
      <ul className="timeline">
        {education.map((e) => (
          <li key={e.id}>
            <strong>{e.institution}</strong> <span className="muted">({e.when})</span>
            <p>{e.credential}</p>
          </li>
        ))}
      </ul>
      <h4>Certifications</h4>
      <ul className="certs">
        {achievements.map((a) => (
          <li key={a.title}>
            {a.title} <span className="muted">· {a.from}, {a.when}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResumeSection() {
  return (
    <section>
      <h3>Resume</h3>
      <div className="project-links">
        <ExtLink href={assets.resumePdf} event="resume_opened" className="btn primary">Open PDF ↗</ExtLink>
        <ExtLink href={assets.resumeDocx} event="resume_opened" download>Download DOCX</ExtLink>
      </div>
      <object className="resume-frame" data={assets.resumePdf} type="application/pdf" aria-label="Resume PDF">
        <p>Your browser can't show the PDF inline. Use the button above to open it.</p>
      </object>
    </section>
  );
}

function ContactSection() {
  const [copied, setCopied] = useState(false);
  return (
    <section>
      <h3>Contact</h3>
      <p>The quickest way to reach me is email. I'm happy to talk about data, games, software or a role on your team.</p>
      <div className="contact-grid">
        <a className="contact-card" href={`mailto:${profile.email}`} onClick={() => track('contact_clicked', { via: 'email' })}>
          <span className="contact-kind">Email</span>
          <span>{profile.email}</span>
        </a>
        <ExtLink href={profile.links.github} event="github_clicked" className="contact-card">
          <span className="contact-kind">GitHub</span>
          <span>github.com/jglobo</span>
        </ExtLink>
        <ExtLink href={profile.links.linkedin} event="contact_clicked" className="contact-card">
          <span className="contact-kind">LinkedIn</span>
          <span>Jose Lobo</span>
        </ExtLink>
        <ExtLink href={assets.resumePdf} event="resume_opened" className="contact-card">
          <span className="contact-kind">Resume</span>
          <span>PDF</span>
        </ExtLink>
      </div>
      <button
        className="btn"
        onClick={() => {
          navigator.clipboard?.writeText(profile.email).then(() => setCopied(true), () => {});
        }}
      >
        {copied ? 'Email copied' : 'Copy email address'}
      </button>
      <p className="muted small">
        Prefer the old site? <a href={`${import.meta.env.BASE_URL}${profile.links.classicSite}`}>Classic portfolio</a>
      </p>
    </section>
  );
}
