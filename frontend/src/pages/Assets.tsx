import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Edit2,
  Home,
  Percent,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Asset, assetsApi, Loan, loansApi } from "@/lib/api";
import { formatCurrency, fromMinorUnits, toMinorUnits } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";

export function AssetsPage() {
  const queryClient = useQueryClient();
  const [showAssetDialog, setShowAssetDialog] = useState(false);
  const [showLoanDialog, setShowLoanDialog] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);

  // Queries
  const {
    data: assets = [],
    isLoading: loadingAssets,
    isFetching: refreshingAssets,
  } = useQuery({
    queryKey: ["assets"],
    queryFn: assetsApi.getAll,
  });

  const { data: loans = [], isLoading: loadingLoans } = useQuery({
    queryKey: ["loans"],
    queryFn: loansApi.getAll,
  });

  // Asset mutations
  const createAssetMutation = useMutation({
    mutationFn: assetsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setShowAssetDialog(false);
      setEditingAsset(null);
      toast({ title: "Asset added" });
    },
  });

  const updateAssetMutation = useMutation({
    mutationFn: (
      { id, data }: {
        id: string;
        data: Parameters<typeof assetsApi.update>[1];
      },
    ) => assetsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setShowAssetDialog(false);
      setEditingAsset(null);
      toast({ title: "Asset updated" });
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: assetsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast({ title: "Asset deleted" });
    },
  });

  const refreshPricesMutation = useMutation({
    mutationFn: assetsApi.refreshPrices,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast({ title: "Prices refreshed" });
    },
  });

  // Loan mutations
  const createLoanMutation = useMutation({
    mutationFn: loansApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setShowLoanDialog(false);
      setEditingLoan(null);
      toast({ title: "Loan added" });
    },
  });

  const updateLoanMutation = useMutation({
    mutationFn: (
      { id, data }: { id: string; data: Parameters<typeof loansApi.update>[1] },
    ) => loansApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setShowLoanDialog(false);
      setEditingLoan(null);
      toast({ title: "Loan updated" });
    },
  });

  const deleteLoanMutation = useMutation({
    mutationFn: loansApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast({ title: "Loan deleted" });
    },
  });

  // Handle asset form
  const handleAssetSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const manualValueInput = formData.get("manualValue") as string;
    const data = {
      type: formData.get("type") as "stock" | "property" | "cash" | "other",
      name: formData.get("name") as string,
      ticker: (formData.get("ticker") as string) || undefined,
      quantity: parseFloat(formData.get("quantity") as string) || 0,
      manualValue: manualValueInput
        ? toMinorUnits(parseFloat(manualValueInput))
        : undefined,
      ownershipPct: parseFloat(formData.get("ownershipPct") as string) || 100,
    };

    if (editingAsset) {
      updateAssetMutation.mutate({ id: editingAsset.id, data });
    } else {
      createAssetMutation.mutate(data);
    }
  };

  // Handle loan form
  const handleLoanSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const data = {
      name: formData.get("name") as string,
      principal: toMinorUnits(parseFloat(formData.get("principal") as string)),
      currentBalance: toMinorUnits(parseFloat(formData.get("currentBalance") as string)),
      interestRate: parseFloat(formData.get("interestRate") as string),
      ownershipPct: parseFloat(formData.get("ownershipPct") as string) || 100,
      notes: (formData.get("notes") as string) || undefined,
    };

    if (editingLoan) {
      updateLoanMutation.mutate({ id: editingLoan.id, data });
    } else {
      createLoanMutation.mutate(data);
    }
  };

  // Calculate totals
  const totalAssets = assets.reduce((sum, a) => {
    const ownership = a.ownershipPct / 100;
    if (a.type === "stock" && a.currentPrice) {
      return sum + a.quantity * a.currentPrice * ownership;
    }
    return sum + (a.manualValue || 0) * ownership;
  }, 0);

  const totalLiabilities = loans.reduce((sum, l) => {
    return sum + l.currentBalance * (l.ownershipPct / 100);
  }, 0);

  const netWorth = totalAssets - totalLiabilities;

  const typeIcons = {
    stock: TrendingUp,
    property: Home,
    cash: Wallet,
    other: Wallet,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Assets & Loans</h1>
        <p className="text-muted-foreground mt-1">
          Manage your assets and track your liabilities
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Assets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {formatCurrency(totalAssets)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Liabilities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-500">
              {formatCurrency(totalLiabilities)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net Worth</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                netWorth >= 0 ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              {formatCurrency(netWorth)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="assets" className="space-y-6">
        <TabsList>
          <TabsTrigger value="assets">Assets ({assets.length})</TabsTrigger>
          <TabsTrigger value="loans">Loans ({loans.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshPricesMutation.mutate()}
                disabled={refreshPricesMutation.isPending || refreshingAssets}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${
                    (refreshPricesMutation.isPending || refreshingAssets)
                      ? "animate-spin"
                      : ""
                  }`}
                />
                Refresh Prices
              </Button>
            </div>
            <Dialog
              open={showAssetDialog}
              onOpenChange={(open) => {
                setShowAssetDialog(open);
                if (!open) setEditingAsset(null);
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Asset
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAssetSubmit}>
                  <DialogHeader>
                    <DialogTitle>
                      {editingAsset ? "Edit Asset" : "Add Asset"}
                    </DialogTitle>
                    <DialogDescription>
                      Add a new asset to track your wealth
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Type</Label>
                      <Select
                        name="type"
                        defaultValue={editingAsset?.type || "stock"}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stock">Stock</SelectItem>
                          <SelectItem value="property">Property</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        name="name"
                        defaultValue={editingAsset?.name}
                        placeholder="e.g., Apple Inc."
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="ticker">Ticker (for stocks)</Label>
                        <Input
                          id="ticker"
                          name="ticker"
                          defaultValue={editingAsset?.ticker || ""}
                          placeholder="e.g., AAPL"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                          id="quantity"
                          name="quantity"
                          type="number"
                          step="0.0001"
                          defaultValue={editingAsset?.quantity || 0}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="manualValue">
                          Manual Value (if not stock)
                        </Label>
                        <Input
                          id="manualValue"
                          name="manualValue"
                          type="number"
                          step="0.01"
                          defaultValue={editingAsset?.manualValue ? fromMinorUnits(editingAsset.manualValue) : ""}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ownershipPct">Ownership %</Label>
                        <Input
                          id="ownershipPct"
                          name="ownershipPct"
                          type="number"
                          step="0.01"
                          defaultValue={editingAsset?.ownershipPct || 100}
                          min="0"
                          max="100"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createAssetMutation.isPending ||
                        updateAssetMutation.isPending}
                    >
                      {editingAsset ? "Update" : "Add"} Asset
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loadingAssets
            ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary mx-auto" />
                </CardContent>
              </Card>
            )
            : assets.length === 0
            ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p>
                    No assets yet. Add your first asset to start tracking your
                    wealth.
                  </p>
                </CardContent>
              </Card>
            )
            : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {assets.map((asset) => {
                  const Icon = typeIcons[asset.type] || Wallet;
                  const ownership = asset.ownershipPct / 100;
                  let value = 0;
                  if (asset.type === "stock" && asset.currentPrice) {
                    value = asset.quantity * asset.currentPrice * ownership;
                  } else if (asset.manualValue) {
                    value = asset.manualValue * ownership;
                  }

                  return (
                    <Card key={asset.id} className="group card-glow">
                      <CardHeader className="flex flex-row items-start justify-between pb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">
                              {asset.name}
                            </CardTitle>
                            {asset.ticker && (
                              <Badge
                                variant="secondary"
                                className="mt-1 font-mono"
                              >
                                {asset.ticker}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingAsset(asset);
                              setShowAssetDialog(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              if (confirm("Delete this asset?")) {
                                deleteAssetMutation.mutate(asset.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatCurrency(value)}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {asset.type === "stock" && asset.currentPrice && (
                            <span>
                              {asset.quantity} shares @{" "}
                              {formatCurrency(asset.currentPrice)}
                            </span>
                          )}
                          {asset.ownershipPct < 100 && (
                            <span className="ml-2">
                              ({asset.ownershipPct}% ownership)
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
        </TabsContent>

        <TabsContent value="loans" className="space-y-4">
          <div className="flex justify-end">
            <Dialog
              open={showLoanDialog}
              onOpenChange={(open) => {
                setShowLoanDialog(open);
                if (!open) setEditingLoan(null);
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Loan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleLoanSubmit}>
                  <DialogHeader>
                    <DialogTitle>
                      {editingLoan ? "Edit Loan" : "Add Loan"}
                    </DialogTitle>
                    <DialogDescription>
                      Track your loans and liabilities
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Loan Name</Label>
                      <Input
                        id="name"
                        name="name"
                        defaultValue={editingLoan?.name}
                        placeholder="e.g., Mortgage"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="principal">Original Principal</Label>
                        <Input
                          id="principal"
                          name="principal"
                          type="number"
                          step="0.01"
                          defaultValue={editingLoan ? fromMinorUnits(editingLoan.principal) : ""}
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="currentBalance">Current Balance</Label>
                        <Input
                          id="currentBalance"
                          name="currentBalance"
                          type="number"
                          step="0.01"
                          defaultValue={editingLoan ? fromMinorUnits(editingLoan.currentBalance) : ""}
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="interestRate">Interest Rate (%)</Label>
                        <Input
                          id="interestRate"
                          name="interestRate"
                          type="number"
                          step="0.01"
                          defaultValue={editingLoan?.interestRate}
                          placeholder="3.5"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ownershipPct">Your Share (%)</Label>
                        <Input
                          id="ownershipPct"
                          name="ownershipPct"
                          type="number"
                          step="0.01"
                          defaultValue={editingLoan?.ownershipPct || 100}
                          min="0"
                          max="100"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (optional)</Label>
                      <Textarea
                        id="notes"
                        name="notes"
                        defaultValue={editingLoan?.notes || ""}
                        placeholder="Any additional notes..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createLoanMutation.isPending ||
                        updateLoanMutation.isPending}
                    >
                      {editingLoan ? "Update" : "Add"} Loan
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loadingLoans
            ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary mx-auto" />
                </CardContent>
              </Card>
            )
            : loans.length === 0
            ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p>
                    No loans tracked. Add a loan to monitor your liabilities.
                  </p>
                </CardContent>
              </Card>
            )
            : (
              <div className="space-y-4">
                {loans.map((loan) => {
                  const paidOff = loan.principal - loan.currentBalance;
                  const progress = loan.principal > 0
                    ? (paidOff / loan.principal) * 100
                    : 0;
                  const yourBalance = loan.currentBalance *
                    (loan.ownershipPct / 100);

                  return (
                    <Card key={loan.id} className="group">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-lg">
                              {loan.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <Percent className="h-4 w-4" />
                              {loan.interestRate}% interest
                              {loan.ownershipPct < 100 && (
                                <span className="ml-2">
                                  ({loan.ownershipPct}% your share)
                                </span>
                              )}
                            </div>
                            {loan.notes && (
                              <p className="text-sm text-muted-foreground mt-2">
                                {loan.notes}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-rose-500">
                              {formatCurrency(yourBalance)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              of {formatCurrency(loan.currentBalance)} total
                            </div>
                          </div>
                        </div>
                        <div className="mt-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Paid off</span>
                            <span>{progress.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>{formatCurrency(paidOff)} paid</span>
                            <span>
                              {formatCurrency(loan.currentBalance)} remaining
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingLoan(loan);
                              setShowLoanDialog(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm("Delete this loan?")) {
                                deleteLoanMutation.mutate(loan.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
