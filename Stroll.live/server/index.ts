import express from "express";
import cors from "cors";
import { registerRoutes } from "./routes.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: true }));
app.use(express.json());

registerRoutes(app);

app.listen(PORT, () => {
  console.log(`[stroll] API on http://localhost:${PORT}`);
});
