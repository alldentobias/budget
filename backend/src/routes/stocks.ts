import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.ts";
import { fetchQuote, fetchQuotesWithRateLimit } from "../lib/stock-cache.ts";

const stocksRoutes = new Hono();
stocksRoutes.use("*", authMiddleware);

// Get quote for a single ticker (uses cache with 24-hour TTL)
stocksRoutes.get("/quote/:ticker", async (c) => {
  const ticker = c.req.param("ticker");

  const quote = await fetchQuote(ticker);

  if (!quote) {
    return c.json({ message: `Could not fetch quote for ${ticker}` }, 404);
  }

  return c.json({
    ticker: quote.ticker,
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    currency: quote.currency,
    name: quote.name,
  });
});

// Get quotes for multiple tickers (uses cache with 24-hour TTL, rate-limited)
stocksRoutes.post("/quotes", async (c) => {
  try {
    const body = await c.req.json();
    const { tickers } = z.object({
      tickers: z.array(z.string()),
    }).parse(body);

    // Fetch all quotes with rate limiting
    const quotesMap = await fetchQuotesWithRateLimit(tickers);

    const quotes = tickers.map((ticker) => {
      const quote = quotesMap.get(ticker.toUpperCase());
      if (quote) {
        return {
          ticker: quote.ticker,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          currency: quote.currency,
          name: quote.name,
        };
      } else {
        return {
          ticker,
          price: 0,
          change: 0,
          changePercent: 0,
          currency: "USD",
          name: ticker,
          error: true,
        };
      }
    });

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


