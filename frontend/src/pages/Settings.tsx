import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Trash2 } from "lucide-react";
import { categoriesApi, Category, exportApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";

export function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newCategory, setNewCategory] = useState({
    name: "",
    color: "#6b7280",
  });
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.getAll,
  });

  const createCategoryMutation = useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNewCategory({ name: "", color: "#6b7280" });
      toast({ title: "Category created" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: categoriesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setCategoryToDelete(null);
      toast({ title: "Category deleted" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { color: string } }) =>
      categoriesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Category color updated" });
    },
  });

  const handleDeleteCategory = () => {
    if (categoryToDelete) {
      deleteCategoryMutation.mutate(categoryToDelete.id);
    }
  };

  const handleExport = async (format: "csv" | "json") => {
    try {
      const blob = await exportApi.exportAll(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `budget-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export downloaded" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and preferences
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium">{user?.email}</p>
              <p className="text-sm text-muted-foreground">
                Member since{" "}
                {new Date(user?.createdAt || "").toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>Manage expense categories</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newCategory.name) {
                createCategoryMutation.mutate(newCategory);
              }
            }}
            className="flex gap-3"
          >
            <Input
              placeholder="Category name"
              value={newCategory.name}
              onChange={(e) =>
                setNewCategory((c) => ({ ...c, name: e.target.value }))}
              className="flex-1"
            />
            <Input
              type="color"
              value={newCategory.color}
              onChange={(e) =>
                setNewCategory((c) => ({ ...c, color: e.target.value }))}
              className="w-14 p-1 h-10"
            />
            <Button type="submit" disabled={!newCategory.name}>
              <Plus className="h-4 w-4" />
            </Button>
          </form>

          <Separator />

          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    value={cat.color}
                    onChange={(e) =>
                      updateCategoryMutation.mutate({
                        id: cat.id,
                        data: { color: e.target.value },
                      })}
                    className="w-8 h-8 p-0.5 rounded-full cursor-pointer border-2 border-transparent hover:border-primary/50 transition-colors"
                    title="Change color"
                  />
                  <span className="font-medium">{cat.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCategoryToDelete(cat)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Delete Category Confirmation */}
      <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{categoryToDelete?.name}"? 
              Expenses using this category will become uncategorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCategory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle>Data Export</CardTitle>
          <CardDescription>Download all your data for backup</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => handleExport("json")}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
            <Button variant="outline" onClick={() => handleExport("csv")}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Exports include all expenses, assets, loans, and income data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
