import { Hono } from "hono";
import { z } from "zod";
import { categories, db, expenses } from "../db/index.ts";
import { and, eq, sql } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.ts";

const expensesRoutes = new Hono();
expensesRoutes.use("*", authMiddleware);

// All amounts are in minor units (øre/cents) - integers
const expenseSchema = z.object({
  categoryId: z.string().uuid().optional().nullable(),
  date: z.string(), // ISO date string
  amount: z.number().int(), // Integer in minor units (e.g., 1250 = 12.50 kr)
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isShared: z.boolean().optional(), // Auto-splits expense 50/50
  collectToMe: z.number().int().optional(), // Amount to collect from partner (minor units)
  collectFromMe: z.number().int().optional(), // Amount to pay to partner (minor units)
  settled: z.boolean().optional(),
  yearMonth: z.number().optional(),
});

// Get expenses by month
expensesRoutes.get("/", async (c) => {
  const user = c.get("user");
  const yearMonth = parseInt(c.req.query("yearMonth") || "0");

  if (!yearMonth) {
    return c.json({ message: "yearMonth is required" }, 400);
  }

  const userExpenses = await db.query.expenses.findMany({
    where: and(eq(expenses.userId, user.id), eq(expenses.yearMonth, yearMonth)),
    with: {
      category: true,
    },
    orderBy: (expenses, { desc }) => [desc(expenses.date)],
  });

  // With bigint mode: "number", amounts come back as actual numbers
  return c.json(userExpenses);
});

// Get expense stats by month
expensesRoutes.get("/stats", async (c) => {
  const user = c.get("user");
  const yearMonth = parseInt(c.req.query("yearMonth") || "0");

  if (!yearMonth) {
    return c.json({ message: "yearMonth is required" }, 400);
  }

  const userExpenses = await db.query.expenses.findMany({
    where: and(eq(expenses.userId, user.id), eq(expenses.yearMonth, yearMonth)),
    with: {
      category: true,
    },
  });

  // Total expenses: shared expenses count as half (your portion from joint account)
  // Amounts are now integers in minor units
  const total = userExpenses.reduce((sum, e) => {
    const amount = e.amount;
    return sum + (e.isShared ? Math.floor(amount / 2) : amount);
  }, 0);

  // Calculate settlement totals (amounts in minor units)
  // Return separate totals for UI display
  const totalCollectToMe = userExpenses
    .filter((e) => e.collectToMe > 0 && !e.settled)
    .reduce((sum, e) => sum + e.collectToMe, 0);

  const totalCollectFromMe = userExpenses
    .filter((e) => e.collectFromMe > 0 && !e.settled)
    .reduce((sum, e) => sum + e.collectFromMe, 0);

  const settledToMe = userExpenses
    .filter((e) => e.collectToMe > 0 && e.settled)
    .reduce((sum, e) => sum + e.collectToMe, 0);

  const settledFromMe = userExpenses
    .filter((e) => e.collectFromMe > 0 && e.settled)
    .reduce((sum, e) => sum + e.collectFromMe, 0);

  // Group by category (shared expenses count as half)
  const byCategory = new Map<
    string,
    { name: string; color: string; amount: number; count: number }
  >();

  for (const expense of userExpenses) {
    const catId = expense.categoryId || "uncategorized";
    const catName = expense.category?.name || "Uncategorized";
    const catColor = expense.category?.color || "#6b7280";
    const amount = expense.amount;
    const effectiveAmount = expense.isShared ? Math.floor(amount / 2) : amount;

    const existing = byCategory.get(catId) ||
      { name: catName, color: catColor, amount: 0, count: 0 };
    existing.amount += effectiveAmount;
    existing.count += 1;
    byCategory.set(catId, existing);
  }

  return c.json({
    total,
    count: userExpenses.length,
    totalCollectToMe, // Renamed: total amount others owe you
    totalCollectFromMe, // Renamed: total amount you owe others
    settledToMe,
    settledFromMe,
    netSettlement: totalCollectToMe - totalCollectFromMe, // Positive means they owe you
    byCategory: Array.from(byCategory.entries()).map(([categoryId, data]) => ({
      categoryId,
      ...data,
    })).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
  });
});

// Create a new expense
expensesRoutes.post("/", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const data = expenseSchema.parse(body);

    const [newExpense] = await db
      .insert(expenses)
      .values({
        userId: user.id,
        categoryId: data.categoryId || null,
        date: data.date,
        amount: data.amount,
        title: data.title,
        description: data.description || null,
        notes: data.notes || null,
        isShared: data.isShared ?? false,
        collectToMe: data.collectToMe ?? 0,
        collectFromMe: data.collectFromMe ?? 0,
        settled: data.settled ?? false,
        yearMonth: data.yearMonth!,
      })
      .returning();

    // Fetch with category
    const created = await db.query.expenses.findFirst({
      where: eq(expenses.id, newExpense.id),
      with: { category: true },
    });

    return c.json(created, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Create expense error:", error);
    return c.json({ message: "Failed to create expense" }, 500);
  }
});

// Bulk update expenses (must be before /:id to avoid route conflict)
expensesRoutes.put("/bulk", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const { updates } = z.object({
      updates: z.array(z.object({
        id: z.string().uuid(),
        categoryId: z.string().uuid().optional().nullable(),
        notes: z.string().optional().nullable(),
        isShared: z.boolean().optional(),
        collectToMe: z.number().int().optional(),
        collectFromMe: z.number().int().optional(),
        settled: z.boolean().optional(),
      })),
    }).parse(body);

    const results = [];

    for (const update of updates) {
      const [updated] = await db
        .update(expenses)
        .set({
          categoryId: update.categoryId !== undefined
            ? (update.categoryId || null)
            : undefined,
          notes: update.notes,
          isShared: update.isShared,
          collectToMe: update.collectToMe,
          collectFromMe: update.collectFromMe,
          settled: update.settled,
        })
        .where(and(eq(expenses.id, update.id), eq(expenses.userId, user.id)))
        .returning();

      if (updated) {
        const result = await db.query.expenses.findFirst({
          where: eq(expenses.id, updated.id),
          with: { category: true },
        });
        results.push(result);
      }
    }

    return c.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Bulk update error:", error);
    return c.json({ message: "Failed to update expenses" }, 500);
  }
});

// Update an expense
expensesRoutes.put("/:id", async (c) => {
  try {
    const user = c.get("user");
    const expenseId = c.req.param("id");
    const body = await c.req.json();
    const data = expenseSchema.partial().parse(body);

    const [updated] = await db
      .update(expenses)
      .set({
        categoryId: data.categoryId !== undefined
          ? (data.categoryId || null)
          : undefined,
        date: data.date,
        amount: data.amount,
        title: data.title,
        description: data.description,
        notes: data.notes,
        isShared: data.isShared,
        collectToMe: data.collectToMe,
        collectFromMe: data.collectFromMe,
        settled: data.settled,
        yearMonth: data.yearMonth,
      })
      .where(and(eq(expenses.id, expenseId), eq(expenses.userId, user.id)))
      .returning();

    if (!updated) {
      return c.json({ message: "Expense not found" }, 404);
    }

    // Fetch with category
    const result = await db.query.expenses.findFirst({
      where: eq(expenses.id, updated.id),
      with: { category: true },
    });

    return c.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Update expense error:", error);
    return c.json({ message: "Failed to update expense" }, 500);
  }
});

// Bulk delete expenses (must be before /:id to avoid route conflict)
expensesRoutes.delete("/bulk", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const { ids } = z.object({
      ids: z.array(z.string().uuid()),
    }).parse(body);

    let deletedCount = 0;
    for (const id of ids) {
      const result = await db
        .delete(expenses)
        .where(and(eq(expenses.id, id), eq(expenses.userId, user.id)))
        .returning();
      if (result.length > 0) deletedCount++;
    }

    return c.json({ deleted: deletedCount });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Bulk delete error:", error);
    return c.json({ message: "Failed to delete expenses" }, 500);
  }
});

// Delete an expense
expensesRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const expenseId = c.req.param("id");

  const deleted = await db
    .delete(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, user.id)))
    .returning();

  if (deleted.length === 0) {
    return c.json({ message: "Expense not found" }, 404);
  }

  return c.body(null, 204);
});

export { expensesRoutes };
