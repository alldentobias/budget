const API_BASE = "/api";

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_BASE}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...fetchOptions.headers,
    },
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: "An error occurred",
    }));
    throw new ApiError(response.status, error.message || "An error occurred");
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    fetchApi<{ user: User; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string) =>
    fetchApi<{ user: User; token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => fetchApi<void>("/auth/logout", { method: "POST" }),

  me: () => fetchApi<User>("/auth/me"),

  registrationStatus: () =>
    fetchApi<{ registrationEnabled: boolean }>("/auth/registration-status"),
};

// Dashboard
export const dashboardApi = {
  getSummary: (yearMonth?: number) =>
    fetchApi<DashboardSummary>(
      `/dashboard/summary${yearMonth ? `?yearMonth=${yearMonth}` : ""}`,
    ),

  getNetWorthHistory: () =>
    fetchApi<NetWorthSnapshot[]>("/dashboard/net-worth-history"),

  recordNetWorthSnapshot: () =>
    fetchApi<NetWorthSnapshot>("/dashboard/record-snapshot", {
      method: "POST",
    }),
};

// Assets
export const assetsApi = {
  getAll: () => fetchApi<Asset[]>("/assets"),

  create: (asset: CreateAssetInput) =>
    fetchApi<Asset>("/assets", {
      method: "POST",
      body: JSON.stringify(asset),
    }),

  update: (id: string, asset: Partial<CreateAssetInput>) =>
    fetchApi<Asset>(`/assets/${id}`, {
      method: "PUT",
      body: JSON.stringify(asset),
    }),

  delete: (id: string) => fetchApi<void>(`/assets/${id}`, { method: "DELETE" }),

  refreshPrices: () =>
    fetchApi<Asset[]>("/assets/refresh-prices", { method: "POST" }),
};

// Loans
export const loansApi = {
  getAll: () => fetchApi<Loan[]>("/loans"),

  create: (loan: CreateLoanInput) =>
    fetchApi<Loan>("/loans", {
      method: "POST",
      body: JSON.stringify(loan),
    }),

  update: (id: string, loan: Partial<CreateLoanInput>) =>
    fetchApi<Loan>(`/loans/${id}`, {
      method: "PUT",
      body: JSON.stringify(loan),
    }),

  delete: (id: string) => fetchApi<void>(`/loans/${id}`, { method: "DELETE" }),
};

// Categories
export const categoriesApi = {
  getAll: () => fetchApi<Category[]>("/categories"),

  create: (category: { name: string; color: string }) =>
    fetchApi<Category>("/categories", {
      method: "POST",
      body: JSON.stringify(category),
    }),

  update: (id: string, category: { name?: string; color?: string }) =>
    fetchApi<Category>(`/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(category),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/categories/${id}`, { method: "DELETE" }),
};

// Expenses
export const expensesApi = {
  getByMonth: (yearMonth: number) =>
    fetchApi<Expense[]>("/expenses", { params: { yearMonth } }),

  create: (expense: CreateExpenseInput) =>
    fetchApi<Expense>("/expenses", {
      method: "POST",
      body: JSON.stringify(expense),
    }),

  update: (id: string, expense: Partial<CreateExpenseInput>) =>
    fetchApi<Expense>(`/expenses/${id}`, {
      method: "PUT",
      body: JSON.stringify(expense),
    }),

  bulkUpdate: (updates: Array<{ id: string } & Partial<CreateExpenseInput>>) =>
    fetchApi<Expense[]>("/expenses/bulk", {
      method: "PUT",
      body: JSON.stringify({ updates }),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/expenses/${id}`, { method: "DELETE" }),

  bulkDelete: (ids: string[]) =>
    fetchApi<void>("/expenses/bulk", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    }),

  getStats: (yearMonth: number) =>
    fetchApi<ExpenseStats>("/expenses/stats", { params: { yearMonth } }),
};

// Incomes
export const incomesApi = {
  getByMonth: (yearMonth: number) =>
    fetchApi<Income[]>("/incomes", { params: { yearMonth } }),

  create: (income: CreateIncomeInput) =>
    fetchApi<Income>("/incomes", {
      method: "POST",
      body: JSON.stringify(income),
    }),

  update: (id: string, income: Partial<CreateIncomeInput>) =>
    fetchApi<Income>(`/incomes/${id}`, {
      method: "PUT",
      body: JSON.stringify(income),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/incomes/${id}`, { method: "DELETE" }),
};

// Savings
export const savingsApi = {
  getByMonth: (yearMonth: number) =>
    fetchApi<Saving[]>("/savings", { params: { yearMonth } }),

  create: (saving: CreateSavingInput) =>
    fetchApi<Saving>("/savings", {
      method: "POST",
      body: JSON.stringify(saving),
    }),

  update: (id: string, saving: Partial<CreateSavingInput>) =>
    fetchApi<Saving>(`/savings/${id}`, {
      method: "PUT",
      body: JSON.stringify(saving),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/savings/${id}`, { method: "DELETE" }),
};

// Import
export const importApi = {
  getExtractors: () =>
    fetchApi<{ extractors: ExtractorInfo[] }>("/import/extractors"),

  upload: async (file: File, extractor: string, yearMonth: number) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("extractor", extractor);
    formData.append("yearMonth", yearMonth.toString());

    const response = await fetch(`${API_BASE}/import/upload`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: "Upload failed",
      }));
      throw new ApiError(response.status, error.message);
    }

    return response.json() as Promise<ImportResult>;
  },

  getStaged: (yearMonth: number) =>
    fetchApi<StagedExpense[]>("/import/staged", { params: { yearMonth } }),

  getStagedSummary: () =>
    fetchApi<{ yearMonth: number; count: number }[]>("/import/staged/summary"),

  updateStaged: (id: string, update: Partial<StagedExpenseUpdate>) =>
    fetchApi<StagedExpense>(`/import/staged/${id}`, {
      method: "PUT",
      body: JSON.stringify(update),
    }),

  deleteStaged: (id: string) =>
    fetchApi<void>(`/import/staged/${id}`, { method: "DELETE" }),

  clearStaged: (yearMonth: number) =>
    fetchApi<{ deleted: number }>("/import/staged/clear", {
      method: "POST",
      body: JSON.stringify({ yearMonth }),
    }),

  commit: (yearMonth: number) =>
    fetchApi<{ committed: number }>("/import/commit", {
      method: "POST",
      body: JSON.stringify({ yearMonth }),
    }),
};

// Export
export const exportApi = {
  exportAll: (format: "csv" | "json") =>
    fetch(`${API_BASE}/export/all?format=${format}`, { credentials: "include" })
      .then((res) => res.blob()),

  exportExpenses: (yearMonth?: number, format: "csv" | "json" = "csv") => {
    const params = new URLSearchParams({ format });
    if (yearMonth) params.append("yearMonth", String(yearMonth));
    return fetch(`${API_BASE}/export/expenses?${params}`, {
      credentials: "include",
    })
      .then((res) => res.blob());
  },
};

// Stocks
export const stocksApi = {
  getQuote: (ticker: string) => fetchApi<StockQuote>(`/stocks/quote/${ticker}`),

  getQuotes: (tickers: string[]) =>
    fetchApi<StockQuote[]>("/stocks/quotes", {
      method: "POST",
      body: JSON.stringify({ tickers }),
    }),
};

// Types
export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface DashboardSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  debtToAssetRatio: number;
  monthlyExpenses: number;
  monthlyIncome: number;
  monthlySavings: number;
  stockPortfolioValue: number;
  topCategories: Array<{ name: string; amount: number; color: string }>;
}

export interface NetWorthSnapshot {
  id: string;
  userId: string;
  yearWeek: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  createdAt: string;
}

export interface Asset {
  id: string;
  userId: string;
  type: "stock" | "property" | "cash" | "other";
  name: string;
  ticker?: string;
  quantity: number;
  manualValue?: number;
  currentPrice?: number;
  ownershipPct: number;
  lastPriceUpdate?: string;
  createdAt: string;
}

export interface CreateAssetInput {
  type: "stock" | "property" | "cash" | "other";
  name: string;
  ticker?: string;
  quantity: number;
  manualValue?: number;
  ownershipPct: number;
}

export interface Loan {
  id: string;
  userId: string;
  name: string;
  principal: number;
  currentBalance: number;
  interestRate: number;
  ownershipPct: number;
  notes?: string;
  createdAt: string;
}

export interface CreateLoanInput {
  name: string;
  principal: number;
  currentBalance: number;
  interestRate: number;
  ownershipPct: number;
  notes?: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  color: string;
  isDefault: boolean;
}

export interface Expense {
  id: string;
  userId: string;
  categoryId?: string;
  category?: Category;
  date: string;
  amount: number;
  title: string;
  description?: string;
  notes?: string;
  source?: string;
  sourceFile?: string;
  isShared: boolean; // Automatically splits expense 50/50
  collectToMe: number; // Amount to collect from partner
  collectFromMe: number; // Amount to pay to partner
  settled: boolean;
  yearMonth: number;
}

export interface CreateExpenseInput {
  categoryId?: string | null;
  date: string;
  amount: number;
  title: string;
  description?: string;
  notes?: string | null;
  isShared?: boolean;
  collectToMe?: number;
  collectFromMe?: number;
  settled?: boolean;
  yearMonth?: number;
}

export interface ExpenseStats {
  total: number;
  byCategory: Array<
    {
      categoryId: string;
      name: string;
      color: string;
      amount: number;
      count: number;
    }
  >;
  count: number;
  totalCollectToMe: number; // Total amount others owe you (unsettled)
  totalCollectFromMe: number; // Total amount you owe others (unsettled)
  settledToMe: number;
  settledFromMe: number;
  netSettlement: number;
}

export interface Income {
  id: string;
  userId: string;
  yearMonth: number;
  amount: number;
  source: string;
  notes?: string;
}

export interface CreateIncomeInput {
  yearMonth: number;
  amount: number;
  source: string;
  notes?: string;
}

export interface Saving {
  id: string;
  userId: string;
  yearMonth: number;
  amount: number;
  source: string;
  notes?: string;
}

export interface CreateSavingInput {
  yearMonth: number;
  amount: number;
  source: string;
  notes?: string;
}

export interface ExtractorInfo {
  name: string;
  description: string;
  supported_formats: string[];
}

export interface ImportResult {
  success: boolean;
  message: string;
  staged: number;
  duplicates: number;
}

export interface StagedExpense {
  id: string;
  userId: string;
  categoryId?: string;
  category?: Category;
  date: string;
  amount: number;
  title: string;
  source?: string;
  rawData?: string;
  isDuplicate: boolean;
  duplicateOf?: string;
  isShared: boolean;
  collectToMe: number;
  collectFromMe: number;
  yearMonth: number;
  sortIndex: number;
  notes?: string;
}

export interface StagedExpenseUpdate {
  categoryId?: string | null;
  title?: string;
  amount?: number;
  date?: string;
  notes?: string | null;
  isShared?: boolean;
  collectToMe?: number;
  collectFromMe?: number;
}

export interface StockQuote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  name: string;
}
