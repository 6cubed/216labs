export type WsStatus = "connecting" | "open" | "closed";

export function makeWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

