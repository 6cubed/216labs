import React from "react";
import { createRoot } from "react-dom/client";
import { installBrowserErrorReporting } from "@216labs/errors/report-error";
import { App } from "./ui/App";

installBrowserErrorReporting({ appId: "ytsync" });

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

