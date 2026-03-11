export interface PolymarketEvent {
  id: string;
  question: string;
  description: string;
  marketProbability: number | null;
  outcome: number | null; // 1 = Yes, 0 = No, null = unresolved
  isResolved: boolean;
  volume: number;
}

interface RawMarket {
  id: string;
  question?: string;
  description?: string;
  outcomes?: string; // JSON: ["Yes", "No"]
  outcomePrices?: string; // JSON: ["0.65", "0.35"]
  volume?: number | string;
  active?: boolean;
  closed?: boolean;
  resolved?: boolean;
  resolutionTime?: string;
}

function parseMarket(
  market: RawMarket
): {
  probability: number | null;
  outcome: number | null;
  isResolved: boolean;
} {
  if (!market.outcomePrices) {
    return { probability: null, outcome: null, isResolved: false };
  }

  let prices: number[];
  try {
    prices = JSON.parse(market.outcomePrices).map(Number);
  } catch {
    return { probability: null, outcome: null, isResolved: false };
  }

  if (prices.length < 2) {
    return { probability: null, outcome: null, isResolved: false };
  }

  const yesPrice = prices[0];
  const isResolved = !!(market.closed || market.resolved);

  if (isResolved) {
    const outcome =
      yesPrice >= 0.99 ? 1 : yesPrice <= 0.01 ? 0 : null;
    return { probability: yesPrice, outcome, isResolved: true };
  }

  return { probability: yesPrice, outcome: null, isResolved: false };
}

async function fetchMarkets(
  params: Record<string, string | number>
): Promise<RawMarket[]> {
  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  const url = `https://gamma-api.polymarket.com/markets?${query}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "CalibratedAI/1.0" },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    console.error(`Polymarket API error: ${res.status} ${res.statusText}`);
    return [];
  }

  return res.json();
}

export async function fetchPolymarketEvents(
  limit = 100
): Promise<PolymarketEvent[]> {
  const resolvedCount = Math.ceil(limit * 0.7);
  const activeCount = Math.ceil(limit * 0.3);

  const [resolvedMarkets, activeMarkets] = await Promise.all([
    fetchMarkets({
      closed: "true",
      limit: resolvedCount,
      order: "volume",
      ascending: "false",
    }),
    fetchMarkets({
      active: "true",
      limit: activeCount,
      order: "volume",
      ascending: "false",
    }),
  ]);

  const results: PolymarketEvent[] = [];
  const seen = new Set<string>();

  for (const market of [...resolvedMarkets, ...activeMarkets]) {
    if (!market.id || !market.question) continue;
    if (seen.has(market.id)) continue;
    if (!market.outcomePrices) continue;

    let prices: number[];
    try {
      prices = JSON.parse(market.outcomePrices).map(Number);
    } catch {
      continue;
    }

    if (prices.length !== 2) continue;

    seen.add(market.id);
    const { probability, outcome, isResolved } = parseMarket(market);

    results.push({
      id: market.id,
      question: market.question.slice(0, 500),
      description: (market.description || "").slice(0, 1000),
      marketProbability: probability,
      outcome,
      isResolved,
      volume: Number(market.volume || 0),
    });

    if (results.length >= limit) break;
  }

  return results;
}
