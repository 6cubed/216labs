import type { OutfitLook } from '@/components/OutfitShowcase'

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'outfits'; looks: OutfitLook[] }

export interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
  /** Legacy single body (optional if content is used) */
  body?: string
  content?: ContentBlock[]
}

const firstPostLooks: OutfitLook[] = [
  {
    principle: 'Black trainers + black socks + black pants',
    caption:
      'When sock, pant, and shoe share one dark value, the leg reads as one long line — ideal with a crisp white or off-white tee for contrast at the torso.',
    trainerFill: '#1a1a1a',
    trainerStroke: '#333',
    sockShow: true,
    sockFill: '#171717',
    pantFill: '#141414',
    teeFill: '#f5f5f4',
    skinFill: '#c58c6a',
    hairFill: '#2d1810',
    hairNote: 'Dark brown hair echoes the shoe line without competing with the tee.',
    skinNote: 'Warm medium skin pops against bright white; try soft white if contrast feels harsh.',
  },
  {
    principle: 'Black trainers + white crew socks (visible)',
    caption:
      'A deliberate white sock band breaks the dark column. It works when you treat it as a graphic stripe — pair with grey or charcoal up top so the sock does not look accidental.',
    trainerFill: '#121212',
    trainerStroke: '#3f3f46',
    sockShow: true,
    sockFill: '#fafafa',
    pantFill: '#1c1917',
    teeFill: '#a1a1aa',
    skinFill: '#d4a574',
    hairFill: '#0f172a',
    hairNote: 'Cool black hair keeps the palette modern next to grey knit.',
    skinNote: 'Golden undertones balance cool grey without looking washed out.',
  },
  {
    principle: 'White trainers + white socks + light denim',
    caption:
      'Classic “fresh” stack: shoe, sock, and hem in the same light family. Navy or ink tees anchor the look so it is not all floating pastels.',
    trainerFill: '#f4f4f5',
    trainerStroke: '#d4d4d8',
    sockShow: true,
    sockFill: '#f8fafc',
    pantFill: '#93c5fd',
    teeFill: '#1e3a5f',
    skinFill: '#8d5524',
    hairFill: '#111827',
    hairNote: 'Dark hair gives the face a clear anchor when everything below the waist is light.',
    skinNote: 'Rich brown skin adds warmth so pale denim does not read as clinical.',
  },
  {
    principle: 'White trainers + no-show socks + cropped ecru pants',
    caption:
      'No visible sock keeps the ankle clean; ecru and camel near the face repeat warm undertones. Best when skin shows at the ankle acts as the “middle” colour between shoe and pant.',
    trainerFill: '#f5f5f4',
    trainerStroke: '#a8a29e',
    sockShow: false,
    sockFill: '#e7e5e4',
    pantFill: '#d6d3c9',
    teeFill: '#b45309',
    skinFill: '#e8c4a8',
    hairFill: '#78350f',
    hairNote: 'Auburn hair rhymes with the camel tee for a tonal story.',
    skinNote: 'Fair warm skin suits cream and ecru better than optic white at the hem.',
  },
  {
    principle: 'Black trainers + tonal sock with olive chinos',
    caption:
      'Socks slightly lighter or darker than the pant still feel “quiet.” Add an olive or sage tee so the outfit has one clear colour story besides neutrals.',
    trainerFill: '#18181b',
    trainerStroke: '#52525b',
    sockShow: true,
    sockFill: '#3f3f46',
    pantFill: '#57534e',
    teeFill: '#4d7c4a',
    skinFill: '#b8956a',
    hairFill: '#292524',
    hairNote: 'Neutral brown hair lets the green tee be the hero.',
    skinNote: 'Olive and earth tones flatter many medium skin tones; adjust green depth for cool vs warm undertones.',
  },
  {
    principle: 'White trainers + soft pastel socks + stone chinos',
    caption:
      'Pastel socks are a deliberate accessory — match them to something intentional (cap, stripe on tee, or bag), not random. Stone chinos keep the leg calm.',
    trainerFill: '#fafafa',
    trainerStroke: '#d6d3d1',
    sockShow: true,
    sockFill: '#fbcfe8',
    pantFill: '#a8a29e',
    teeFill: '#44403c',
    skinFill: '#c4a574',
    hairFill: '#1c1917',
    hairNote: 'Black hair keeps sweet sock colours from feeling juvenile.',
    skinNote: 'Warm skin stops pastel socks from reading as icy.',
  },
  {
    principle: 'Deep skin + black trainers + dark brown socks & pants',
    caption:
      'Tonal dressing with deep brown (not pure black) can soften transitions on deeper skin. A sage or dusty blue tee adds contrast without harsh brights.',
    trainerFill: '#0a0a0a',
    trainerStroke: '#27272a',
    sockShow: true,
    sockFill: '#292524',
    pantFill: '#1c1917',
    teeFill: '#6b8f71',
    skinFill: '#5c3d2e',
    hairFill: '#0c0a09',
    hairNote: 'Deep coily hair texture reads as part of the tonal column in silhouette.',
    skinNote: 'Earthy greens and off-whites often complement deep skin better than harsh cool grey.',
  },
  {
    principle: 'Fair skin + white trainers + grey column + black tee',
    caption:
      'Light grey pants and mid-grey socks with white shoes build a cool-neutral leg. A black tee frames the face — high contrast works when you want the portrait zone crisp.',
    trainerFill: '#f4f4f5',
    trainerStroke: '#a1a1aa',
    sockShow: true,
    sockFill: '#9ca3af',
    pantFill: '#d1d5db',
    teeFill: '#0a0a0a',
    skinFill: '#fde4d6',
    hairFill: '#d97706',
    hairNote: 'Strawberry or ginger hair adds warmth against a stark black tee.',
    skinNote: 'Very fair skin may prefer softened black (charcoal) tees for everyday wear.',
  },
  {
    principle: 'White trainers + forest tee + ecru pants + cream socks',
    caption:
      'Green + ecru is a nature palette. Cream socks bridge ecru pants to white shoes so the transition at the ankle is smooth — avoid bright white socks here.',
    trainerFill: '#fafaf9',
    trainerStroke: '#d6d3d1',
    sockShow: true,
    sockFill: '#e7e5e4',
    pantFill: '#d6d3c9',
    teeFill: '#14532d',
    skinFill: '#d9a066',
    hairFill: '#9a3412',
    hairNote: 'Copper or auburn hair harmonises with forest green and ecru.',
    skinNote: 'Warm peachy undertones tie the whole look together without needing another accent colour.',
  },
]

export const posts: Post[] = [
  {
    slug: 'trainers-socks-pants-and-tee-colour-theory',
    title:
      'Black vs white trainers: socks, pants, tees, and how skin and hair complete the look',
    excerpt:
      'A field guide to sock and pant pairings with black and white sneakers — illustrated with abstract “genAI-style” figures — plus when to think about skin undertone and hair colour.',
    date: '2026-03-22',
    content: [
      {
        type: 'text',
        text: `
This journal is part of the **OneFit** world: we care about outfits you can actually wear, and about the AI-generated humans you might dress in apps — the same colour logic applies to both.

**Black trainers** usually want either **full tonal continuity** (black-ish sock + black-ish pant) or a **deliberate** pale sock as a stripe. Accidental mid-grey socks with black shoes often look like a lost laundry lottery.

**White trainers** reward **either** matching white or off-white socks for a clean stack **or** no-show socks when pants are cropped and ankles are part of the composition. Bright white socks against dark pants can work — but only when the rest of the outfit expects contrast (sporty, street, or graphic).

**Tees and tops** do the emotional work: they set temperature (warm cream vs cool white), saturation (sage vs neon), and contrast with your face. **Skin undertone** is not a rulebook, but it is a useful mirror: very cool greys near the face can feel harsh on very warm skin unless you balance with hair, jewellery, or a warmer mid-layer. **Hair colour** is often the fastest bridge between top and bottom — dark hair stabilises light denim; copper or auburn can rhyme with olive, rust, or forest green.

Below is a **set of nine abstract looks** — think of them as storyboards for prompts — each illustrating one principle. Use them as a checklist the next time you brief an outfit model or get dressed yourself.
        `.trim(),
      },
      { type: 'outfits', looks: firstPostLooks },
      {
        type: 'text',
        text: `
**Quick recap**

- **Tonal column:** shoe, sock, and pant in the same value family elongate the leg; let the tee carry contrast.
- **Graphic sock:** light socks with dark shoes need intent — echo the sock’s brightness in the top or accept a streetwear vibe.
- **White shoe + pale denim:** keep a darker tee or jacket so the outfit has a horizon line.
- **No-show:** skin at the ankle counts as colour — ecru and camel love warm skin; optic white tees are not mandatory.
- **Hair as bridge:** when in doubt, repeat one garment colour in a natural feature (beanie, hair gloss, lip) so the palette feels human, not pasted-on.

We will keep publishing short, principle-led posts here — always with **illustrated looks** you can steal for prompts or for your own closet. Try the same ideas inside **OneFit** when you generate your next full-body render.
        `.trim(),
      },
    ],
  },
]

export function getPostBySlug(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug)
}

export function getAllSlugs(): string[] {
  return posts.map((p) => p.slug)
}
