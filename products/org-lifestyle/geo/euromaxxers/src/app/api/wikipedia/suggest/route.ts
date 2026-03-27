import { NextRequest, NextResponse } from "next/server";

type WikipediaLink = {
  title: string;
  ns: number;
};

function titleFromInput(seed: string): string {
  const trimmed = seed.trim();
  if (!trimmed) {
    throw new Error("Provide a Wikipedia URL or page title.");
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error("Invalid URL format.");
    }
    if (!parsed.hostname.endsWith("wikipedia.org")) {
      throw new Error("Only wikipedia.org URLs are supported.");
    }
    const marker = "/wiki/";
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) {
      throw new Error("Expected a /wiki/<title> URL.");
    }
    const raw = parsed.pathname.slice(idx + marker.length);
    if (!raw) {
      throw new Error("Missing page title in URL.");
    }
    return decodeURIComponent(raw).replace(/_/g, " ");
  }

  return trimmed.replace(/_/g, " ");
}

function likelyPersonTitle(title: string): boolean {
  if (!title || title.includes(":")) return false;
  if (title.length < 5 || title.length > 80) return false;
  if (/^\d+$/.test(title)) return false;
  return /\s/.test(title);
}

function wikipediaUrlFromTitle(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s/g, "_"))}`;
}

export async function GET(req: NextRequest) {
  const seed = req.nextUrl.searchParams.get("seed") ?? "";
  let seedTitle = "";
  try {
    seedTitle = titleFromInput(seed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid input";
    return new NextResponse(message, { status: 400 });
  }

  const queryUrl =
    "https://en.wikipedia.org/w/api.php?action=query&prop=links&pllimit=max&format=json" +
    `&titles=${encodeURIComponent(seedTitle)}&origin=*`;

  const linksResponse = await fetch(queryUrl, {
    headers: { "user-agent": "216labs-euromaxxers/1.0 (network explorer)" },
    next: { revalidate: 3600 },
  });

  if (!linksResponse.ok) {
    return new NextResponse("Wikipedia API request failed.", { status: 502 });
  }

  const linksPayload = (await linksResponse.json()) as {
    query?: { pages?: Record<string, { title: string; links?: WikipediaLink[] }> };
  };

  const page = Object.values(linksPayload.query?.pages ?? {})[0];
  if (!page) {
    return new NextResponse("Could not resolve seed page.", { status: 404 });
  }

  const linkTitles = (page.links ?? [])
    .filter((link) => link.ns === 0)
    .map((link) => link.title)
    .filter(likelyPersonTitle)
    .slice(0, 18);

  const summaryResults = await Promise.all(
    linkTitles.map(async (title) => {
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        title.replace(/\s/g, "_")
      )}`;
      try {
        const response = await fetch(summaryUrl, {
          headers: { "user-agent": "216labs-euromaxxers/1.0 (network explorer)" },
          next: { revalidate: 3600 },
        });
        if (!response.ok) {
          return null;
        }
        const data = (await response.json()) as { extract?: string; type?: string };
        if (data.type === "disambiguation") {
          return null;
        }
        return {
          title,
          url: wikipediaUrlFromTitle(title),
          snippet: data.extract?.slice(0, 180),
        };
      } catch {
        return null;
      }
    })
  );

  const links = summaryResults.filter((item) => item !== null);
  return NextResponse.json({
    seedTitle: page.title,
    links,
  });
}
