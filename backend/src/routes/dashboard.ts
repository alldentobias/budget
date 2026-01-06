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

  // Calculate total assets
  let totalAssets = 0;
  let stockPortfolioValue = 0;

  for (const asset of userAssets) {
    const ownership = parseFloat(asset.ownershipPct) / 100;

    if (asset.type === "stock" && asset.currentPrice) {
      const value = parseFloat(asset.quantity) *
        parseFloat(asset.currentPrice) * ownership;
      totalAssets += value;
      stockPortfolioValue += value;
    } else if (asset.manualValue) {
      totalAssets += parseFloat(asset.manualValue) * ownership;
    }
  }

  // Calculate total liabilities
  let totalLiabilities = 0;
  for (const loan of userLoans) {
    const ownership = parseFloat(loan.ownershipPct) / 100;
    totalLiabilities += parseFloat(loan.currentBalance) * ownership;
  }

  // Net worth
  const netWorth = totalAssets - totalLiabilities;

  // Debt to asset ratio
  const debtToAssetRatio = totalAssets > 0
    ? (totalLiabilities / totalAssets) * 100
    : 0;

  // Monthly expenses (positive amounts are expenses, shared expenses count as half)
  const expensesTotal = monthlyExpenses
    .filter((e) => parseFloat(e.amount) > 0)
    .reduce((sum, e) => {
      const amount = Math.abs(parseFloat(e.amount));
      return sum + (e.isShared ? amount / 2 : amount);
    }, 0);

  // Monthly income
  const incomeTotal = monthlyIncomes.reduce(
    (sum, i) => sum + parseFloat(i.amount),
    0,
  );

  // Top spending categories (shared expenses count as half)
  const categorySpending = new Map<
    string,
    { name: string; color: string; amount: number }
  >();

  for (const expense of monthlyExpenses) {
    if (parseFloat(expense.amount) <= 0) continue; // Skip non-expenses

    const catId = expense.categoryId || "uncategorized";
    const catName = expense.category?.name || "Uncategorized";
    const catColor = expense.category?.color || "#6b7280";
    const amount = Math.abs(parseFloat(expense.amount));
    const effectiveAmount = expense.isShared ? amount / 2 : amount;

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

  return c.json(snapshots.map((s) => ({
    ...s,
    totalAssets: parseFloat(s.totalAssets),
    totalLiabilities: parseFloat(s.totalLiabilities),
    netWorth: parseFloat(s.netWorth),
  })));
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
    if (asset.type === "stock" && asset.currentPrice) {
      totalAssets += parseFloat(asset.quantity) *
        parseFloat(asset.currentPrice) * ownership;
    } else if (asset.manualValue) {
      totalAssets += parseFloat(asset.manualValue) * ownership;
    }
  }

  let totalLiabilities = 0;
  for (const loan of userLoans) {
    const ownership = parseFloat(loan.ownershipPct) / 100;
    totalLiabilities += parseFloat(loan.currentBalance) * ownership;
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
        totalAssets: totalAssets.toString(),
        totalLiabilities: totalLiabilities.toString(),
        netWorth: netWorth.toString(),
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
        totalAssets: totalAssets.toString(),
        totalLiabilities: totalLiabilities.toString(),
        netWorth: netWorth.toString(),
      })
      .returning();
    snapshot = created;
  }

  return c.json({
    ...snapshot,
    totalAssets: parseFloat(snapshot.totalAssets),
    totalLiabilities: parseFloat(snapshot.totalLiabilities),
    netWorth: parseFloat(snapshot.netWorth),
  });
});

export { dashboardRoutes };
