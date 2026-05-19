import { createRoot } from "react-dom/client";
import { installBrowserErrorReporting } from "@216labs/errors/report-error";
import App from "./App";
import "./index.css";

installBrowserErrorReporting({ appId: "ramblingradio" });

createRoot(document.getElementById("root")!).render(<App />);
