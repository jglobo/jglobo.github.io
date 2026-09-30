// Loads every content file. Adding a project = adding a JSON file to one of the
// category folders; nothing else needs to change.
import profileJson from './profile.json';
import skillsJson from './skills.json';
import experienceJson from './experience.json';
import educationJson from './education.json';
import achievementsJson from './achievements.json';
import dialogueJson from './dialogue.json';
import type {
  Achievement, DialogueLine, Education, Experience, PortfolioProject, Profile, ProjectCategory, SkillGroup,
} from './schema';

export * from './schema';

export const profile = profileJson as Profile;
export const skills = skillsJson as SkillGroup[];
export const experience = experienceJson as Experience[];
export const education = educationJson as Education[];
export const achievements = achievementsJson as Achievement[];
export const dialogue = dialogueJson as DialogueLine[];

const modules = import.meta.glob<PortfolioProject>('./{data-science,games,software,journey}/*.json', {
  eager: true,
  import: 'default',
});

export const projects: PortfolioProject[] = Object.values(modules).sort(
  (a, b) => Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title),
);

export const projectsByCategory = (category: ProjectCategory) => projects.filter((p) => p.category === category);
export const projectById = (id: string) => projects.find((p) => p.id === id);
export const projectAtLocation = (world: string, location: string) =>
  projects.find((p) => p.world === world && p.location === location);

/** Resolve a repo-relative asset path (e.g. "images/x.png") against the site base. */
export const assetUrl = (path: string) =>
  /^(https?:|mailto:|data:)/.test(path) || path.startsWith(import.meta.env.BASE_URL) ? path : `${import.meta.env.BASE_URL}${path}`;
