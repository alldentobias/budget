import { Hono } from "hono";
import { z } from "zod";
import { db, expenses, stagedExpenses } from "../db/index.ts";
import { and, eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.ts";

const importRoutes = new Hono();
importRoutes.use("*", authMiddleware);

const PYTHON_SERVICE_URL = Deno.env.get("PYTHON_SERVICE_URL") ||
  "http://localhost:8001";

// Helper to get yearMonth from a date string
function dateToYearMonth(dateStr: string): number {
  const date = new Date(dateStr);
  return date.getFullYear() * 100 + (date.getMonth() + 1);
}

// Get available extractors from Python service
importRoutes.get("/extractors", async (c) => {
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/extractors`);
    if (!response.ok) {
      throw new Error("Failed to fetch extractors");
    }
    return c.json(await response.json());
  } catch (error) {
    console.error("Fetch extractors error:", error);
    return c.json({ extractors: [] });
  }
});

// Upload and extract transactions
importRoutes.post("/upload", async (c) => {
  try {
    const user = c.get("user");
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    const extractor = formData.get("extractor") as string;
    const yearMonthStr = formData.get("yearMonth") as string;
    const targetYearMonth = yearMonthStr ? parseInt(yearMonthStr) : null;

    if (!file || !extractor) {
      return c.json({ message: "File and extractor are required" }, 400);
    }

    // Forward to Python service
    const pythonFormData = new FormData();
    pythonFormData.append("file", file);
    pythonFormData.append("extractor", extractor);

    const response = await fetch(`${PYTHON_SERVICE_URL}/extract`, {
      method: "POST",
      body: pythonFormData,
    });

    if (!response.ok) {
      const error = await response.json();
      return c.json(
        { message: error.detail || "Extraction failed" },
        response.status,
      );
    }

    const result = await response.json();
    let transactions = result.transactions;

    // Filter transactions by target month if specified
    if (targetYearMonth) {
      transactions = transactions.filter((tx: { date: string }) => {
        const txYearMonth = dateToYearMonth(tx.date);
        return txYearMonth === targetYearMonth;
      });
    }

    // Clear existing staged expenses for this month to avoid confusion
    if (targetYearMonth) {
      await db
        .delete(stagedExpenses)
        .where(and(
          eq(stagedExpenses.userId, user.id),
          eq(stagedExpenses.yearMonth, targetYearMonth),
        ));
    }

    // Get existing expenses for the target month to check for duplicates
    const yearMonthToCheck = targetYearMonth || dateToYearMonth(transactions[0]?.date || new Date().toISOString());
    const existingExpenses = await db.query.expenses.findMany({
      where: and(
        eq(expenses.userId, user.id),
        eq(expenses.yearMonth, yearMonthToCheck),
      ),
    });

    let duplicateCount = 0;
    let filteredCount = result.transactions.length - transactions.length;
    const staged = [];

    for (const tx of transactions) {
      // Use target yearMonth if provided, otherwise calculate from date
      const yearMonth = targetYearMonth || dateToYearMonth(tx.date);

      // Amount is now in minor units (integer) from Python service
      const amount = tx.amount;
      const title = tx.title?.trim();
      const source = tx.source || null;

      // Check for duplicates: same month, amount, title, and source
      const duplicate = existingExpenses.find(
        (e) =>
          e.yearMonth === yearMonth &&
          e.amount === amount &&
          e.title?.trim() === title &&
          (e.source || null) === source,
      );

      const isDuplicate = !!duplicate;
      if (isDuplicate) duplicateCount++;

      const [stagingEntry] = await db
        .insert(stagedExpenses)
        .values({
          userId: user.id,
          date: tx.date,
          amount: amount,
          title: tx.title,
          source: tx.source || null,
          rawData: tx.raw_data || null,
          isShared: tx.isShared || false,
          isDuplicate,
          duplicateOf: duplicate?.id || null,
          yearMonth,
          collectToMe: 0,
          collectFromMe: 0,
          notes: null,
        })
        .returning();

      staged.push(stagingEntry);
    }

    return c.json({
      success: true,
      message: `Extracted ${transactions.length} transactions`,
      staged: staged.length,
      duplicates: duplicateCount,
      filteredByMonth: filteredCount,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return c.json({ message: "Upload failed" }, 500);
  }
});

// Get staged expenses by month
importRoutes.get("/staged", async (c) => {
  const user = c.get("user");
  const yearMonth = parseInt(c.req.query("yearMonth") || "0");

  const where = yearMonth
    ? and(
      eq(stagedExpenses.userId, user.id),
      eq(stagedExpenses.yearMonth, yearMonth),
    )
    : eq(stagedExpenses.userId, user.id);

  const staged = await db.query.stagedExpenses.findMany({
    where,
    with: {
      category: true,
    },
    orderBy: (stagedExpenses, { desc }) => [desc(stagedExpenses.date)],
  });

  // With bigint mode: "number", amounts come back as actual numbers
  return c.json(staged);
});

// Update a staged expense
importRoutes.put("/staged/:id", async (c) => {
  try {
    const user = c.get("user");
    const stagedId = c.req.param("id");
    const body = await c.req.json();

    const data = z.object({
      categoryId: z.string().uuid().optional().nullable(),
      title: z.string().optional(),
      amount: z.number().int().optional(), // Integer in minor units
      date: z.string().optional(),
      notes: z.string().optional().nullable(),
      isShared: z.boolean().optional(),
      collectToMe: z.number().int().optional(), // Integer in minor units
      collectFromMe: z.number().int().optional(), // Integer in minor units
    }).parse(body);

    const [updated] = await db
      .update(stagedExpenses)
      .set({
        categoryId: data.categoryId !== undefined
          ? (data.categoryId || null)
          : undefined,
        title: data.title,
        amount: data.amount,
        date: data.date,
        notes: data.notes,
        isShared: data.isShared,
        collectToMe: data.collectToMe,
        collectFromMe: data.collectFromMe,
      })
      .where(
        and(
          eq(stagedExpenses.id, stagedId),
          eq(stagedExpenses.userId, user.id),
        ),
      )
      .returning();

    if (!updated) {
      return c.json({ message: "Staged expense not found" }, 404);
    }

    const result = await db.query.stagedExpenses.findFirst({
      where: eq(stagedExpenses.id, updated.id),
      with: { category: true },
    });

    return c.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Update staged error:", error);
    return c.json({ message: "Failed to update staged expense" }, 500);
  }
});

// Delete a staged expense
importRoutes.delete("/staged/:id", async (c) => {
  const user = c.get("user");
  const stagedId = c.req.param("id");

  const deleted = await db
    .delete(stagedExpenses)
    .where(
      and(eq(stagedExpenses.id, stagedId), eq(stagedExpenses.userId, user.id)),
    )
    .returning();

  if (deleted.length === 0) {
    return c.json({ message: "Staged expense not found" }, 404);
  }

  return c.body(null, 204);
});

// Commit staged expenses to expenses table
importRoutes.post("/commit", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const { yearMonth } = z.object({
      yearMonth: z.number(),
    }).parse(body);

    // Get all non-duplicate staged expenses for this month
    const toCommit = await db.query.stagedExpenses.findMany({
      where: and(
        eq(stagedExpenses.userId, user.id),
        eq(stagedExpenses.yearMonth, yearMonth),
        eq(stagedExpenses.isDuplicate, false),
      ),
    });

    if (toCommit.length === 0) {
      return c.json({ committed: 0 });
    }

    // Insert into expenses
    for (const staged of toCommit) {
      await db.insert(expenses).values({
        userId: user.id,
        categoryId: staged.categoryId,
        date: staged.date,
        amount: staged.amount,
        title: staged.title,
        notes: staged.notes,
        source: staged.source,
        sourceFile: "import",
        isShared: staged.isShared,
        collectToMe: staged.collectToMe,
        collectFromMe: staged.collectFromMe,
        yearMonth: staged.yearMonth,
      });
    }

    // Delete all staged expenses for this month
    await db
      .delete(stagedExpenses)
      .where(and(
        eq(stagedExpenses.userId, user.id),
        eq(stagedExpenses.yearMonth, yearMonth),
      ));

    return c.json({ committed: toCommit.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Commit error:", error);
    return c.json({ message: "Failed to commit expenses" }, 500);
  }
});

export { importRoutes };
