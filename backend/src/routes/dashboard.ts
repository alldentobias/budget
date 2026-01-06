import { Hono } from "hono";
import {
  assets,
  categories,
  db,
  expenses,
  incomes,
  loans,
  netWorthSnapshots,
} from "../db/index.ts";
import { and, desc, eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.ts";

const dashboardRoutes = new Hono();
dashboardRoutes.use("*", authMiddleware);

function getCurrentYearMonth() {
  const now = new Date();
  return now.getFullYear() * 100 + (now.getMonth() + 1);
}

dashboardRoutes.get("/summary", async (c) => {
  const user = c.get("user");
  const yearMonthParam = c.req.query("yearMonth");
  const currentYearMonth = yearMonthParam
    ? parseInt(yearMonthParam)
    : getCurrentYearMonth();

  // Fetch all data in parallel
  const [
    userAssets,
    userLoans,
    monthlyExpenses,
    monthlyIncomes,
    userCategories,
  ] = await Promise.all([
    db.query.assets.findMany({
      where: eq(assets.userId, user.id),
    }),
    db.query.loans.findMany({
      where: eq(loans.userId, user.id),
    }),
    db.query.expenses.findMany({
      where: and(
        eq(expenses.userId, user.id),
        eq(expenses.yearMonth, currentYearMonth),
      ),
      with: { category: true },
    }),
    db.query.incomes.findMany({
      where: and(
        eq(incomes.userId, user.id),
        eq(incomes.yearMonth, currentYearMonth),
      ),
    }),
    db.query.categories.findMany({
      where: eq(categories.userId, user.id),
    }),
  ]);

  // Calculate total assets (all amounts are in minor units)
  let totalAssets = 0;
  let stockPortfolioValue = 0;

  for (const asset of userAssets) {
    const ownership = parseFloat(asset.ownershipPct) / 100;

    if (asset.type === "stock" && asset.currentPrice != null) {
      // currentPrice is in minor units, quantity is decimal
      const value = parseFloat(asset.quantity) * asset.currentPrice * ownership;
      totalAssets += value;
      stockPortfolioValue += value;
    } else if (asset.manualValue != null) {
      // manualValue is in minor units
      totalAssets += asset.manualValue * ownership;
    }
  }

  // Calculate total liabilities (all amounts are in minor units)
  let totalLiabilities = 0;
  for (const loan of userLoans) {
    const ownership = parseFloat(loan.ownershipPct) / 100;
    totalLiabilities += loan.currentBalance * ownership;
  }

  // Net worth (in minor units)
  const netWorth = totalAssets - totalLiabilities;

  // Debt to asset ratio (percentage)
  const debtToAssetRatio = totalAssets > 0
    ? (totalLiabilities / totalAssets) * 100
    : 0;

  // Monthly expenses (positive amounts are expenses, shared expenses count as half)
  // amounts are in minor units
  const expensesTotal = monthlyExpenses
    .filter((e) => e.amount > 0)
    .reduce((sum, e) => {
      const amount = e.amount;
      return sum + (e.isShared ? Math.floor(amount / 2) : amount);
    }, 0);

  // Monthly income (in minor units)
  const incomeTotal = monthlyIncomes.reduce(
    (sum, i) => sum + i.amount,
    0,
  );

  // Top spending categories (shared expenses count as half)
  const categorySpending = new Map<
    string,
    { name: string; color: string; amount: number }
  >();

  for (const expense of monthlyExpenses) {
    if (expense.amount <= 0) continue; // Skip non-expenses

    const catId = expense.categoryId || "uncategorized";
    const catName = expense.category?.name || "Uncategorized";
    const catColor = expense.category?.color || "#6b7280";
    const amount = expense.amount;
    const effectiveAmount = expense.isShared ? Math.floor(amount / 2) : amount;

    const existing = categorySpending.get(catId) ||
      { name: catName, color: catColor, amount: 0 };
    existing.amount += effectiveAmount;
    categorySpending.set(catId, existing);
  }

  const topCategories = Array.from(categorySpending.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return c.json({
    totalAssets,
    totalLiabilities,
    netWorth,
    debtToAssetRatio,
    monthlyExpenses: expensesTotal,
    monthlyIncome: incomeTotal,
    stockPortfolioValue,
    topCategories,
  });
});

// Get net worth history
dashboardRoutes.get("/net-worth-history", async (c) => {
  const user = c.get("user");

  const snapshots = await db.query.netWorthSnapshots.findMany({
    where: eq(netWorthSnapshots.userId, user.id),
    orderBy: [desc(netWorthSnapshots.yearMonth)],
  });

  // Values are already numbers (bigint mode: "number")
  return c.json(snapshots);
});

// Record a net worth snapshot for current month
dashboardRoutes.post("/record-snapshot", async (c) => {
  const user = c.get("user");
  const currentYearMonth = getCurrentYearMonth();

  // Calculate current net worth
  const [userAssets, userLoans] = await Promise.all([
    db.query.assets.findMany({
      where: eq(assets.userId, user.id),
    }),
    db.query.loans.findMany({
      where: eq(loans.userId, user.id),
    }),
  ]);

  let totalAssets = 0;
  for (const asset of userAssets) {
    const ownership = parseFloat(asset.ownershipPct) / 100;
    if (asset.type === "stock" && asset.currentPrice != null) {
      totalAssets += Math.round(parseFloat(asset.quantity) * asset.currentPrice * ownership);
    } else if (asset.manualValue != null) {
      totalAssets += Math.round(asset.manualValue * ownership);
    }
  }

  let totalLiabilities = 0;
  for (const loan of userLoans) {
    const ownership = parseFloat(loan.ownershipPct) / 100;
    totalLiabilities += Math.round(loan.currentBalance * ownership);
  }

  const netWorth = totalAssets - totalLiabilities;

  // Check if a snapshot for this month already exists
  const existing = await db.query.netWorthSnapshots.findFirst({
    where: and(
      eq(netWorthSnapshots.userId, user.id),
      eq(netWorthSnapshots.yearMonth, currentYearMonth),
    ),
  });

  let snapshot;
  if (existing) {
    // Update existing snapshot
    const [updated] = await db
      .update(netWorthSnapshots)
      .set({
        totalAssets: totalAssets,
        totalLiabilities: totalLiabilities,
        netWorth: netWorth,
      })
      .where(eq(netWorthSnapshots.id, existing.id))
      .returning();
    snapshot = updated;
  } else {
    // Create new snapshot
    const [created] = await db
      .insert(netWorthSnapshots)
      .values({
        userId: user.id,
        yearMonth: currentYearMonth,
        totalAssets: totalAssets,
        totalLiabilities: totalLiabilities,
        netWorth: netWorth,
      })
      .returning();
    snapshot = created;
  }

  return c.json(snapshot);
});

export { dashboardRoutes };
