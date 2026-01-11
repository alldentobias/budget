import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth.ts";
import { assetsRoutes } from "./routes/assets.ts";
import { loansRoutes } from "./routes/loans.ts";
import { expensesRoutes } from "./routes/expenses.ts";
import { categoriesRoutes } from "./routes/categories.ts";
import { incomesRoutes } from "./routes/incomes.ts";
import { importRoutes } from "./routes/import.ts";
import { exportRoutes } from "./routes/export.ts";
import { dashboardRoutes } from "./routes/dashboard.ts";
import { stocksRoutes } from "./routes/stocks.ts";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// Health check
app.get(
  "/health",
  (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

// API Routes
app.route("/api/auth", authRoutes);
app.route("/api/assets", assetsRoutes);
app.route("/api/loans", loansRoutes);
app.route("/api/expenses", expensesRoutes);
app.route("/api/categories", categoriesRoutes);
app.route("/api/incomes", incomesRoutes);
app.route("/api/import", importRoutes);
app.route("/api/export", exportRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/stocks", stocksRoutes);

const port = parseInt(Deno.env.get("PORT") || "8000");

console.log(`🚀 Budget API running on http://localhost:${port}`);

Deno.serve({ port }, app.fetch);

