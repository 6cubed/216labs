export type Euromaxxer = {
  id: string;
  name: string;
  wikipediaUrl: string;
  shortBio: string;
  countriesStrongTie: string[];
  activeDecades: number;
  crossLinkedTo: string[];
  originCountryAttachment: "low" | "medium" | "high";
  mobilityCommitment: number;
  institutionalImpact: number;
};

export const euromaxxers: Euromaxxer[] = [
  {
    id: "norman-butler",
    name: "Norman Butler",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Norman_Butler_(polo)",
    shortBio:
      "Irish polo player with significant elite network overlap in business and sport circles.",
    countriesStrongTie: ["Ireland", "United Kingdom", "Argentina"],
    activeDecades: 4,
    crossLinkedTo: ["tony-ryan"],
    originCountryAttachment: "medium",
    mobilityCommitment: 8,
    institutionalImpact: 7,
  },
  {
    id: "tony-ryan",
    name: "Tony Ryan",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Tony_Ryan",
    shortBio:
      "Aviation entrepreneur and Ryanair co-founder with high-impact pan-European footprint.",
    countriesStrongTie: ["Ireland", "United Kingdom", "European Union aviation sphere"],
    activeDecades: 5,
    crossLinkedTo: ["norman-butler", "michael-oleary"],
    originCountryAttachment: "medium",
    mobilityCommitment: 9,
    institutionalImpact: 10,
  },
  {
    id: "michael-oleary",
    name: "Michael O'Leary",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Michael_O%27Leary_(businessman)",
    shortBio:
      "Ryanair CEO and major figure in European budget aviation; highly connected but comparatively home-base attached.",
    countriesStrongTie: ["Ireland", "United Kingdom", "European Union aviation sphere"],
    activeDecades: 4,
    crossLinkedTo: ["tony-ryan"],
    originCountryAttachment: "high",
    mobilityCommitment: 6,
    institutionalImpact: 9,
  },
];

function attachmentPenalty(level: Euromaxxer["originCountryAttachment"]): number {
  if (level === "low") return 0;
  if (level === "medium") return 8;
  return 16;
}

export function euromaxxerScore(person: Euromaxxer): number {
  const countryBreadth = Math.min(person.countriesStrongTie.length * 7, 28);
  const decadeDepth = Math.min(person.activeDecades * 6, 30);
  const networkDensity = Math.min(person.crossLinkedTo.length * 8, 24);
  const mobility = person.mobilityCommitment * 2;
  const institutions = person.institutionalImpact * 2;
  const penalty = attachmentPenalty(person.originCountryAttachment);

  const total = countryBreadth + decadeDepth + networkDensity + mobility + institutions - penalty;
  return Math.max(1, Math.min(100, total));
}
