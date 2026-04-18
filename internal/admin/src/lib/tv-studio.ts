/**
 * YouTube TV series creator — grounded generation helpers.
 * Scripts are constrained to predefined character bibles; the model must not invent new series-regular characters.
 */

export type TvCharacter = {
  id: string;
  name: string;
  role: string;
  /** How they speak (dialect, tempo, verbal tics). */
  voice: string;
  /** Facts the model may treat as canon for this person. */
  canon: string[];
  /** Hard rails — behaviours or topics to avoid for this character. */
  constraints: string[];
  /** Other character id → one-line relationship note. */
  relationships: Record<string, string>;
};

export type SeriesBible = {
  id: string;
  title: string;
  logline: string;
  worldRules: string[];
  tone: string;
  /** Episodes are cheap: target length / format hints for YouTube. */
  formatNotes: string[];
};

export const DEFAULT_SERIES: SeriesBible = {
  id: "bench-creek",
  title: "Bench Creek",
  logline:
    "A small-town public-access crew follows odd jobs, town politics, and the same five people who never leave the diner.",
  worldRules: [
    "Stories stay PG-13: no graphic violence or sexual content.",
    "Humour is dry and character-driven; avoid punching down.",
    "No real celebrities, brands, or current politicians unless the user explicitly names them in the premise.",
  ],
  tone: "Mockumentary warmth with awkward pauses; think low-budget sincerity, not cinematic bombast.",
  formatNotes: [
    "Target 8–12 minute episodes: cold open, A-plot, B-plot, stinger.",
    "Favour dialogue and stage directions a small crew could shoot in a day.",
  ],
};

/** Starter roster — editable in the UI via import/export; IDs are stable for prompts. */
export const DEFAULT_CHARACTERS: TvCharacter[] = [
  {
    id: "dana-vale",
    name: "Dana Vale",
    role: "Field producer / reluctant host",
    voice: "Over-prepared, slightly nasal, apologises with confidence.",
    canon: [
      "Runs the show on a shoestring; owns a dented minivan used as a gear closet.",
      "Says “we can fix it in post” when something breaks on set.",
    ],
    constraints: ["Does not swear on camera.", "Never claims to have a law degree."],
    relationships: {
      "marcus-cho": "Trusts Marcus with gear, not with deadlines.",
      "rita-okonkwo": "Rita is the only person Dana believes can save an episode in the edit.",
    },
  },
  {
    id: "marcus-cho",
    name: "Marcus Cho",
    role: "Camera / sound",
    voice: "Monotone deadpan; one-line zingers after long silences.",
    canon: [
      "Always wearing headphones; claims he can hear hum from faulty XLRs in his sleep.",
      "Secretly writes spec scripts nobody has read.",
    ],
    constraints: ["No on-camera cruelty toward Dana; teasing only.", "Does not discuss real-world hacking or illegal recording."],
    relationships: {
      "dana-vale": "Protective of Dana’s optimism, skeptical of Dana’s schedules.",
      "pigeon-lord": "Treats Pigeon Lord as an ambient hazard.",
    },
  },
  {
    id: "rita-okonkwo",
    name: "Rita Okonkwo",
    role: "Editor / narrator (voice-over)",
    voice: "Warm, precise; narrates like she is gently correcting history.",
    canon: [
      "Cuts around chaos; keeps a timeline labelled “DO NOT OPEN (emotionally)”.",
      "Only person who reads town meeting minutes for fun.",
    ],
    constraints: ["Voice-over must not contradict on-screen facts established in the same episode.", "No medical or legal advice."],
    relationships: {
      "dana-vale": "Soft spot for Dana’s earnestness.",
      "helen-voss": "Cordial rivalry with Helen for “sensible adult in the room”.",
    },
  },
  {
    id: "helen-voss",
    name: "Helen Voss",
    role: "Town clerk / recurring interviewee",
    voice: "Crisp, bureaucratic, accidentally funny.",
    canon: [
      "Knows every permit form by heart; treats clipboards as sacred texts.",
      "Has a feud with the vending machine in the lobby.",
    ],
    constraints: ["Does not accept bribes or break confidentiality in dialogue.", "No slurs or hate speech."],
    relationships: {
      "rita-okonkwo": "Mutual respect; occasional correction of each other’s facts.",
    },
  },
  {
    id: "pigeon-lord",
    name: "Pigeon Lord",
    role: "Wordless recurring background character (silent comedy)",
    voice: "Non-speaking; communicates with gestures and staring.",
    canon: [
      "Appears in B-roll; town myth says they have never been indoors.",
      "May or may not be the same person each week — never confirmed aloud.",
    ],
    constraints: [
      "No dialogue lines — gestures and reactions only, labelled in stage directions.",
      "Do not portray as violent; physical comedy must be cartoon-light.",
    ],
    relationships: {
      "marcus-cho": "Marcus is the only one who pretends Pigeon Lord is normal.",
    },
  },
];

export type GenerateFormat = "beat_sheet" | "dialogue_scenes" | "shot_list";

export function getCharactersByIds(all: TvCharacter[], ids: string[]): TvCharacter[] {
  const map = new Map(all.map((c) => [c.id, c]));
  return ids.map((id) => map.get(id)).filter(Boolean) as TvCharacter[];
}

export function buildGroundedSystemPrompt(
  series: SeriesBible,
  cast: TvCharacter[],
  format: GenerateFormat
): string {
  const castNames = cast.map((c) => c.name).join(", ");
  const formatInstructions =
    format === "beat_sheet"
      ? `Output a beat sheet: cold open, Act 1–3, stinger. Each beat 2–4 sentences. Tag which characters appear.`
      : format === "dialogue_scenes"
        ? `Output 2–3 scenes with CHARACTER NAME: lines only for the cast listed. Include brief sluglines (INT/EXT) and minimal stage directions.`
        : `Output a pragmatic shot list: setup, coverage, B-roll, audio notes — sized for a tiny crew.`;

  return `You are a staff writer for a YouTube series. You must stay grounded in the series bible and ONLY use the predefined characters provided below.

SERIES
Title: ${series.title}
Logline: ${series.logline}
Tone: ${series.tone}
World rules:
${series.worldRules.map((r) => `- ${r}`).join("\n")}
Format:
${series.formatNotes.map((r) => `- ${r}`).join("\n")}

CAST FOR THIS EPISODE (do not introduce other series-regular characters; unnamed extras may appear as "CLERK", "KID", etc.)
${castNames || "(none selected — you must still not invent new series-regulars; use generic extras only)"}

CHARACTER BIBLES (treat as canon; respect constraints)
${cast
  .map(
    (c) => `
### ${c.name} (${c.role})
Voice: ${c.voice}
Canon:
${c.canon.map((x) => `- ${x}`).join("\n")}
Constraints:
${c.constraints.map((x) => `- ${x}`).join("\n")}
Relationships:
${Object.entries(c.relationships)
  .map(([id, note]) => {
    const other = cast.find((x) => x.id === id)?.name ?? id;
    return `- to ${other}: ${note}`;
  })
  .join("\n") || "- (none listed among selected cast)"}
`
  )
  .join("\n")}

OUTPUT FORMAT
${formatInstructions}

RULES
- Do not contradict the character bibles.
- Do not add new recurring characters with names and backstories; one-off extras are fine.
- If the user premise conflicts with a constraint, follow the constraint and note the compromise in a short "Writers' note" at the end.
- Keep production scope cheap: few locations, little VFX, dialogue-forward.
`;
}

export function buildUserPrompt(params: {
  episodeTitle: string;
  premise: string;
  beatNotes?: string;
}): string {
  let s = `Episode title: ${params.episodeTitle.trim()}\n\nPremise:\n${params.premise.trim()}\n`;
  if (params.beatNotes?.trim()) {
    s += `\nOptional beats / jokes to hit:\n${params.beatNotes.trim()}\n`;
  }
  return s;
}
