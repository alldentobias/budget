import { Hono } from "hono";
import { assets, categories, db, expenses, incomes, loans } from "../db/index.ts";
import { and, eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.ts";

const exportRoutes = new Hono();
exportRoutes.use("*", authMiddleware);

// Helper to convert minor units to major units for display
function toMajorUnits(minorUnits: number | null | undefined): number | null {
  if (minorUnits == null) return null;
  return minorUnits / 100;
}

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

  // Convert from minor units to major units for human-readable export
  const data = {
    exportDate: new Date().toISOString(),
    expenses: userExpenses.map((e) => ({
      ...e,
      amount: toMajorUnits(e.amount),
      collectToMe: toMajorUnits(e.collectToMe),
      collectFromMe: toMajorUnits(e.collectFromMe),
    })),
    assets: userAssets.map((a) => ({
      ...a,
      quantity: parseFloat(a.quantity),
      manualValue: toMajorUnits(a.manualValue),
      currentPrice: toMajorUnits(a.currentPrice),
      ownershipPct: parseFloat(a.ownershipPct),
    })),
    loans: userLoans.map((l) => ({
      ...l,
      principal: toMajorUnits(l.principal),
      currentBalance: toMajorUnits(l.currentBalance),
      interestRate: parseFloat(l.interestRate),
      ownershipPct: parseFloat(l.ownershipPct),
    })),
    incomes: userIncomes.map((i) => ({
      ...i,
      amount: toMajorUnits(i.amount),
    })),
    categories: userCategories,
  };

  if (format === "csv") {
    // Create a simple CSV for expenses only (human-readable amounts)
    const headers = [
      "Date",
      "Title",
      "Amount",
      "Category",
      "Description",
      "Notes",
      "YearMonth",
    ];
    const rows = userExpenses.map((e) => [
      e.date,
      `"${e.title.replace(/"/g, '""')}"`,
      toMajorUnits(e.amount),
      e.category?.name || "",
      e.description ? `"${e.description.replace(/"/g, '""')}"` : "",
      e.notes ? `"${e.notes.replace(/"/g, '""')}"` : "",
      e.yearMonth,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="budget-export-${
          new Date().toISOString().split("T")[0]
        }.csv"`,
      },
    });
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="budget-export-${
        new Date().toISOString().split("T")[0]
      }.json"`,
    },
  });
});

// Export expenses only
exportRoutes.get("/expenses", async (c) => {
  const user = c.get("user");
  const format = c.req.query("format") || "csv";
  const yearMonth = c.req.query("yearMonth");

  const where = yearMonth
    ? and(
      eq(expenses.userId, user.id),
      eq(expenses.yearMonth, parseInt(yearMonth)),
    )
    : eq(expenses.userId, user.id);

  const userExpenses = await db.query.expenses.findMany({
    where,
    with: { category: true },
    orderBy: (expenses, { desc }) => [desc(expenses.date)],
  });

  if (format === "json") {
    const data = userExpenses.map((e) => ({
      ...e,
      amount: toMajorUnits(e.amount),
      collectToMe: toMajorUnits(e.collectToMe),
      collectFromMe: toMajorUnits(e.collectFromMe),
    }));

    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="expenses-${yearMonth || "all"}.json"`,
      },
    });
  }

  // CSV format (human-readable amounts)
  const headers = [
    "Date",
    "Title",
    "Amount",
    "Category",
    "Description",
    "Notes",
  ];
  const rows = userExpenses.map((e) => [
    e.date,
    `"${e.title.replace(/"/g, '""')}"`,
    toMajorUnits(e.amount),
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
