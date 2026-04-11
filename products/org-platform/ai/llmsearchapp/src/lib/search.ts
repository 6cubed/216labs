import type { Source } from "./types";

const TAVILY = "https://api.tavily.com/search";

/**
 * Web search for RAG. Prefer Tavily (built for LLM apps); optional Brave fallback.
 */
export async function webSearch(query: string, opts?: { maxResults?: number }): Promise<Source[]> {
  const max = opts?.maxResults ?? 8;
  const tavilyKey = process.env.TAVILY_API_KEY?.trim();
  if (tavilyKey) {
    const res = await fetch(TAVILY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: "advanced",
        include_answer: false,
        max_results: max,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Tavily error ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    const rows = data.results ?? [];
    return rows
      .filter((r) => r.url && (r.title || r.content))
      .slice(0, max)
      .map((r) => ({
        title: (r.title || r.url || "Source").slice(0, 200),
        url: r.url!,
        snippet: (r.content || "").slice(0, 1200),
      }));
  }

  const braveKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (braveKey) {
    const u = new URL("https://api.search.brave.com/res/v1/web/search");
    u.searchParams.set("q", query);
    u.searchParams.set("count", String(Math.min(max, 20)));
    const res = await fetch(u.toString(), {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": braveKey,
      },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Brave Search error ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
    };
    const rows = data.web?.results ?? [];
    return rows.slice(0, max).map((r) => ({
      title: (r.title || r.url || "Source").slice(0, 200),
      url: r.url!,
      snippet: (r.description || "").slice(0, 1200),
    }));
  }

  throw new Error(
    "No search API configured. Set TAVILY_API_KEY or BRAVE_SEARCH_API_KEY (admin Environment on the droplet, or .env locally)."
  );
}
