export type Budget = "under25" | "25to50" | "50plus";

export type GiftIdea = {
  name: string;
  why: string;
  priceHint: string;
  tag?: string;
};

export const INTERESTS = [
  { id: "animals", label: "Animals", emoji: "🐾" },
  { id: "dinosaurs", label: "Dinosaurs", emoji: "🦕" },
  { id: "space", label: "Space", emoji: "🚀" },
  { id: "art", label: "Art & crafts", emoji: "🎨" },
  { id: "building", label: "Building", emoji: "🧱" },
  { id: "sports", label: "Sports", emoji: "⚽" },
  { id: "music", label: "Music", emoji: "🎵" },
  { id: "books", label: "Books", emoji: "📚" },
  { id: "outdoor", label: "Outdoor", emoji: "🌲" },
  { id: "princess", label: "Princess & fantasy", emoji: "👑" },
] as const;

const CURATED: Record<string, GiftIdea[]> = {
  animals: [
    { name: "Stuffed animal adoption kit", why: "Soft companion plus fun facts card — great for little animal lovers.", priceHint: "$15–25", tag: "Classic" },
    { name: "Wildlife sketchbook + colored pencils", why: "Encourages observation and drawing their favorite creatures.", priceHint: "$12–20", tag: "Creative" },
    { name: "Animal flashcard trivia game", why: "Playful learning for car rides and rainy days.", priceHint: "$10–18", tag: "Play" },
  ],
  dinosaurs: [
    { name: "Dino excavation dig kit", why: "Hands-on discovery — feels like a real paleontologist.", priceHint: "$18–30", tag: "STEM" },
    { name: "Glow-in-the-dark dino figures", why: "Bedtime-friendly dinosaurs that spark imagination.", priceHint: "$12–22", tag: "Fun" },
    { name: "Dinosaur encyclopedia (age-graded)", why: "Feeds endless “did you know?” moments.", priceHint: "$15–25", tag: "Books" },
  ],
  space: [
    { name: "Planetarium projector night light", why: "Turns their ceiling into the solar system.", priceHint: "$25–40", tag: "Wow factor" },
    { name: "Rocket building kit", why: "Build, decorate, and launch — physics disguised as play.", priceHint: "$15–28", tag: "STEM" },
    { name: "Space sticker atlas", why: "Interactive map of missions, moons, and constellations.", priceHint: "$10–16", tag: "Books" },
  ],
  art: [
    { name: "Washable watercolor set", why: "Mess-friendly creativity for beginners.", priceHint: "$12–20", tag: "Creative" },
    { name: "Air-dry clay bucket", why: "Sculpt characters from their own stories.", priceHint: "$10–18", tag: "Hands-on" },
    { name: "Light tracing pad", why: "Helps confident drawing without frustration.", priceHint: "$20–35", tag: "Upgrade" },
  ],
  building: [
    { name: "Magnetic tiles starter set", why: "Open-ended structures — grows with them for years.", priceHint: "$30–50", tag: "Investment" },
    { name: "Wooden marble run", why: "Cause-and-effect engineering they can rebuild daily.", priceHint: "$25–45", tag: "STEM" },
    { name: "Tool belt + pretend workshop", why: "Role-play builds confidence and fine motor skills.", priceHint: "$15–25", tag: "Pretend play" },
  ],
  sports: [
    { name: "Adjustable mini hoop or goal", why: "Burns energy indoors or in the yard.", priceHint: "$20–40", tag: "Active" },
    { name: "Skill challenge cards", why: "Turn practice into a game with friends.", priceHint: "$8–14", tag: "Play" },
    { name: "Personalized sports water bottle", why: "Practical gift they’ll use every week.", priceHint: "$12–20", tag: "Personal" },
  ],
  music: [
    { name: "Kid-safe headphones", why: "Volume-limited for tablets and road trips.", priceHint: "$20–35", tag: "Practical" },
    { name: "Rhythm instrument set", why: "Shakers, tambourine, and bells — instant band.", priceHint: "$15–25", tag: "Play" },
    { name: "Sing-along story songbook", why: "Combines literacy with music time.", priceHint: "$12–18", tag: "Books" },
  ],
  books: [
    { name: "Illustrated chapter book series (book 1)", why: "Start a series they’ll ask to continue.", priceHint: "$8–14", tag: "Books" },
    { name: "Reading nook lamp + bookmark set", why: "Makes bedtime reading feel special.", priceHint: "$15–25", tag: "Cozy" },
    { name: "Library tote + reading log", why: "Gamifies trips to borrow new titles.", priceHint: "$10–16", tag: "Habit" },
  ],
  outdoor: [
    { name: "Bug observation kit", why: "Magnifier jar and field guide for backyard explorers.", priceHint: "$12–20", tag: "Nature" },
    { name: "Kite or stomp rocket", why: "Instant outdoor adventure with minimal setup.", priceHint: "$10–22", tag: "Active" },
    { name: "Garden grow kit", why: "Watch something they planted become real food or flowers.", priceHint: "$15–25", tag: "STEM" },
  ],
  princess: [
    { name: "Dress-up crown + cape set", why: "Open-ended pretend play without a single storyline.", priceHint: "$15–28", tag: "Pretend play" },
    { name: "Fairy tale puzzle (100–200 pieces)", why: "Quiet focus time with a magical theme.", priceHint: "$12–18", tag: "Calm" },
    { name: "Sparkle journal with lock", why: "Private space for secret stories and drawings.", priceHint: "$10–16", tag: "Creative" },
  ],
};

const UNIVERSAL: GiftIdea[] = [
  { name: "Experience voucher (zoo, museum, or class)", why: "Memories beat clutter — pick something local they'll talk about for weeks.", priceHint: "$25–60", tag: "Experience" },
  { name: "Subscription craft box (1 month)", why: "A gift that keeps arriving — great when you're stuck.", priceHint: "$20–35", tag: "Subscription" },
];

export const STORYMAGIC_UPSELL: GiftIdea = {
  name: "StoryMagic personalised storybook",
  why: "AI-written and illustrated hardcover starring your child — the gift they'll keep on the shelf for years.",
  priceHint: "$24.99",
  tag: "216labs pick",
};

function budgetOk(hint: string, budget: Budget): boolean {
  const nums = hint.match(/\d+/g)?.map(Number) ?? [];
  const low = nums[0] ?? 0;
  const high = nums[nums.length - 1] ?? low;
  if (budget === "under25") return high <= 28;
  if (budget === "25to50") return low >= 15 && high <= 55;
  return low >= 30;
}

export function curatedGifts(age: number, interests: string[], budget: Budget): GiftIdea[] {
  const picked: GiftIdea[] = [];
  const seen = new Set<string>();

  for (const id of interests.length ? interests : ["books"]) {
    for (const g of CURATED[id] ?? []) {
      if (seen.has(g.name) || !budgetOk(g.priceHint, budget)) continue;
      seen.add(g.name);
      picked.push(g);
    }
  }

  for (const g of UNIVERSAL) {
    if (picked.length >= 5) break;
    if (seen.has(g.name) || !budgetOk(g.priceHint, budget)) continue;
    seen.add(g.name);
    picked.push(g);
  }

  if (age <= 4) {
    picked.sort((a, b) => (a.tag === "STEM" ? 1 : 0) - (b.tag === "STEM" ? 1 : 0));
  }

  return picked.slice(0, 5);
}

export function storymagicUrl(age: number, interests: string[]): string {
  const params = new URLSearchParams({
    utm_source: "kidgift",
    utm_medium: "cta",
    utm_campaign: "gift_finder",
    age: String(age),
  });
  if (interests[0]) params.set("interest", interests[0]);
  return `https://storybook.6cubed.app?${params.toString()}`;
}
