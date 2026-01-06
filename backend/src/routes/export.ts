import { Hono } from "hono";
import { db, expenses, assets, loans, incomes, categories } from "../db/index.ts";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.ts";

const exportRoutes = new Hono();
exportRoutes.use("*", authMiddleware);

// Export all data
exportRoutes.get("/all", async (c) => {
  const user = c.get("user");
  const format = c.req.query("format") || "json";

  const [userExpenses, userAssets, userLoans, userIncomes, userCategories] = await Promise.all([
    db.query.expenses.findMany({
      where: eq(expenses.userId, user.id),
      with: { category: true },
      orderBy: (expenses, { desc }) => [desc(expenses.date)],
    }),
    db.query.assets.findMany({
      where: eq(assets.userId, user.id),
    }),
    db.query.loans.findMany({
      where: eq(loans.userId, user.id),
    }),
    db.query.incomes.findMany({
      where: eq(incomes.userId, user.id),
    }),
    db.query.categories.findMany({
      where: eq(categories.userId, user.id),
    }),
  ]);

  const data = {
    exportDate: new Date().toISOString(),
    expenses: userExpenses.map((e) => ({
      ...e,
      amount: parseFloat(e.amount),
    })),
    assets: userAssets.map((a) => ({
      ...a,
      quantity: parseFloat(a.quantity),
      manualValue: a.manualValue ? parseFloat(a.manualValue) : null,
      currentPrice: a.currentPrice ? parseFloat(a.currentPrice) : null,
      ownershipPct: parseFloat(a.ownershipPct),
    })),
    loans: userLoans.map((l) => ({
      ...l,
      principal: parseFloat(l.principal),
      currentBalance: parseFloat(l.currentBalance),
      interestRate: parseFloat(l.interestRate),
      ownershipPct: parseFloat(l.ownershipPct),
    })),
    incomes: userIncomes.map((i) => ({
      ...i,
      amount: parseFloat(i.amount),
    })),
    categories: userCategories,
  };

  if (format === "csv") {
    // Create a simple CSV for expenses only
    const headers = ["Date", "Title", "Amount", "Category", "Description", "Notes", "YearMonth"];
    const rows = userExpenses.map((e) => [
      e.date,
      `"${e.title.replace(/"/g, '""')}"`,
      parseFloat(e.amount),
      e.category?.name || "",
      e.description ? `"${e.description.replace(/"/g, '""')}"` : "",
      e.notes ? `"${e.notes.replace(/"/g, '""')}"` : "",
      e.yearMonth,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="budget-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="budget-export-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
});

// Export expenses only
exportRoutes.get("/expenses", async (c) => {
  const user = c.get("user");
  const format = c.req.query("format") || "csv";
  const yearMonth = c.req.query("yearMonth");

  const where = yearMonth
    ? and(eq(expenses.userId, user.id), eq(expenses.yearMonth, parseInt(yearMonth)))
    : eq(expenses.userId, user.id);

  const userExpenses = await db.query.expenses.findMany({
    where,
    with: { category: true },
    orderBy: (expenses, { desc }) => [desc(expenses.date)],
  });

  if (format === "json") {
    const data = userExpenses.map((e) => ({
      ...e,
      amount: parseFloat(e.amount),
    }));

    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="expenses-${yearMonth || "all"}.json"`,
      },
    });
  }

  // CSV format
  const headers = ["Date", "Title", "Amount", "Category", "Description", "Notes"];
  const rows = userExpenses.map((e) => [
    e.date,
    `"${e.title.replace(/"/g, '""')}"`,
    parseFloat(e.amount),
    e.category?.name || "",
    e.description ? `"${e.description.replace(/"/g, '""')}"` : "",
    e.notes ? `"${e.notes.replace(/"/g, '""')}"` : "",
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="expenses-${yearMonth || "all"}.csv"`,
    },
  });
});

export { exportRoutes };


