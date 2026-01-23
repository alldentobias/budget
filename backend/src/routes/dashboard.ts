import { Hono } from "hono";
import { assets, db, expenses, incomes, loans, netWorthSnapshots, savings } from "../db/index.ts";
import { and, desc, eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.ts";

const dashboardRoutes = new Hono();
dashboardRoutes.use("*", authMiddleware);

function getCurrentYearMonth(): number {
  const now = new Date();
  return now.getFullYear() * 100 + (now.getMonth() + 1);
}

function getCurrentYearWeek(): number {
  const now = new Date();
  // Calculate ISO week number
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  // Use ISO year (can differ from calendar year at year boundaries)
  const thursday = new Date(now);
  thursday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + 3);
  const isoYear = thursday.getFullYear();
  return isoYear * 100 + weekNumber;
}

dashboardRoutes.get("/summary", async (c) => {
  const user = c.get("user");
  const yearMonthParam = c.req.query("yearMonth");
  const currentYearMonth = yearMonthParam ? parseInt(yearMonthParam) : getCurrentYearMonth();

  // Fetch all data in parallel
  const [
    userAssets,
    userLoans,
    monthlyExpenses,
    monthlyIncomes,
    monthlySavings,
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
    db.query.savings.findMany({
      where: and(
        eq(savings.userId, user.id),
        eq(savings.yearMonth, currentYearMonth),
      ),
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
  const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

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

  // Monthly savings (in minor units)
  const savingsTotal = monthlySavings.reduce(
    (sum, s) => sum + s.amount,
    0,
  );

  // Top spending categories (shared expenses count as half)
  const categorySpending = new Map<
    string,
    { name: string; color: string; amount: number }
  >();

  // Shared expenses category breakdown (full amounts for shared account view)
  const sharedCategorySpending = new Map<
    string,
    { name: string; color: string; amount: number }
  >();

  // Non-shared expenses only (personal spending)
  const nonSharedCategorySpending = new Map<
    string,
    { name: string; color: string; amount: number }
  >();

  let sharedExpensesTotal = 0;

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

    // Track shared expenses separately (full amount)
    if (expense.isShared) {
      sharedExpensesTotal += amount;
      const existingShared = sharedCategorySpending.get(catId) ||
        { name: catName, color: catColor, amount: 0 };
      existingShared.amount += amount;
      sharedCategorySpending.set(catId, existingShared);
    } else {
      // Track non-shared expenses (personal only)
      const existingNonShared = nonSharedCategorySpending.get(catId) ||
        { name: catName, color: catColor, amount: 0 };
      existingNonShared.amount += amount;
      nonSharedCategorySpending.set(catId, existingNonShared);
    }
  }

  const topCategories = Array.from(categorySpending.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const sharedCategories = Array.from(sharedCategorySpending.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const nonSharedCategories = Array.from(nonSharedCategorySpending.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return c.json({
    totalAssets,
    totalLiabilities,
    netWorth,
    debtToAssetRatio,
    monthlyExpenses: expensesTotal,
    monthlyIncome: incomeTotal,
    monthlySavings: savingsTotal,
    stockPortfolioValue,
    topCategories,
    nonSharedCategories,
    sharedExpenses: sharedExpensesTotal,
    sharedCategories,
  });
});

// Get net worth history
dashboardRoutes.get("/net-worth-history", async (c) => {
  const user = c.get("user");

  const snapshots = await db.query.netWorthSnapshots.findMany({
    where: eq(netWorthSnapshots.userId, user.id),
    orderBy: [desc(netWorthSnapshots.yearWeek)],
  });

  // Values are already numbers (bigint mode: "number")
  return c.json(snapshots);
});

// Record a net worth snapshot for current week
dashboardRoutes.post("/record-snapshot", async (c) => {
  const user = c.get("user");
  const currentYearWeek = getCurrentYearWeek();

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
      totalAssets += Math.round(
        parseFloat(asset.quantity) * asset.currentPrice * ownership,
      );
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

  // Check if a snapshot for this week already exists
  const existing = await db.query.netWorthSnapshots.findFirst({
    where: and(
      eq(netWorthSnapshots.userId, user.id),
      eq(netWorthSnapshots.yearWeek, currentYearWeek),
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
        yearWeek: currentYearWeek,
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
