import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Check,
  FileText,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { categoriesApi, importApi } from "@/lib/api";
import {
  formatCurrency,
  formatDate,
  fromMinorUnits,
  getMonthName,
  getYearMonth,
  parseYearMonth,
  toMinorUnits,
} from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";

type Step = "upload" | "review" | "done";

export function ImportPage() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("upload");
  const [selectedExtractor, setSelectedExtractor] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<
    { staged: number; duplicates: number; filteredByMonth?: number } | null
  >(null);
  const [targetYearMonth, setTargetYearMonth] = useState<number>(
    getYearMonth(),
  );
  const [selectedStaged, setSelectedStaged] = useState<Set<string>>(new Set());

  // Queries
  const { data: extractorsData } = useQuery({
    queryKey: ["extractors"],
    queryFn: importApi.getExtractors,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.getAll,
  });

  const { data: stagedExpenses = [], refetch: refetchStaged } = useQuery({
    queryKey: ["staged-expenses", targetYearMonth],
    queryFn: () => importApi.getStaged(targetYearMonth),
    enabled: step === "review",
  });

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: (
      { file, extractor, yearMonth }: {
        file: File;
        extractor: string;
        yearMonth: number;
      },
    ) => importApi.upload(file, extractor, yearMonth),
    onSuccess: (result) => {
      setImportResult({
        staged: result.staged,
        duplicates: result.duplicates,
        filteredByMonth: (result as any).filteredByMonth || 0,
      });
      setStep("review");
      refetchStaged();
      toast({ title: "File processed successfully!" });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error instanceof Error
          ? error.message
          : "Please try again",
        variant: "destructive",
      });
    },
  });

  const updateStagedMutation = useMutation({
    mutationFn: (
      { id, update }: {
        id: string;
        update: Parameters<typeof importApi.updateStaged>[1];
      },
    ) => importApi.updateStaged(id, update),
    onSuccess: () => {
      refetchStaged();
    },
  });

  const deleteStagedMutation = useMutation({
    mutationFn: importApi.deleteStaged,
    onSuccess: () => {
      refetchStaged();
      toast({ title: "Removed from staging" });
    },
  });

  const commitMutation = useMutation({
    mutationFn: () => importApi.commit(targetYearMonth),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-stats"] });
      setStep("done");
      toast({ title: `Committed ${result.committed} expenses!` });
    },
  });

  // Dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setUploadedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
    maxFiles: 1,
  });

  // Handlers
  const handleUpload = () => {
    if (!uploadedFile || !selectedExtractor) {
      toast({
        title: "Missing information",
        description: "Please select a file and extractor",
        variant: "destructive",
      });
      return;
    }
    uploadMutation.mutate({
      file: uploadedFile,
      extractor: selectedExtractor,
      yearMonth: targetYearMonth,
    });
  };

  const handleCategoryChange = (stagedId: string, categoryId: string) => {
    updateStagedMutation.mutate({
      id: stagedId,
      update: {
        categoryId: categoryId === "uncategorized" ? undefined : categoryId,
      },
    });
  };

  const handleBulkCategoryChange = (categoryId: string) => {
    const ids = Array.from(selectedStaged);
    ids.forEach((id) => {
      updateStagedMutation.mutate({
        id,
        update: {
          categoryId: categoryId === "uncategorized" ? undefined : categoryId,
        },
      });
    });
    setSelectedStaged(new Set());
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedStaged);
    ids.forEach((id) => deleteStagedMutation.mutate(id));
    setSelectedStaged(new Set());
  };

  // Update settlement amounts (input is in major units, convert to minor units)
  const handleCollectToMeChange = (stagedId: string, value: string) => {
    const majorUnits = parseFloat(value) || 0;
    updateStagedMutation.mutate({
      id: stagedId,
      update: { collectToMe: toMinorUnits(majorUnits) },
    });
  };

  const handleCollectFromMeChange = (stagedId: string, value: string) => {
    const majorUnits = parseFloat(value) || 0;
    updateStagedMutation.mutate({
      id: stagedId,
      update: { collectFromMe: toMinorUnits(majorUnits) },
    });
  };

  // Handle notes change
  const handleNotesChange = (stagedId: string, value: string) => {
    updateStagedMutation.mutate({
      id: stagedId,
      update: { notes: value || undefined },
    });
  };

  // Handle isShared toggle
  const handleIsSharedChange = (stagedId: string, isShared: boolean) => {
    updateStagedMutation.mutate({
      id: stagedId,
      update: { isShared },
    });
  };

  const nonDuplicateStaged = stagedExpenses.filter((s) => !s.isDuplicate);
  const duplicateStaged = stagedExpenses.filter((s) => s.isDuplicate);

  const toggleSelectAll = () => {
    if (selectedStaged.size === nonDuplicateStaged.length) {
      setSelectedStaged(new Set());
    } else {
      setSelectedStaged(new Set(nonDuplicateStaged.map((s) => s.id)));
    }
  };

  const toggleStaged = (id: string) => {
    const newSelection = new Set(selectedStaged);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedStaged(newSelection);
  };

  const { year, month } = parseYearMonth(targetYearMonth);

  // Generate month options (current month and 12 months back)
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 13; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = d.getFullYear() * 100 + (d.getMonth() + 1);
      options.push({
        value: ym,
        label: `${getMonthName(d.getMonth() + 1)} ${d.getFullYear()}`,
      });
    }
    return options;
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Import Transactions
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload bank statements to import your transactions
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
            step === "upload"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">
            1
          </span>
          Upload
        </div>
        <div className="h-px w-8 bg-border" />
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
            step === "review"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">
            2
          </span>
          Review & Categorize
        </div>
        <div className="h-px w-8 bg-border" />
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
            step === "done"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">
            3
          </span>
          Done
        </div>
      </div>

      {/* Upload Step */}
      {step === "upload" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Upload File</CardTitle>
              <CardDescription>
                Select a CSV or Excel file from your bank
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50",
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                {uploadedFile
                  ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="font-medium">{uploadedFile.name}</span>
                    </div>
                  )
                  : isDragActive
                  ? <p>Drop the file here...</p>
                  : (
                    <div>
                      <p className="font-medium">Drop your file here</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        or click to browse
                      </p>
                    </div>
                  )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Extraction Script</label>
                <Select
                  value={selectedExtractor}
                  onValueChange={setSelectedExtractor}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an extractor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {extractorsData?.extractors.map((ext) => (
                      <SelectItem key={ext.name} value={ext.name}>
                        <div>
                          <div className="font-medium">{ext.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {ext.description}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Import to Month
                </label>
                <Select
                  value={targetYearMonth.toString()}
                  onValueChange={(v) => setTargetYearMonth(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Transactions not in this month will be filtered out
                </p>
              </div>

              <Button
                onClick={handleUpload}
                disabled={!uploadedFile || !selectedExtractor ||
                  uploadMutation.isPending}
                className="w-full"
              >
                {uploadMutation.isPending ? "Processing..." : "Process File"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Available Extractors</CardTitle>
              <CardDescription>
                Choose the one that matches your bank's format
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {extractorsData?.extractors.map((ext) => (
                  <div
                    key={ext.name}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedExtractor === ext.name
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50",
                    )}
                    onClick={() => setSelectedExtractor(ext.name)}
                  >
                    <div className="font-medium">{ext.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {ext.description}
                    </div>
                    <div className="flex gap-1 mt-2">
                      {ext.supported_formats.map((format) => (
                        <Badge
                          key={format}
                          variant="secondary"
                          className="text-xs"
                        >
                          {format}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Review Step */}
      {step === "review" && (
        <div className="space-y-6">
          {importResult && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <Check className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">
                      Extracted {importResult.staged} transactions for{" "}
                      {getMonthName(month)} {year}
                    </p>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      {importResult.duplicates > 0 && (
                        <p>
                          {importResult.duplicates} potential duplicates found
                        </p>
                      )}
                      {importResult.filteredByMonth &&
                        importResult.filteredByMonth > 0 && (
                        <p>
                          {importResult.filteredByMonth}{" "}
                          transactions filtered out (different month)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Toolbar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    Importing to: {getMonthName(month)} {year}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedStaged.size > 0 && (
                    <>
                      <span className="text-sm text-muted-foreground">
                        {selectedStaged.size} selected
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
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    onClick={() => commitMutation.mutate()}
                    disabled={commitMutation.isPending ||
                      nonDuplicateStaged.length === 0}
                  >
                    {commitMutation.isPending
                      ? "Committing..."
                      : `Commit ${nonDuplicateStaged.length} Expenses`}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Staged Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Staged Transactions</CardTitle>
              <CardDescription>
                Review and categorize before committing. Set notes, shared
                status, and settlement amounts.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {nonDuplicateStaged.length === 0
                ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No transactions to review
                  </div>
                )
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-3 w-10">
                            <Checkbox
                              checked={selectedStaged.size ===
                                nonDuplicateStaged.length}
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
                            Source
                          </th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                            Category
                          </th>
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                            Notes
                          </th>
                          <th
                            className="p-3 text-center text-sm font-medium text-muted-foreground"
                            title="Joint expense"
                          >
                            Shared
                          </th>
                          <th
                            className="p-3 text-center text-sm font-medium text-muted-foreground"
                            title="They owe me"
                          >
                            <span className="flex items-center gap-1 justify-center">
                              <ArrowDownLeft className="h-3 w-3 text-emerald-500" />
                              Collect
                            </span>
                          </th>
                          <th
                            className="p-3 text-center text-sm font-medium text-muted-foreground"
                            title="I owe them"
                          >
                            <span className="flex items-center gap-1 justify-center">
                              <ArrowUpRight className="h-3 w-3 text-rose-500" />
                              Pay
                            </span>
                          </th>
                          <th className="p-3 text-right text-sm font-medium text-muted-foreground">
                            Amount
                          </th>
                          <th className="p-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {nonDuplicateStaged.map((staged) => (
                          <tr
                            key={staged.id}
                            className="border-b last:border-0 hover:bg-muted/30"
                          >
                            <td className="p-3">
                              <Checkbox
                                checked={selectedStaged.has(staged.id)}
                                onCheckedChange={() => toggleStaged(staged.id)}
                              />
                            </td>
                            <td className="p-3 text-sm tabular-nums whitespace-nowrap">
                              {formatDate(staged.date)}
                            </td>
                            <td className="p-3">
                              <div className="font-medium min-w-[200px]">
                                {staged.title}
                              </div>
                            </td>
                            <td className="p-3">
                              {staged.source && (
                                <Badge variant="outline" className="text-xs">
                                  {staged.source}
                                </Badge>
                              )}
                            </td>
                            <td className="p-3">
                              <Select
                                value={staged.categoryId || "uncategorized"}
                                onValueChange={(value) =>
                                  handleCategoryChange(staged.id, value)}
                              >
                                <SelectTrigger className="w-[130px]">
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
                            </td>
                            <td className="p-3">
                              <Input
                                className="w-[100px] h-8 text-xs"
                                placeholder="Notes..."
                                defaultValue={staged.notes || ""}
                                onBlur={(e) =>
                                  handleNotesChange(staged.id, e.target.value)}
                              />
                            </td>
                            <td className="p-3 text-center">
                              <Checkbox
                                checked={staged.isShared}
                                onCheckedChange={(checked) =>
                                  handleIsSharedChange(staged.id, !!checked)}
                              />
                            </td>
                            <td className="p-3">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-[80px] h-8 text-xs text-center"
                                placeholder="0"
                                defaultValue={fromMinorUnits(
                                  staged.collectToMe,
                                ) || ""}
                                onBlur={(e) =>
                                  handleCollectToMeChange(
                                    staged.id,
                                    e.target.value,
                                  )}
                              />
                            </td>
                            <td className="p-3">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-[80px] h-8 text-xs text-center"
                                placeholder="0"
                                defaultValue={fromMinorUnits(
                                  staged.collectFromMe,
                                ) || ""}
                                onBlur={(e) =>
                                  handleCollectFromMeChange(
                                    staged.id,
                                    e.target.value,
                                  )}
                              />
                            </td>
                            <td
                              className={`p-3 text-right font-medium tabular-nums ${
                                staged.amount < 0
                                  ? "text-rose-500"
                                  : "text-emerald-500"
                              }`}
                            >
                              {formatCurrency(staged.amount)}
                            </td>
                            <td className="p-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  deleteStagedMutation.mutate(staged.id)}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
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

          {/* Duplicates */}
          {duplicateStaged.length > 0 && (
            <Card className="border-amber-500/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <CardTitle>Potential Duplicates</CardTitle>
                </div>
                <CardDescription>
                  These transactions match existing expenses. They will not be
                  imported.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                          Date
                        </th>
                        <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                          Title
                        </th>
                        <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                          Source
                        </th>
                        <th className="p-3 text-right text-sm font-medium text-muted-foreground">
                          Amount
                        </th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {duplicateStaged.map((staged) => (
                        <tr
                          key={staged.id}
                          className="border-b last:border-0 opacity-60"
                        >
                          <td className="p-3 text-sm tabular-nums">
                            {formatDate(staged.date)}
                          </td>
                          <td className="p-3">
                            <div className="font-medium min-w-[200px]">{staged.title}</div>
                          </td>
                          <td className="p-3">
                            {staged.source && (
                              <Badge variant="outline" className="text-xs">
                                {staged.source}
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-right font-medium tabular-nums">
                            {formatCurrency(staged.amount)}
                          </td>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                deleteStagedMutation.mutate(staged.id)}
                            >
                              <X className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("upload")}>
              Back to Upload
            </Button>
          </div>
        </div>
      )}

      {/* Done Step */}
      {step === "done" && (
        <Card className="max-w-md mx-auto text-center">
          <CardContent className="py-12">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Import Complete!</h2>
            <p className="text-muted-foreground mb-6">
              Your transactions have been added to your monthly expenses.
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setUploadedFile(null);
                  setImportResult(null);
                }}
              >
                Import More
              </Button>
              <Button onClick={() => window.location.href = "/monthly"}>
                View Monthly
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
