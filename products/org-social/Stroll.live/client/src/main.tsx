import React from "react";
import ReactDOM from "react-dom/client";
import { installBrowserErrorReporting } from "@216labs/errors/report-error";
import App from "./App";
import "./index.css";

installBrowserErrorReporting({ appId: "stroll" });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
