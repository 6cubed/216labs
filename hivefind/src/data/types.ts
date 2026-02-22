export type MysteryStatus = "unsolved" | "cold_case" | "partially_solved" | "solved";
export type MysteryCategory = "disappearance" | "murder" | "unsolved_death" | "robbery" | "other";

export interface TimelineEvent {
  date: string;
  title: string;
  description: string;
  source?: string;
}

export interface Mystery {
  slug: string;
  title: string;
  subtitle: string;
  status: MysteryStatus;
  category: MysteryCategory;
  country: string;
  region: string;
  date: string;
  year: number;
  summary: string;
  image?: string;
  timeline: TimelineEvent[];
  keyFacts: string[];
  persons: { name: string; role: string }[];
  tags: string[];
}
