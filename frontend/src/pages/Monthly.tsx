import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Filter,
  Plus,
  Trash2,
} from "lucide-react";
import { categoriesApi, Expense, expensesApi, incomesApi } from "@/lib/api";
import {
  formatCurrency,
  formatDate,
  fromMinorUnits,
  getMonthName,
  getYearMonth,
  parseYearMonth,
  toMinorUnits,
} from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export function MonthlyPage() {
  const { yearMonth: yearMonthParam } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const currentYearMonth = yearMonthParam
    ? parseInt(yearMonthParam)
    : getYearMonth();
  const { year, month } = parseYearMonth(currentYearMonth);

  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(
    new Set(),
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showIncomeDialog, setShowIncomeDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form state for expense editing (amounts in major units for display)
  const [editForm, setEditForm] = useState({
    title: "",
    date: "",
    amount: 0, // Major units for display
    categoryId: "",
    notes: "",
    isShared: false,
    collectToMe: 0, // Major units for display
    collectFromMe: 0, // Major units for display
    settled: false,
  });

  // Queries
  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["expenses", currentYearMonth],
    queryFn: () => expensesApi.getByMonth(currentYearMonth),
  });

  const { data: incomes = [] } = useQuery({
    queryKey: ["incomes", currentYearMonth],
    queryFn: () => incomesApi.getByMonth(currentYearMonth),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.getAll,
  });

  const { data: stats } = useQuery({
    queryKey: ["expense-stats", currentYearMonth],
    queryFn: () => expensesApi.getStats(currentYearMonth),
  });

  // Mutations
  const bulkUpdateMutation = useMutation({
    mutationFn: expensesApi.bulkUpdate,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["expenses", currentYearMonth],
      });
      queryClient.invalidateQueries({
        queryKey: ["expense-stats", currentYearMonth],
      });
      setSelectedExpenses(new Set());
      toast({ title: "Expenses updated" });
    },
    onError: (error) => {
      console.error("Bulk update error:", error);
      toast({ title: "Failed to update expenses", variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: expensesApi.bulkDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["expenses", currentYearMonth],
      });
      queryClient.invalidateQueries({
        queryKey: ["expense-stats", currentYearMonth],
      });
      setSelectedExpenses(new Set());
      toast({ title: "Expenses deleted" });
    },
    onError: (error) => {
      console.error("Bulk delete error:", error);
      toast({ title: "Failed to delete expenses", variant: "destructive" });
    },
  });

  const createIncomeMutation = useMutation({
    mutationFn: incomesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["incomes", currentYearMonth],
      });
      setShowIncomeDialog(false);
      toast({ title: "Income added" });
    },
  });

  const deleteIncomeMutation = useMutation({
    mutationFn: incomesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["incomes", currentYearMonth],
      });
      toast({ title: "Income deleted" });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Expense> }) =>
      expensesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["expenses", currentYearMonth],
      });
      queryClient.invalidateQueries({
        queryKey: ["expense-stats", currentYearMonth],
      });
    },
    onError: (error) => {
      console.error("Update expense error:", error);
      toast({ title: "Failed to update expense", variant: "destructive" });
    },
  });

  // Handler for editing an expense (convert from minor to major units for display)
  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    // Extract just the date part (YYYY-MM-DD) from ISO string
    const dateStr = expense.date.split("T")[0];
    setEditForm({
      title: expense.title,
      date: dateStr,
      amount: fromMinorUnits(Math.abs(expense.amount)), // Convert to major units for display
      categoryId: expense.categoryId || "",
      notes: expense.notes || "",
      isShared: expense.isShared || false,
      collectToMe: fromMinorUnits(expense.collectToMe || 0), // Convert to major units
      collectFromMe: fromMinorUnits(expense.collectFromMe || 0), // Convert to major units
      settled: expense.settled,
    });
    setShowExpenseDialog(true);
  };

  const handleSaveExpense = () => {
    if (!editingExpense) return;

    // Validate settlement amounts (in major units)
    const totalSettlement = editForm.collectToMe + editForm.collectFromMe;
    if (totalSettlement > editForm.amount) {
      toast({
        title: "Invalid settlement amounts",
        description: `Settlement total (${
          editForm.collectToMe + editForm.collectFromMe
        }) cannot exceed expense amount (${editForm.amount})`,
        variant: "destructive",
      });
      return;
    }

    // Convert from major units to minor units for API
    updateExpenseMutation.mutate({
      id: editingExpense.id,
      data: {
        title: editForm.title,
        date: editForm.date,
        amount: toMinorUnits(editForm.amount),
        categoryId: editForm.categoryId || undefined,
        notes: editForm.notes || undefined,
        isShared: editForm.isShared,
        collectToMe: toMinorUnits(editForm.collectToMe),
        collectFromMe: toMinorUnits(editForm.collectFromMe),
        settled: editForm.settled,
      },
    }, {
      onSuccess: () => {
        setShowExpenseDialog(false);
        setEditingExpense(null);
        toast({ title: "Expense updated" });
      },
    });
  };

  // Calculate if settlement exceeds amount (for showing warning) - in major units
  const settlementTotal = editForm.collectToMe + editForm.collectFromMe;
  const settlementExceeds = settlementTotal > editForm.amount;

  // Quick toggle for settled status
  const toggleSettled = (expense: Expense) => {
    updateExpenseMutation.mutate({
      id: expense.id,
      data: { settled: !expense.settled },
    });
  };

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    if (categoryFilter === "all") return expenses;
    if (categoryFilter === "uncategorized") {
      return expenses.filter((e) => !e.categoryId);
    }
    return expenses.filter((e) => e.categoryId === categoryFilter);
  }, [expenses, categoryFilter]);

  // Navigation
  const goToPreviousMonth = () => {
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    navigate(`/monthly/${newYear * 100 + newMonth}`);
  };

  const goToNextMonth = () => {
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    navigate(`/monthly/${newYear * 100 + newMonth}`);
  };

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedExpenses.size === filteredExpenses.length) {
      setSelectedExpenses(new Set());
    } else {
      setSelectedExpenses(new Set(filteredExpenses.map((e) => e.id)));
    }
  };

  const toggleExpense = (id: string) => {
    const newSelection = new Set(selectedExpenses);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedExpenses(newSelection);
  };

  // Bulk category update
  const handleBulkCategoryChange = (categoryId: string) => {
    const ids = Array.from(selectedExpenses);
    bulkUpdateMutation.mutate(ids.map((id) => ({
      id,
      categoryId: categoryId === "uncategorized" ? null : categoryId,
    })));
  };

  // Bulk delete
  const handleBulkDelete = () => {
    if (confirm(`Delete ${selectedExpenses.size} expenses?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedExpenses));
    }
  };

  // Calculate totals (shared expenses count as half - your portion from joint account)
  // Amounts are in minor units from API
  const totalExpenses = expenses
    .filter((e) => e.amount > 0)
    .reduce((sum, e) => {
      const amount = Math.abs(e.amount);
      return sum + (e.isShared ? Math.floor(amount / 2) : amount);
    }, 0);

  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const balance = totalIncome - totalExpenses;

  // Pie chart data (amounts in minor units)
  const pieData = stats?.byCategory.filter((c) => c.amount > 0).map((c) => ({
    name: c.name,
    value: Math.abs(c.amount),
    color: c.color,
  })) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {getMonthName(month)} {year}
          </h1>
          <p className="text-muted-foreground mt-1">
            Monthly expenses and income
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Income</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {formatCurrency(totalIncome)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-500">
              {formatCurrency(totalExpenses)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                balance >= 0 ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              {formatCurrency(balance)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <ArrowDownLeft className="h-3 w-3 text-emerald-500" />
              They Owe You
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {formatCurrency(stats?.totalCollectToMe ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3 text-rose-500" />
              You Owe Them
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-500">
              {formatCurrency(stats?.totalCollectFromMe ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Expense List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Toolbar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <Select
                    value={categoryFilter}
                    onValueChange={setCategoryFilter}
                  >
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="uncategorized">
                        Uncategorized
                      </SelectItem>
                      <Separator className="my-1" />
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedExpenses.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedExpenses.size} selected
                    </span>
                    <Select onValueChange={handleBulkCategoryChange}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Set category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uncategorized">
                          Uncategorized
                        </SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={bulkDeleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Expenses Table */}
          <Card>
            <CardContent className="p-0">
              {loadingExpenses
                ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-primary" />
                  </div>
                )
                : filteredExpenses.length === 0
                ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <p>No expenses for this month</p>
                    <Button variant="link" onClick={() => navigate("/import")}>
                      Import transactions
                    </Button>
                  </div>
                )
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-3 w-10">
                            <Checkbox
                              checked={selectedExpenses.size ===
                                  filteredExpenses.length &&
                                filteredExpenses.length > 0}
                              onCheckedChange={toggleSelectAll}
                            />
                          </th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                            Date
                          </th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                            Title
                          </th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                            Category
                          </th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                            Source
                          </th>
                          <th
                            className="p-3 text-right text-sm font-medium text-muted-foreground"
                            title="They owe me"
                          >
                            <span className="flex items-center justify-end gap-1">
                              <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                              Collect
                            </span>
                          </th>
                          <th
                            className="p-3 text-right text-sm font-medium text-muted-foreground"
                            title="I owe them"
                          >
                            <span className="flex items-center justify-end gap-1">
                              <ArrowUpRight className="h-4 w-4 text-rose-500" />
                              Pay
                            </span>
                          </th>
                          <th
                            className="p-3 text-center text-sm font-medium text-muted-foreground"
                            title="Settled"
                          >
                            <Check className="h-4 w-4 mx-auto" />
                          </th>
                          <th className="p-3 text-right text-sm font-medium text-muted-foreground">
                            Amount
                          </th>
                          <th className="p-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredExpenses.map((expense) => (
                          <tr
                            key={expense.id}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="p-3">
                              <Checkbox
                                checked={selectedExpenses.has(expense.id)}
                                onCheckedChange={() =>
                                  toggleExpense(expense.id)}
                              />
                            </td>
                            <td className="p-3 text-sm tabular-nums">
                              {formatDate(expense.date)}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {expense.title}
                                </span>
                                {expense.isShared && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 text-muted-foreground"
                                  >
                                    Shared
                                  </Badge>
                                )}
                              </div>
                              {expense.notes && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {expense.notes}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              {expense.category
                                ? (
                                  <Badge
                                    variant="outline"
                                    style={{
                                      borderColor: expense.category.color,
                                      color: expense.category.color,
                                    }}
                                  >
                                    {expense.category.name}
                                  </Badge>
                                )
                                : (
                                  <span className="text-muted-foreground text-sm">
                                    -
                                  </span>
                                )}
                            </td>
                            <td className="p-3 text-left text-sm font-medium text-muted-foreground">
                              {expense.source}
                            </td>
                            <td className="p-3 text-right tabular-nums">
                              {expense.collectToMe > 0 && (
                                <span className="text-emerald-500 font-medium">
                                  {formatCurrency(expense.collectToMe)}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right tabular-nums">
                              {expense.collectFromMe > 0 && (
                                <span className="text-rose-500 font-medium">
                                  {formatCurrency(expense.collectFromMe)}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {(expense.collectToMe > 0 ||
                                expense.collectFromMe > 0) && (
                                <Checkbox
                                  checked={expense.settled}
                                  onCheckedChange={() => toggleSettled(expense)}
                                />
                              )}
                            </td>
                            <td
                              className={`p-3 text-right font-medium tabular-nums ${
                                expense.amount < 0
                                  ? "text-rose-500"
                                  : "text-emerald-500"
                              }`}
                            >
                              {formatCurrency(expense.amount)}
                            </td>
                            <td className="p-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditExpense(expense)}
                              >
                                <Edit2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Income Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Income</CardTitle>
              <Dialog
                open={showIncomeDialog}
                onOpenChange={setShowIncomeDialog}
              >
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const formData = new FormData(form);
                      // Convert from major units (user input) to minor units
                      const amountMajor = parseFloat(
                        formData.get("amount") as string,
                      );
                      createIncomeMutation.mutate({
                        yearMonth: currentYearMonth,
                        amount: toMinorUnits(amountMajor),
                        source: formData.get("source") as string,
                        notes: formData.get("notes") as string || undefined,
                      });
                    }}
                  >
                    <DialogHeader>
                      <DialogTitle>Add Income</DialogTitle>
                      <DialogDescription>
                        Add an income source for this month
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="source">Source</Label>
                        <Input
                          id="source"
                          name="source"
                          placeholder="e.g., Salary"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount (kr)</Label>
                        <Input
                          id="amount"
                          name="amount"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes (optional)</Label>
                        <Textarea
                          id="notes"
                          name="notes"
                          placeholder="Any notes..."
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="submit"
                        disabled={createIncomeMutation.isPending}
                      >
                        {createIncomeMutation.isPending
                          ? "Adding..."
                          : "Add Income"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {incomes.length === 0
                ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No income recorded
                  </p>
                )
                : (
                  <div className="space-y-3">
                    {incomes.map((income) => (
                      <div
                        key={income.id}
                        className="flex items-center justify-between group"
                      >
                        <div>
                          <div className="font-medium">{income.source}</div>
                          {income.notes && (
                            <div className="text-xs text-muted-foreground">
                              {income.notes}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-emerald-500">
                            {formatCurrency(income.amount)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100"
                            onClick={() =>
                              deleteIncomeMutation.mutate(income.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          {pieData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Spending by Category</CardTitle>
              </CardHeader>
              <CardContent>
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
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {stats?.byCategory.slice(0, 5).map((cat) => (
                    <div
                      key={cat.categoryId}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span>{cat.name}</span>
                      </div>
                      <span className="tabular-nums">
                        {formatCurrency(Math.abs(cat.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Expense Dialog */}
      <Dialog
        open={showExpenseDialog}
        onOpenChange={(open) => {
          setShowExpenseDialog(open);
          if (!open) setEditingExpense(null);
        }}
      >
        <DialogContent className="max-w-md">
          {editingExpense && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveExpense();
              }}
            >
              <DialogHeader>
                <DialogTitle>Edit Expense</DialogTitle>
                <DialogDescription>
                  Update expense details and settlement amounts
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, title: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-date">Date</Label>
                    <Input
                      id="edit-date"
                      type="date"
                      value={editForm.date}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-amount">Amount (kr)</Label>
                    <Input
                      id="edit-amount"
                      type="number"
                      step="0.01"
                      value={editForm.amount || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          amount: parseFloat(e.target.value) || 0,
                        }))}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Select
                    value={editForm.categoryId || "uncategorized"}
                    onValueChange={(value) =>
                      setEditForm((f) => ({
                        ...f,
                        categoryId: value === "uncategorized" ? "" : value,
                      }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uncategorized">
                        Uncategorized
                      </SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Textarea
                    id="edit-notes"
                    placeholder="Any notes..."
                    value={editForm.notes}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>

                <Separator />

                {/* Shared expense toggle - affects Total Expenses calculation */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                  <Checkbox
                    id="edit-isShared"
                    checked={editForm.isShared}
                    onCheckedChange={(checked) =>
                      setEditForm((f) => ({ ...f, isShared: !!checked }))}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="edit-isShared"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Joint account expense
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Paid from shared account - counts as 50% in totals
                    </p>
                  </div>
                  {editForm.isShared && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Your share: {(editForm.amount / 2).toFixed(2)} kr
                    </Badge>
                  )}
                </div>

                <Separator />

                {/* Settlement section - independent from shared */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Settlement</Label>
                    {settlementTotal > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {settlementTotal.toFixed(2)} of{" "}
                        {editForm.amount.toFixed(2)} kr
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Track amounts to collect or pay back (e.g., split bills,
                    reimbursements)
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="edit-collectToMe"
                        className="text-xs flex items-center gap-1"
                      >
                        <ArrowDownLeft className="h-3 w-3 text-emerald-500" />
                        They owe me (kr)
                      </Label>
                      <Input
                        id="edit-collectToMe"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={editForm.collectToMe || ""}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            collectToMe: parseFloat(e.target.value) || 0,
                          }))}
                        className={settlementExceeds ? "border-rose-500" : ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="edit-collectFromMe"
                        className="text-xs flex items-center gap-1"
                      >
                        <ArrowUpRight className="h-3 w-3 text-rose-500" />
                        I owe them (kr)
                      </Label>
                      <Input
                        id="edit-collectFromMe"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={editForm.collectFromMe || ""}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            collectFromMe: parseFloat(e.target.value) || 0,
                          }))}
                        className={settlementExceeds ? "border-rose-500" : ""}
                      />
                    </div>
                  </div>
                  {settlementExceeds && (
                    <p className="text-xs text-rose-500">
                      Settlement total ({settlementTotal.toFixed(2)}) exceeds
                      expense amount ({editForm.amount.toFixed(2)})
                    </p>
                  )}
                  {settlementTotal > 0 && (
                    <div className="flex items-center gap-2 pt-2">
                      <Checkbox
                        id="edit-settled"
                        checked={editForm.settled}
                        onCheckedChange={(checked) =>
                          setEditForm((f) => ({ ...f, settled: !!checked }))}
                      />
                      <Label
                        htmlFor="edit-settled"
                        className="text-sm cursor-pointer"
                      >
                        Mark as settled
                      </Label>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowExpenseDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateExpenseMutation.isPending ||
                    settlementExceeds}
                >
                  {updateExpenseMutation.isPending
                    ? "Saving..."
                    : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
