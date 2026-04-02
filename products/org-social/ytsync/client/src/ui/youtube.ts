let ytApiPromise: Promise<typeof window.YT> | null = null;

export function loadYouTubeApi(): Promise<typeof window.YT> {
  if (typeof window === "undefined") throw new Error("No window");
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      s.onerror = () => reject(new Error("Failed to load YouTube API"));
      document.head.appendChild(s);
    }

    const timeout = window.setTimeout(() => reject(new Error("Timed out loading YouTube API")), 15000);
    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      window.clearTimeout(timeout);
      resolve(window.YT);
    };
  });

  return ytApiPromise;
}

export function parseYouTubeVideoId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;

  // raw id
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;

  try {
    const u = new URL(s);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace("/", "");
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (u.hostname.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const m = u.pathname.match(/\/(embed|shorts)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[2];
    }
  } catch {
    // ignore
  }

  return null;
}

