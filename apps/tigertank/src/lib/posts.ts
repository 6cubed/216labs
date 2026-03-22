export interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
  body: string
}

export const posts: Post[] = [
  {
    slug: 'housing-swaps-and-the-european-mismatch',
    title:
      'Most European housing crises have a hidden swap table: matching the squeezed with the spacious',
    excerpt:
      'Eurostat shows heavy tails of overcrowding and under-occupancy at the same time. A formal swap pool could unlock win-win moves without a new brick — here is the case in numbers.',
    date: '2026-03-22',
    body: `
When people say **housing crisis**, the mental image is **too little stock**. That is often true. It is not the whole story. Across Europe, millions of households are in **too little space** while millions more sit in **more space than they need**, sometimes in the **same cities**. The gap is not only supply — it is **allocation**: preferences, life stage, and inertia frozen by moving costs, deposits, and fear of ending up worse off.

This note is speculative. It argues that a **large-scale voluntary swap market** — a pool where households publish what they have, what they need, and constraints — could **solve or materially soften** many local crises **without** assuming heroic new construction timelines. The mechanism is old: **double coincidence of wants**, solved today by marketplaces for everything except the primary home. Below I anchor the claim in **published European statistics**, then sketch **order-of-magnitude** gains.

**What the official numbers already say**

**Overcrowding:** Eurostat (EU-SILC, figures widely reported for 2024) puts the EU share of people living in **overcrowded** conditions at about **17%** — roughly **one in six**. The spread across countries is extreme: for example **Romania** and **Latvia** report overcrowding rates near **40%**, while several high-income states report **single-digit** shares. That is not a uniform “shortage” problem; it is **heterogeneous pressure** layered on top of affordability.

**Under-occupancy:** Eurostat has long published a mirror indicator — dwellings that are **too large for the household** under their definition. A headline figure from their releases (e.g. around **2016** for the EU as a whole) was on the order of **one-third of the population** in **under-occupied** housing. Country rankings invert the overcrowding map: **Ireland, Cyprus, Malta, Belgium, Spain** have shown **very high** under-occupancy rates (often **half or more** of the population in those surveys), while several Eastern European states show **much lower** under-occupancy. Again: **simultaneous** “too little” and “too much room” **in the system**, not only in the abstract.

**Housing cost overburden:** A separate line in EU-SILC is the share of households putting **more than 40% of disposable income** into housing. EU-wide, this “overburden” rate is often cited around **10%** in recent city-level aggregates (with **large** country differences — some Mediterranean and Nordic cities much higher). **Non-EU citizens** face roughly **double** the overburden rate of nationals in several reference years — a clue that **matching and information frictions**, not only square metres, drive distress.

None of these three indicators is a perfect map of “who would swap.” They are enough to show the **structural mismatch**: Europe is not only **short** of homes; it is **mis-sized** relative to current household composition.

**Why swaps help even when “we need more supply”**

New supply shifts the whole frontier outward. Swaps **re-sort** the existing frontier. In a tight market, **re-sorting** is disproportionately valuable:

**Marginal rent and price** are set by the **next** transaction. Every household that moves from **too small** to **right-sized** frees a unit that often **chains** into another match (A moves to B’s flat, B to C’s, and so on). Urban economics calls these **housing chains**; empirically they can be long. A swap pool makes **chains searchable**.

**Win-win** is not rhetoric. A downsizing empty-nester and an under-squeezed young family do not need the same **price** outcome; they need compatible **bundles** (rooms, location band, tenure type, monthly outlay). The **surplus** is the difference between their **reservation utilities**. When that surplus is positive, a deal exists — today it is often **invisible**.

**A back-of-the-envelope for one metro area**

Take a stylised city with **500,000** primary households in rented or owner-occupied stock. Apply EU-wide orders of magnitude only as **illustration**:

Assume **16%** are overcrowded (≈ **80,000** households) and **35%** under-occupied (≈ **175,000**). Those groups overlap with life stage and income; not everyone can trade. Suppose **only 5%** of overcrowded households — **4,000** — would join a **verified** swap pool if friction fell. Suppose **only 3%** of under-occupied households — **5,250** — would list **downsizing** preferences compatible with upsizing demand.

If the platform achieves **pairwise** compatibility of **20%** per year among active listers (location band + bedroom count + tenure + price band), that is **0.2 × min(4000, 5250) ≈ 800** **direct** swaps per year **before** multi-household chains. Add **chain resolution** (three-way and higher), and **1,000–1,500** annual re-matches in one half-million-household labour market is not heroic — it is **order-of-magnitude plausible** if legal templates and trust exist.

Scale to the EU: **tens of millions** of households sit in the **tails** of the mismatch distribution. Even **single-digit** participation rates imply **hundreds of thousands** of welfare-improving moves **per year** Europe-wide — **without** waiting for cranes.

**Design constraints (where the idea can fail)**

**Tenure:** Social housing assignment rules, rent controls, and mortgage **loan-to-value** rules can block swaps unless regulators **pre-clear** equivalent exchanges.

**Geography:** The best matches are **intra-city** or **intra-region**. Cross-border swaps are a niche; the big win is **domestic** liquidity.

**Equity:** A swap marketplace must not become **gentrification-as-a-service**. Means-tested subsidies and **priority queues** for overcrowded low-income households should sit **beside** voluntary matching, not instead of them.

**What would ship first**

A credible MVP is **not** blockchain deeds. It is **standardised swap contracts**, **identity-verified listings**, **notary-friendly** templates where needed, and **chain-finding** algorithms proven in kidney exchange and barter clearing. Public sector involvement could start with **pilot cities** that already measure overcrowding and under-occupancy for their own housing plans — the same Eurostat logic **locally disaggregated**.

**Closing**

European housing debates often collapse to **build** vs **block**. The data say a third axis — **better matching of existing stock to household size and budget** — deserves **serious** public investment. The numbers above are **illustrative**, not forecasts. They are enough to justify **pilots** at national scale: if even a fraction of the implied **double coincidence** clears, the welfare return per euro spent may rival **marginal** new supply — and arrive **years** faster.

Figures cited follow **Eurostat** definitions in EU-SILC and related “Housing in Europe” publications; refresh the exact percentages from **ec.europa.eu/eurostat** when you need precision for policy work.
`,
  },
]

export function getPostBySlug(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug)
}

export function getAllSlugs(): string[] {
  return posts.map((p) => p.slug)
}
