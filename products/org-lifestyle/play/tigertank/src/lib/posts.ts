export interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
  body: string
}

export const posts: Post[] = [
  {
    slug: 'ireland-county-income-tax-switzerland-vote-with-your-feet',
    title:
      'Think tank: Ireland, county-by-county income tax, and the Swiss lesson in “voting with your feet”',
    excerpt:
      'A speculative sketch: what if Irish counties set income tax rates like Swiss cantons—seeded by a rule inversely related to population density—so competition and self-interest create downward pressure and referendum incentives align under a clean, explicit model?',
    date: '2026-04-10',
    body: `
Ireland collects income tax at the national level with admirable administrative simplicity. Switzerland does something structurally different: **sub-national governments set rates**, residents sort across borders in response to bundles of taxes and services, and the system has survived for generations without dissolving into chaos. This note is **not** a ready-made bill. It is a **think-tank thought experiment**: what if Ireland introduced a **county-level income tax band** (or a clearly defined county surcharge/rebate layered on a federal base) so that **competition between counties** became a first-class feature of fiscal policy—and the **initial rate schedule** were chosen so that a simple model of self-interest makes a **narrow Yes win in a referendum** feel less like magic and more like **mechanism design**?

**Why Switzerland is the right comparator**

Swiss cantons are not Irish counties—scale, history, and federal architecture differ. Still, the lesson that matters here is **Tiebout-style sorting**: when people can choose jurisdiction without changing country, **taxes and public goods become a market**. Counties that overprice relative to quality lose mobile taxpayers; counties that deliver value attract them. The claim is not that “markets solve public finance” without friction. It is that **fiscal decentralization introduces an optimization pressure**—a **downward drift on the tax wedge** for mobile bases unless voters consciously trade it off for services they want. That pressure is the **optimization function** people intuit when they say competition keeps governments honest.

**County-by-county income tax in Ireland: what would “work” even mean?**

Constitutional and EU constraints are real; this essay abstracts them to ask about **shape**, not enactability tomorrow. A workable design would need:

- A **national base** (uniform rules, administration, possibly collection) so compliance cost does not multiply by 26 experiments.
- A **county margin**—a rate band, a local multiplier, or a transparent surcharge—set by an elected county body within **pre-agreed floors and ceilings** so the system stays legible.
- **Equalization** or transition rules so sparse counties are not punished for geography alone—otherwise “competition” becomes a polite word for collapse.

The intellectual prize is the same as in Switzerland: **local democratic choice** within a **federal skeleton**, with **mobility** as the feedback signal.

**Seeding rates: inverse to population density**

Here is the “piece of mathematical beauty” the headline promises—stated honestly as **a normative construction**, not an empirical law of nature.

Let each county **c** have population density **ρ_c** (people per km²). Pick a function **h** that rises with **sparsity** (1/ρ). The **initial local marginal rate add-on** **τ_c** is:

**τ_c = τ₀ × h(1/ρ_c) / Σ_k w_k h(1/ρ_k)**

Here **h** maps sparsity into “fiscal room,” weights **w_k** pin the **national aggregate** to a revenue target, and **τ₀** scales the schedule. Intuition: **dense counties**—where land and congestion are scarce and agglomeration rents are high—start with **higher initial local burdens**; **sparse counties** start lower to attract residents and employers. The exact curve is a political choice; the **structure** is what creates elegance: **one scalar field** (density) orders the entire initial map, so the referendum debate can be about **parameters** (how steep the curve) rather than **26 separate pork stories**.

After the seed, **counties adjust** inside bands. The optimization story begins: a county that raises **τ_c** too far without improving quality loses net in-migration of the most elastic earners; a county that cuts may gain them. **Downward pressure** is not guaranteed in every subgame—nothing in public finance is—but it is **the central tendency** when labor and capital are at least somewhat mobile and information about bundles is imperfect but not zero.

**“51% Yes” and self-interest: a democratic soundness sketch**

No honest analyst should promise a **mathematical proof** that **actual Irish voters** approve any real referendum. What you *can* do in a think tank is specify a **stylized electorate** and show **incentive alignment**.

Imagine:

- A **pivotal voter model** where a fraction of the population is **mobile enough** to care about the county margin, another fraction is **immobile** and cares mostly about local services financed by the margin, and a middle group is **quasi-indifferent** at the seed.
- Under the **density-based seed**, **more than half** of the weighted electorate sees **weakly positive** expected surplus at **t = 0**: dense areas get **credibly promised** service and infrastructure spending from the higher initial wedge; sparse areas get **lower initial wedge** and **growth optionality**; the quasi-indifferent block breaks tie in favor of **trying the mechanism** because the schedule is **transparent** and **reversible** via future county votes.

In that toy world, **individual greed**—understood as **rational pursuit of post-tax income and local amenities**—does not undermine the reform; it **stabilizes** it. Everyone expects to **exploit** the rules (move, lobby, vote locally), and those actions are **the feedback loop** the design needs. Call that **“democratically sound”** in the **mechanism-design** sense: **the institution turns private incentives into a public discovery process** for rates and bundles.

Real referendums add **loss aversion**, **distrust**, and **media storms**. The sketch is not a guarantee; it is a **design target**: choose the seed so the **median plausible story** is “I can live with this” for a **narrow majority**, then let **feet and ballots** do the rest.

**Vote with your feet**

Ireland already has **internal migration**; what it lacks is a **first-class fiscal price tag** attached to county residence at the margin. Making that price tag **visible**—without sabotaging national solidarity—is how you earn the phrase **“vote with your feet.”** Some people will stay and pay for Dublin’s bundle; others will optimize **post-tax life** in the midlands or the west. That is not betrayal of the republic; it is **honesty about trade-offs**.

**Closing**

Switzerland did not arrive at fiscal federalism by theorem. Ireland would not either. But **county-by-county income taxation**, seeded by a **transparent, inverse-density schedule**, is a coherent think-tank proposal: it imports **competitive discipline**, keeps **democratic agency local**, and gives **optimization theory** something to chew on without pretending spreadsheets replace politics. The next step is not a manifesto—it is **simulation**: feed real CSO density and revenue data, draw a few curves **h**, and ask where the **median voter’s surplus** actually sits. Until then, treat this as **an opening argument**, not a finished constitution.
`.trim(),
  },
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
