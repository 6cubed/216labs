import type { Source } from "./types";

/**
 * Free retrieval for the browser: English Wikipedia search + REST summaries.
 * Uses public WMF APIs (no API key; CORS allows browser GETs).
 */
export async function fetchWikipediaContext(
  query: string,
  signal?: AbortSignal
): Promise<{ sources: Source[]; contextBlock: string; searchLabel: string }> {
  const q = query.trim();
  if (!q) {
    return { sources: [], contextBlock: "", searchLabel: "" };
  }

  const searchUrl = new URL("https://en.wikipedia.org/w/api.php");
  searchUrl.searchParams.set("action", "query");
  searchUrl.searchParams.set("list", "search");
  searchUrl.searchParams.set("srsearch", q);
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("origin", "*");
  searchUrl.searchParams.set("srlimit", "6");

  const sr = await fetch(searchUrl.toString(), { signal });
  if (!sr.ok) {
    throw new Error(`Wikipedia search failed (${sr.status})`);
  }
  const sdata = (await sr.json()) as {
    query?: { search?: Array<{ title: string }> };
  };
  const hits = sdata?.query?.search ?? [];
  if (hits.length === 0) {
    return {
      sources: [],
      contextBlock:
        "No matching Wikipedia articles were found for this query. Answer from general knowledge if needed, and say that no Wikipedia excerpts were retrieved.",
      searchLabel: q,
    };
  }

  const sources: Source[] = [];
  const blocks: string[] = [];
  let idx = 0;
  for (const hit of hits.slice(0, 5)) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const title = hit.title;
    const enc = encodeURIComponent(title.replace(/ /g, "_"));
    const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${enc}`;
    const res = await fetch(sumUrl, { signal });
    if (!res.ok) continue;
    const j = (await res.json()) as {
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    };
    const extract = (j.extract || "").trim();
    const url =
      j.content_urls?.desktop?.page ||
      `https://en.wikipedia.org/wiki/${enc}`;
    idx += 1;
    sources.push({
      title: j.title || title,
      url,
      snippet: extract.slice(0, 600),
    });
    blocks.push(`[${idx}] ${j.title || title}\nURL: ${url}\n${extract}\n`);
  }

  const contextBlock =
    blocks.join("\n") ||
    "No article extracts could be loaded. Say so briefly and avoid inventing citations.";

  return { sources, contextBlock, searchLabel: q };
}
