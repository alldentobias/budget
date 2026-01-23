import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  PiggyBank,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { assetsApi, dashboardApi } from "@/lib/api";
import {
  formatCurrency,
  formatPercent,
  formatYearWeek,
  fromMinorUnits,
  getMonthName,
  getYearMonth,
  parseYearMonth,
} from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function DashboardPage() {
  const queryClient = useQueryClient();
  const currentYearMonth = getYearMonth(); // Current month for comparison
  const [selectedYearMonth, setSelectedYearMonth] = useState(currentYearMonth);
  const { year, month } = parseYearMonth(selectedYearMonth);

  // Check if we're at the current month (to disable forward navigation)
  const isAtCurrentMonth = selectedYearMonth >= currentYearMonth;

  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary", selectedYearMonth],
    queryFn: () => dashboardApi.getSummary(selectedYearMonth),
  });

  const { data: netWorthHistory = [] } = useQuery({
    queryKey: ["net-worth-history"],
    queryFn: dashboardApi.getNetWorthHistory,
  });

  const recordSnapshotMutation = useMutation({
    mutationFn: dashboardApi.recordNetWorthSnapshot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["net-worth-history"] });
      toast({ title: "Net worth snapshot recorded" });
    },
    onError: (error) => {
      console.error("Record snapshot error:", error);
      toast({
        title: "Failed to record snapshot",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const goToPreviousMonth = () => {
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    setSelectedYearMonth(newYear * 100 + newMonth);
  };

  const goToNextMonth = () => {
    // Don't allow navigation past current month
    if (isAtCurrentMonth) return;

    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    const newYearMonth = newYear * 100 + newMonth;
    // Double check we're not going past current month
    if (newYearMonth <= currentYearMonth) {
      setSelectedYearMonth(newYearMonth);
    }
  };

  const {
    data: assets,
    refetch: refetchAssets,
    isFetching: isRefreshingAssets,
  } = useQuery({
    queryKey: ["assets"],
    queryFn: assetsApi.getAll,
  });

  const handleRefreshPrices = async () => {
    try {
      await assetsApi.refreshPrices();
      refetchAssets();
      toast({ title: "Stock prices refreshed" });
    } catch (error) {
      console.error("Refresh prices error:", error);
      toast({ title: "Failed to refresh prices", variant: "destructive" });
    }
  };

  const stockAssets = assets?.filter((a) => a.type === "stock" && a.ticker) ||
    [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary">
        </div>
      </div>
    );
  }

  // Prepare net worth history for chart (sorted by date, most recent last)
  // Values are in minor units, need to convert for Y-axis display
  const chartData = [...netWorthHistory]
    .sort((a, b) => a.yearWeek - b.yearWeek)
    .slice(-24) // Last 24 weeks
    .map((snapshot) => {
      return {
        week: formatYearWeek(snapshot.yearWeek),
        netWorth: snapshot.netWorth,
        assets: snapshot.totalAssets,
        liabilities: snapshot.totalLiabilities,
      };
    });

  // Prepare pie chart data for top spending categories
  const pieData = summary?.topCategories?.map((cat) => ({
    name: cat.name,
    value: cat.amount,
    color: cat.color,
  })) || [];

  // Prepare pie chart data for shared expenses by category
  const sharedPieData = summary?.sharedCategories?.map((cat) => ({
    name: cat.name,
    value: cat.amount,
    color: cat.color,
  })) || [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header with Month Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Your financial overview at a glance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {getMonthName(month)} {year}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextMonth}
            disabled={isAtCurrentMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Net Worth */}
        <Card className="card-glow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net Worth
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold gradient-text">
              {formatCurrency(summary?.netWorth || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Assets - Liabilities
            </p>
          </CardContent>
        </Card>

        {/* Total Assets */}
        <Card className="card-glow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Assets
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {formatCurrency(summary?.totalAssets || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Stocks + Property + Cash
            </p>
          </CardContent>
        </Card>

        {/* Total Liabilities */}
        <Card className="card-glow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Liabilities
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-500">
              {formatCurrency(summary?.totalLiabilities || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All outstanding loans
            </p>
          </CardContent>
        </Card>

        {/* Debt to Asset Ratio */}
        <Card className="card-glow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Debt-to-Asset
            </CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercent(summary?.debtToAssetRatio || 0)}
            </div>
            <Progress
              value={Math.min(summary?.debtToAssetRatio || 0, 100)}
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Monthly Overview + Top Categories */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Summary */}
        <Card>
          <CardHeader>
            <CardTitle>This Month</CardTitle>
            <CardDescription>Income vs Expenses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Income</span>
              <span className="text-lg font-semibold text-emerald-500">
                {formatCurrency(summary?.monthlyIncome || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expenses</span>
              <span className="text-lg font-semibold text-rose-500">
                {formatCurrency(summary?.monthlyExpenses || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <PiggyBank className="h-3 w-3 text-blue-500" />
                Savings
              </span>
              <span className="text-lg font-semibold text-blue-500">
                {formatCurrency(summary?.monthlySavings || 0)}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="font-medium">Balance</span>
              <span
                className={`text-lg font-bold ${
                  (summary?.monthlyIncome || 0) -
                        (summary?.monthlyExpenses || 0) -
                        (summary?.monthlySavings || 0) >= 0
                    ? "text-emerald-500"
                    : "text-rose-500"
                }`}
              >
                {formatCurrency(
                  (summary?.monthlyIncome || 0) -
                    (summary?.monthlyExpenses || 0) -
                    (summary?.monthlySavings || 0),
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Top Categories - Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Top Spending Categories</CardTitle>
            <CardDescription>This month's expenses by category</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0
              ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={50}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--foreground))",
                        }}
                        labelStyle={{
                          color: "hsl(var(--foreground))",
                        }}
                        itemStyle={{
                          color: "hsl(var(--foreground))",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div className="grid grid-cols-2 gap-2">
                    {pieData.map((cat) => (
                      <div
                        key={cat.name}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.name}</span>
                        <span className="ml-auto tabular-nums text-muted-foreground">
                          {formatCurrency(cat.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
              : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  No expenses this month
                </div>
              )}
          </CardContent>
        </Card>
      </div>

      {/* Shared Expenses Section */}
      {(summary?.sharedExpenses ?? 0) > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Shared Expenses Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Shared Expenses</CardTitle>
              <CardDescription>Joint account spending this month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Shared</span>
                <span className="text-2xl font-bold text-purple-500">
                  {formatCurrency(summary?.sharedExpenses || 0)}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Your Share (50%)</span>
                <span className="text-lg font-semibold text-purple-400">
                  {formatCurrency(Math.floor((summary?.sharedExpenses || 0) / 2))}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Shared Expenses by Category */}
          <Card>
            <CardHeader>
              <CardTitle>Shared by Category</CardTitle>
              <CardDescription>Joint account breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {sharedPieData.length > 0
                ? (
                  <div className="space-y-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={sharedPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          innerRadius={50}
                        >
                          {sharedPieData.map((entry, index) => (
                            <Cell key={`shared-cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            color: "hsl(var(--foreground))",
                          }}
                          labelStyle={{
                            color: "hsl(var(--foreground))",
                          }}
                          itemStyle={{
                            color: "hsl(var(--foreground))",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Legend */}
                    <div className="grid grid-cols-2 gap-2">
                      {sharedPieData.map((cat) => (
                        <div
                          key={cat.name}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="truncate">{cat.name}</span>
                          <span className="ml-auto tabular-nums text-muted-foreground">
                            {formatCurrency(cat.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
                : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No shared expenses this month
                  </div>
                )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Net Worth History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Net Worth History</CardTitle>
            <CardDescription>Track your net worth over time</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => recordSnapshotMutation.mutate()}
            disabled={recordSnapshotMutation.isPending}
          >
            <Camera
              className={`h-4 w-4 mr-2 ${
                recordSnapshotMutation.isPending ? "animate-pulse" : ""
              }`}
            />
            Record Snapshot
          </Button>
        </CardHeader>
        <CardContent>
          {chartData.length > 0
            ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient
                      id="netWorthGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="week"
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                    tickFormatter={(value) =>
                      `${fromMinorUnits(value) / 1000000}M`}
                    tickLine={false}
                    axisLine={false}
                    width={50}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-medium text-sm mb-2">{label}</p>
                            <p className="text-emerald-500 text-sm">
                              Assets:{" "}
                              {formatCurrency(payload[0]?.payload?.assets || 0)}
                            </p>
                            <p className="text-rose-500 text-sm">
                              Liabilities: {formatCurrency(
                                payload[0]?.payload?.liabilities || 0,
                              )}
                            </p>
                            <Separator className="my-2" />
                            <p className="font-bold">
                              Net Worth:{" "}
                              {formatCurrency(payload[0]?.value as number || 0)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="netWorth"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#netWorthGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )
            : (
              <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                <p>No history data yet</p>
                <p className="text-sm">
                  Click "Record Snapshot" to start tracking
                </p>
              </div>
            )}
        </CardContent>
      </Card>

      {/* Stock Portfolio */}
      {stockAssets.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Stock Portfolio</CardTitle>
              <CardDescription>
                Total value: {formatCurrency(summary?.stockPortfolioValue || 0)}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshPrices}
              disabled={isRefreshingAssets}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${
                  isRefreshingAssets ? "animate-spin" : ""
                }`}
              />
              Refresh Prices
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      Ticker
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                      Quantity
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                      Price
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                      Value
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                      Ownership
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stockAssets.map((asset) => {
                    // currentPrice is in minor units
                    const value = asset.quantity * (asset.currentPrice || 0) *
                      (asset.ownershipPct / 100);
                    return (
                      <tr key={asset.id} className="border-b last:border-0">
                        <td className="py-3 px-2 font-mono font-medium">
                          {asset.ticker}
                        </td>
                        <td className="py-3 px-2">{asset.name}</td>
                        <td className="py-3 px-2 text-right tabular-nums">
                          {asset.quantity}
                        </td>
                        <td className="py-3 px-2 text-right tabular-nums">
                          {asset.currentPrice
                            ? formatCurrency(asset.currentPrice)
                            : "-"}
                        </td>
                        <td className="py-3 px-2 text-right font-medium tabular-nums">
                          {formatCurrency(value)}
                        </td>
                        <td className="py-3 px-2 text-right text-muted-foreground">
                          {asset.ownershipPct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
