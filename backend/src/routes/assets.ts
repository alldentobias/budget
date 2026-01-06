import { Hono } from "hono";
import { z } from "zod";
import { db, assets } from "../db/index.ts";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.ts";
import yahooFinance from "yahoo-finance2";

const assetsRoutes = new Hono();
assetsRoutes.use("*", authMiddleware);

const assetSchema = z.object({
  type: z.enum(["stock", "property", "cash", "other"]),
  name: z.string().min(1).max(255),
  ticker: z.string().max(20).optional().nullable(),
  quantity: z.number().default(0),
  manualValue: z.number().optional().nullable(),
  ownershipPct: z.number().min(0).max(100).default(100),
});

// Get all assets for the current user
assetsRoutes.get("/", async (c) => {
  const user = c.get("user");
  
  const userAssets = await db.query.assets.findMany({
    where: eq(assets.userId, user.id),
    orderBy: (assets, { desc }) => [desc(assets.createdAt)],
  });

  return c.json(userAssets.map((asset) => ({
    ...asset,
    quantity: parseFloat(asset.quantity),
    manualValue: asset.manualValue ? parseFloat(asset.manualValue) : null,
    currentPrice: asset.currentPrice ? parseFloat(asset.currentPrice) : null,
    ownershipPct: parseFloat(asset.ownershipPct),
  })));
});

// Create a new asset
assetsRoutes.post("/", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const data = assetSchema.parse(body);

    // If it's a stock with a ticker, fetch current price
    let currentPrice: number | null = null;
    if (data.type === "stock" && data.ticker) {
      try {
        const quote = await yahooFinance.quote(data.ticker);
        currentPrice = quote.regularMarketPrice || null;
      } catch (e) {
        console.warn(`Could not fetch price for ${data.ticker}:`, e);
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
        manualValue: data.manualValue?.toString() || null,
        currentPrice: currentPrice?.toString() || null,
        ownershipPct: data.ownershipPct.toString(),
        lastPriceUpdate: currentPrice ? new Date() : null,
      })
      .returning();

    return c.json({
      ...newAsset,
      quantity: parseFloat(newAsset.quantity),
      manualValue: newAsset.manualValue ? parseFloat(newAsset.manualValue) : null,
      currentPrice: newAsset.currentPrice ? parseFloat(newAsset.currentPrice) : null,
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
      try {
        const quote = await yahooFinance.quote(data.ticker);
        currentPrice = quote.regularMarketPrice?.toString() || null;
        lastPriceUpdate = new Date();
      } catch (e) {
        console.warn(`Could not fetch price for ${data.ticker}:`, e);
      }
    }

    const [updated] = await db
      .update(assets)
      .set({
        type: data.type,
        name: data.name,
        ticker: data.ticker !== undefined ? (data.ticker || null) : existing.ticker,
        quantity: data.quantity !== undefined ? data.quantity.toString() : existing.quantity,
        manualValue: data.manualValue !== undefined ? (data.manualValue?.toString() || null) : existing.manualValue,
        currentPrice,
        ownershipPct: data.ownershipPct !== undefined ? data.ownershipPct.toString() : existing.ownershipPct,
        lastPriceUpdate,
      })
      .where(and(eq(assets.id, assetId), eq(assets.userId, user.id)))
      .returning();

    return c.json({
      ...updated,
      quantity: parseFloat(updated.quantity),
      manualValue: updated.manualValue ? parseFloat(updated.manualValue) : null,
      currentPrice: updated.currentPrice ? parseFloat(updated.currentPrice) : null,
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

// Refresh stock prices
assetsRoutes.post("/refresh-prices", async (c) => {
  const user = c.get("user");
  
  const userAssets = await db.query.assets.findMany({
    where: and(eq(assets.userId, user.id), eq(assets.type, "stock")),
  });

  const stockAssets = userAssets.filter((a) => a.ticker);
  
  for (const asset of stockAssets) {
    if (!asset.ticker) continue;
    
    try {
      const quote = await yahooFinance.quote(asset.ticker);
      await db
        .update(assets)
        .set({
          currentPrice: quote.regularMarketPrice?.toString() || null,
          lastPriceUpdate: new Date(),
        })
        .where(eq(assets.id, asset.id));
    } catch (e) {
      console.warn(`Could not fetch price for ${asset.ticker}:`, e);
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
    manualValue: asset.manualValue ? parseFloat(asset.manualValue) : null,
    currentPrice: asset.currentPrice ? parseFloat(asset.currentPrice) : null,
    ownershipPct: parseFloat(asset.ownershipPct),
  })));
});

export { assetsRoutes };


