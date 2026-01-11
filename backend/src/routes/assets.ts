import { Hono } from "hono";
import { z } from "zod";
import { assets, db } from "../db/index.ts";
import { and, eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.ts";
import { fetchQuote, fetchQuotesWithRateLimit } from "../lib/stock-cache.ts";

const assetsRoutes = new Hono();
assetsRoutes.use("*", authMiddleware);

// manualValue and currentPrice are in minor units (øre/cents) - integers
// quantity stays as decimal for fractional shares
const assetSchema = z.object({
  type: z.enum(["stock", "property", "cash", "other"]),
  name: z.string().min(1).max(255),
  ticker: z.string().max(20).optional().nullable(),
  quantity: z.number().default(0),
  manualValue: z.number().int().optional().nullable(), // Integer in minor units
  ownershipPct: z.number().min(0).max(100).default(100),
});

// Helper to convert stock price to minor units (multiply by 100)
function priceToMinorUnits(price: number | null | undefined): number | null {
  if (price == null) return null;
  return Math.round(price * 100);
}

// Get all assets for the current user
assetsRoutes.get("/", async (c) => {
  const user = c.get("user");

  const userAssets = await db.query.assets.findMany({
    where: eq(assets.userId, user.id),
    orderBy: (assets, { desc }) => [desc(assets.createdAt)],
  });

  // quantity and ownershipPct are still decimals stored as strings
  return c.json(userAssets.map((asset) => ({
    ...asset,
    quantity: parseFloat(asset.quantity),
    ownershipPct: parseFloat(asset.ownershipPct),
    // manualValue and currentPrice are bigint, come back as numbers
  })));
});

// Create a new asset
assetsRoutes.post("/", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const data = assetSchema.parse(body);

    // If it's a stock with a ticker, fetch current price (uses cache)
    let currentPrice: number | null = null;
    if (data.type === "stock" && data.ticker) {
      const quote = await fetchQuote(data.ticker);
      if (quote) {
        currentPrice = priceToMinorUnits(quote.price);
      }
    }

    const [newAsset] = await db
      .insert(assets)
      .values({
        userId: user.id,
        type: data.type,
        name: data.name,
        ticker: data.ticker || null,
        quantity: data.quantity.toString(),
        manualValue: data.manualValue ?? null,
        currentPrice: currentPrice,
        ownershipPct: data.ownershipPct.toString(),
        lastPriceUpdate: currentPrice ? new Date() : null,
      })
      .returning();

    return c.json({
      ...newAsset,
      quantity: parseFloat(newAsset.quantity),
      ownershipPct: parseFloat(newAsset.ownershipPct),
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Create asset error:", error);
    return c.json({ message: "Failed to create asset" }, 500);
  }
});

// Update an asset
assetsRoutes.put("/:id", async (c) => {
  try {
    const user = c.get("user");
    const assetId = c.req.param("id");
    const body = await c.req.json();
    const data = assetSchema.partial().parse(body);

    // Check if asset exists and belongs to user
    const existing = await db.query.assets.findFirst({
      where: and(eq(assets.id, assetId), eq(assets.userId, user.id)),
    });

    if (!existing) {
      return c.json({ message: "Asset not found" }, 404);
    }

    // If ticker changed, fetch new price
    let currentPrice = existing.currentPrice;
    let lastPriceUpdate = existing.lastPriceUpdate;

    if (data.ticker && data.ticker !== existing.ticker) {
      const quote = await fetchQuote(data.ticker);
      if (quote) {
        currentPrice = priceToMinorUnits(quote.price);
        lastPriceUpdate = new Date();
      }
    }

    const [updated] = await db
      .update(assets)
      .set({
        type: data.type,
        name: data.name,
        ticker: data.ticker !== undefined
          ? (data.ticker || null)
          : existing.ticker,
        quantity: data.quantity !== undefined
          ? data.quantity.toString()
          : existing.quantity,
        manualValue: data.manualValue !== undefined
          ? data.manualValue
          : existing.manualValue,
        currentPrice,
        ownershipPct: data.ownershipPct !== undefined
          ? data.ownershipPct.toString()
          : existing.ownershipPct,
        lastPriceUpdate,
      })
      .where(and(eq(assets.id, assetId), eq(assets.userId, user.id)))
      .returning();

    return c.json({
      ...updated,
      quantity: parseFloat(updated.quantity),
      ownershipPct: parseFloat(updated.ownershipPct),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Update asset error:", error);
    return c.json({ message: "Failed to update asset" }, 500);
  }
});

// Delete an asset
assetsRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const assetId = c.req.param("id");

  const deleted = await db
    .delete(assets)
    .where(and(eq(assets.id, assetId), eq(assets.userId, user.id)))
    .returning();

  if (deleted.length === 0) {
    return c.json({ message: "Asset not found" }, 404);
  }

  return c.body(null, 204);
});

// Refresh stock prices (with rate limiting and caching)
assetsRoutes.post("/refresh-prices", async (c) => {
  const user = c.get("user");

  const userAssets = await db.query.assets.findMany({
    where: and(eq(assets.userId, user.id), eq(assets.type, "stock")),
  });

  const stockAssets = userAssets.filter((a) => a.ticker);
  const tickers = stockAssets.map((a) => a.ticker!);

  // Fetch all quotes with rate limiting (500ms between requests)
  const quotes = await fetchQuotesWithRateLimit(tickers);

  // Update assets with fetched prices
  for (const asset of stockAssets) {
    if (!asset.ticker) continue;

    const quote = quotes.get(asset.ticker.toUpperCase());
    if (quote) {
      await db
        .update(assets)
        .set({
          currentPrice: priceToMinorUnits(quote.price),
          lastPriceUpdate: new Date(),
        })
        .where(eq(assets.id, asset.id));
    }
  }

  // Return updated assets
  const updated = await db.query.assets.findMany({
    where: eq(assets.userId, user.id),
    orderBy: (assets, { desc }) => [desc(assets.createdAt)],
  });

  return c.json(updated.map((asset) => ({
    ...asset,
    quantity: parseFloat(asset.quantity),
    ownershipPct: parseFloat(asset.ownershipPct),
  })));
});

export { assetsRoutes };
