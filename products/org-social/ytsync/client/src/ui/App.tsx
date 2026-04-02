import React, { useEffect, useMemo, useState } from "react";
import { Home } from "./Home";
import { Room } from "./Room";

function getPath() {
  return window.location.pathname || "/";
}

export function App() {
  const [path, setPath] = useState(getPath());

  useEffect(() => {
    const onPop = () => setPath(getPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const route = useMemo(() => {
    const p = path.replace(/\/+$/, "") || "/";
    const m = p.match(/^\/r\/([A-Za-z0-9_-]{4,64})$/);
    if (m) return { kind: "room" as const, roomId: m[1] };
    return { kind: "home" as const };
  }, [path]);

  return (
    <div style={{ minHeight: "100vh", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      {route.kind === "home" ? <Home /> : <Room roomId={route.roomId} />}
    </div>
  );
}

