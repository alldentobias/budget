import { Hono } from "hono";
import { z } from "zod";
import { db, incomes } from "../db/index.ts";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.ts";

const incomesRoutes = new Hono();
incomesRoutes.use("*", authMiddleware);

const incomeSchema = z.object({
  yearMonth: z.number(),
  amount: z.number().positive(),
  source: z.string().min(1).max(255),
  notes: z.string().optional().nullable(),
});

// Get incomes by month
incomesRoutes.get("/", async (c) => {
  const user = c.get("user");
  const yearMonth = parseInt(c.req.query("yearMonth") || "0");
  
  if (!yearMonth) {
    return c.json({ message: "yearMonth is required" }, 400);
  }

  const userIncomes = await db.query.incomes.findMany({
    where: and(eq(incomes.userId, user.id), eq(incomes.yearMonth, yearMonth)),
    orderBy: (incomes, { desc }) => [desc(incomes.createdAt)],
  });

  return c.json(userIncomes.map((income) => ({
    ...income,
    amount: parseFloat(income.amount),
  })));
});

// Create a new income
incomesRoutes.post("/", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const data = incomeSchema.parse(body);

    const [newIncome] = await db
      .insert(incomes)
      .values({
        userId: user.id,
        yearMonth: data.yearMonth,
        amount: data.amount.toString(),
        source: data.source,
        notes: data.notes || null,
      })
      .returning();

    return c.json({
      ...newIncome,
      amount: parseFloat(newIncome.amount),
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Create income error:", error);
    return c.json({ message: "Failed to create income" }, 500);
  }
});

// Update an income
incomesRoutes.put("/:id", async (c) => {
  try {
    const user = c.get("user");
    const incomeId = c.req.param("id");
    const body = await c.req.json();
    const data = incomeSchema.partial().parse(body);

    const [updated] = await db
      .update(incomes)
      .set({
        yearMonth: data.yearMonth,
        amount: data.amount?.toString(),
        source: data.source,
        notes: data.notes,
      })
      .where(and(eq(incomes.id, incomeId), eq(incomes.userId, user.id)))
      .returning();

    if (!updated) {
      return c.json({ message: "Income not found" }, 404);
    }

    return c.json({
      ...updated,
      amount: parseFloat(updated.amount),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Update income error:", error);
    return c.json({ message: "Failed to update income" }, 500);
  }
});

// Delete an income
incomesRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const incomeId = c.req.param("id");

  const deleted = await db
    .delete(incomes)
    .where(and(eq(incomes.id, incomeId), eq(incomes.userId, user.id)))
    .returning();

  if (deleted.length === 0) {
    return c.json({ message: "Income not found" }, 404);
  }

  return c.body(null, 204);
});

export { incomesRoutes };


