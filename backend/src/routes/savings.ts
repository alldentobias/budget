import { Hono } from "hono";
import { z } from "zod";
import { db, savings } from "../db/index.ts";
import { and, eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.ts";

const savingsRoutes = new Hono();
savingsRoutes.use("*", authMiddleware);

// Amount is in minor units (øre/cents) - integers
const savingSchema = z.object({
  yearMonth: z.number(),
  amount: z.number().int().positive(), // Integer in minor units
  source: z.string().min(1).max(255),
  notes: z.string().optional().nullable(),
});

// Get savings by month
savingsRoutes.get("/", async (c) => {
  const user = c.get("user");
  const yearMonth = parseInt(c.req.query("yearMonth") || "0");

  if (!yearMonth) {
    return c.json({ message: "yearMonth is required" }, 400);
  }

  const userSavings = await db.query.savings.findMany({
    where: and(eq(savings.userId, user.id), eq(savings.yearMonth, yearMonth)),
    orderBy: (savings, { desc }) => [desc(savings.createdAt)],
  });

  // With bigint mode: "number", amounts come back as actual numbers
  return c.json(userSavings);
});

// Create a new saving
savingsRoutes.post("/", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const data = savingSchema.parse(body);

    const [newSaving] = await db
      .insert(savings)
      .values({
        userId: user.id,
        yearMonth: data.yearMonth,
        amount: data.amount,
        source: data.source,
        notes: data.notes || null,
      })
      .returning();

    return c.json(newSaving, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Create saving error:", error);
    return c.json({ message: "Failed to create saving" }, 500);
  }
});

// Update a saving
savingsRoutes.put("/:id", async (c) => {
  try {
    const user = c.get("user");
    const savingId = c.req.param("id");
    const body = await c.req.json();
    const data = savingSchema.partial().parse(body);

    const [updated] = await db
      .update(savings)
      .set({
        yearMonth: data.yearMonth,
        amount: data.amount,
        source: data.source,
        notes: data.notes,
      })
      .where(and(eq(savings.id, savingId), eq(savings.userId, user.id)))
      .returning();

    if (!updated) {
      return c.json({ message: "Saving not found" }, 404);
    }

    return c.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Update saving error:", error);
    return c.json({ message: "Failed to update saving" }, 500);
  }
});

// Delete a saving
savingsRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const savingId = c.req.param("id");

  const deleted = await db
    .delete(savings)
    .where(and(eq(savings.id, savingId), eq(savings.userId, user.id)))
    .returning();

  if (deleted.length === 0) {
    return c.json({ message: "Saving not found" }, 404);
  }

  return c.body(null, 204);
});

export { savingsRoutes };
