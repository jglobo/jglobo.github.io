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
