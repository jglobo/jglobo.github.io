export type WorldId = 'hub' | 'data-science' | 'games' | 'software' | 'journey';
export type ProjectCategory = 'data-science' | 'games' | 'software' | 'journey';

export interface ProjectVisualization {
  kind: 'scatter' | 'bars' | 'line';
  label: string;
  /** True when the chart shows the shape of a result rather than the real data. */
  illustrative?: boolean;
  xLabel?: string;
  yLabel?: string;
  /** scatter: generated deterministically from seed/count/correlation */
  seed?: number;
  count?: number;
  correlation?: number;
  /** bars / line: normalized 0..1 values */
  values?: number[];
  categories?: string[];
}

export interface PortfolioProject {
  id: string;
  title: string;
  category: ProjectCategory;
  shortDescription: string;
  description: string;
  technologies: string[];
  screenshots: string[];
  githubUrl?: string;
  demoUrl?: string;
  videoUrl?: string;
  downloadUrl?: string;
  featured: boolean;
  world: WorldId;
  /** Lists sort by this first (lower comes first); projects without it follow, featured first. */
  order?: number;
  /** Id of the site inside the world that hosts this project. */
  location?: string;
  technicalDetails?: {
    problem?: string;
    dataset?: string;
    approach?: string;
    architecture?: string;
    challenges?: string[];
    results?: string[];
  };
  visualization?: ProjectVisualization;
  /** Games world: id of the built-in TV version of this game, if there is one. */
  crtGame?: 'space-duel' | 'flappy';
  /** Games world: box art colours. */
  boxColor?: string;
  /** A copy of the game bundled with this site (play/<id>/), see scripts/sync-play.mjs. */
  playUrl?: string;
  /** Games world: where the bundled copy runs, the TV (insert the box) or the desk computer. */
  playOn?: 'tv' | 'pc';
}

export interface Profile {
  name: string;
  title: string;
  tagline: string;
  summary: string;
  email: string;
  location?: string;
  links: Record<'github' | 'linkedin' | 'codepen' | 'tableau' | 'freecodecamp' | 'resumePdf' | 'resumeDocx' | 'classicSite', string>;
}

export interface SkillGroup { group: string; items: string[] }
export interface Experience { id: string; role: string; org: string; when: string; summary: string; highlights?: string[]; technologies: string[] }
export interface Education { id: string; institution: string; credential: string; when: string }
export interface Achievement { when: string; title: string; from: string }
export interface DialogueLine { question: string; answer: string; category: string }

/** Journey world: a building on the timeline path. Order in journey.json = chronology. */
export interface JourneyStop {
  id: string;
  label: string;
  year: string;
  district: 'old-town' | 'island' | 'market' | 'healthcare' | 'data' | 'tech';
  building: 'campus' | 'clinic' | 'market' | 'lab' | 'library' | 'office' | 'tower';
  /** ids from education.json / experience.json shown in this stop's memory. */
  education?: string[];
  experience?: string[];
  /** Also list the certifications (achievements.json) from this issuer. */
  certificationsFrom?: string;
  story: string;
}

export interface JourneyNpc {
  id: string;
  name: string;
  kind: 'person' | 'dog';
  greeting?: string;
  lines?: string[];
}

export interface JourneyContent { npcs: JourneyNpc[]; stops: JourneyStop[] }

export interface Resume {
  name: string;
  contact: string[];
  summary: string;
  experience: { org: string; role: string; dates: string; note?: string; bullets: string[] }[];
  /** [group, comma-separated items] */
  skills: [string, string][];
  /** [credential, institution and details] */
  education: [string, string][];
  certifications: string[];
  clinical: string[];
  volunteer: string[];
  presentations: string[];
}
