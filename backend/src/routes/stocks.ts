import { Hono } from "hono";
import { z } from "zod";
import yahooFinance from "yahoo-finance2";
import { authMiddleware } from "../middleware/auth.ts";

const stocksRoutes = new Hono();
stocksRoutes.use("*", authMiddleware);

// Get quote for a single ticker
stocksRoutes.get("/quote/:ticker", async (c) => {
  const ticker = c.req.param("ticker");

  try {
    const quote = await yahooFinance.quote(ticker);

    return c.json({
      ticker: quote.symbol,
      price: quote.regularMarketPrice || 0,
      change: quote.regularMarketChange || 0,
      changePercent: quote.regularMarketChangePercent || 0,
      currency: quote.currency || "USD",
      name: quote.shortName || quote.longName || ticker,
    });
  } catch (error) {
    console.error(`Error fetching quote for ${ticker}:`, error);
    return c.json({ message: `Could not fetch quote for ${ticker}` }, 404);
  }
});

// Get quotes for multiple tickers
stocksRoutes.post("/quotes", async (c) => {
  try {
    const body = await c.req.json();
    const { tickers } = z.object({
      tickers: z.array(z.string()),
    }).parse(body);

    const quotes = [];

    for (const ticker of tickers) {
      try {
        const quote = await yahooFinance.quote(ticker);
        quotes.push({
          ticker: quote.symbol,
          price: quote.regularMarketPrice || 0,
          change: quote.regularMarketChange || 0,
          changePercent: quote.regularMarketChangePercent || 0,
          currency: quote.currency || "USD",
          name: quote.shortName || quote.longName || ticker,
        });
      } catch (error) {
        console.warn(`Could not fetch quote for ${ticker}:`, error);
        // Include error entry
        quotes.push({
          ticker,
          price: 0,
          change: 0,
          changePercent: 0,
          currency: "USD",
          name: ticker,
          error: true,
        });
      }
    }

    return c.json(quotes);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Fetch quotes error:", error);
    return c.json({ message: "Failed to fetch quotes" }, 500);
  }
});

export { stocksRoutes };

