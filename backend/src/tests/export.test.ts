/**
 * Tests for CSV/JSON export functionality.
 * Run with: deno test --allow-env --allow-read
 */

import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.210.0/assert/mod.ts";

/**
 * Test CSV export formatting utilities
 */

// Helper function to escape CSV fields (replicated from export.ts logic)
function escapeCSVField(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Helper function to format expense row as CSV
function formatExpenseRowAsCSV(expense: {
  date: string;
  title: string;
  amount: number;
  category?: string;
  description?: string;
  notes?: string;
  yearMonth?: number;
}): string {
  return [
    expense.date,
    `"${expense.title.replace(/"/g, '""')}"`,
    expense.amount,
    expense.category || "",
    expense.description ? `"${expense.description.replace(/"/g, '""')}"` : "",
    expense.notes ? `"${expense.notes.replace(/"/g, '""')}"` : "",
    expense.yearMonth || "",
  ].join(",");
}

Deno.test("CSV Export - Basic field formatting", () => {
  const expense = {
    date: "2025-01-15",
    title: "Coffee Shop",
    amount: 45.50,
    category: "Food & Dining",
    description: "Morning coffee",
    notes: "",
  };

  const row = formatExpenseRowAsCSV(expense);
  
  assertStringIncludes(row, "2025-01-15");
  assertStringIncludes(row, '"Coffee Shop"');
  assertStringIncludes(row, "45.5");
  assertStringIncludes(row, "Food & Dining");
});

Deno.test("CSV Export - Escapes quotes in title", () => {
  const expense = {
    date: "2025-01-15",
    title: 'Restaurant "The Best"',
    amount: 250.00,
    category: "Food & Dining",
  };

  const row = formatExpenseRowAsCSV(expense);
  
  // Double quotes should be escaped
  assertStringIncludes(row, '""The Best""');
});

Deno.test("CSV Export - Handles empty fields", () => {
  const expense = {
    date: "2025-01-15",
    title: "Simple expense",
    amount: 100.00,
  };

  const row = formatExpenseRowAsCSV(expense);
  const fields = row.split(",");
  
  // Should have placeholders for missing fields
  assertEquals(fields[0], "2025-01-15");
  assertEquals(fields[2], "100");
});

Deno.test("CSV Export - Handles Norwegian characters in title", () => {
  const expense = {
    date: "2025-01-15",
    title: "Café Ægir Øst",
    amount: 89.00,
    category: "Food & Dining",
  };

  const row = formatExpenseRowAsCSV(expense);
  
  assertStringIncludes(row, "Café Ægir Øst");
});

Deno.test("CSV Export - Negative amounts preserved", () => {
  const expense = {
    date: "2025-01-15",
    title: "Expense",
    amount: -150.75,
  };

  const row = formatExpenseRowAsCSV(expense);
  
  assertStringIncludes(row, "-150.75");
});

/**
 * Test CSV generation with headers
 */
function generateCSV(expenses: Array<{
  date: string;
  title: string;
  amount: number;
  category?: string;
  description?: string;
  notes?: string;
  yearMonth?: number;
}>): string {
  const headers = ["Date", "Title", "Amount", "Category", "Description", "Notes", "YearMonth"];
  const rows = expenses.map(formatExpenseRowAsCSV);
  return [headers.join(","), ...rows].join("\n");
}

Deno.test("CSV Export - Full CSV with headers", () => {
  const expenses = [
    { date: "2025-01-15", title: "Coffee", amount: 45.00, category: "Food" },
    { date: "2025-01-16", title: "Groceries", amount: 320.50, category: "Food" },
  ];

  const csv = generateCSV(expenses);
  const lines = csv.split("\n");
  
  assertEquals(lines.length, 3); // Header + 2 rows
  assertEquals(lines[0], "Date,Title,Amount,Category,Description,Notes,YearMonth");
  assertStringIncludes(lines[1], "Coffee");
  assertStringIncludes(lines[2], "Groceries");
});

Deno.test("CSV Export - Empty expense list", () => {
  const expenses: Array<{
    date: string;
    title: string;
    amount: number;
  }> = [];

  const csv = generateCSV(expenses);
  const lines = csv.split("\n");
  
  assertEquals(lines.length, 1); // Only header
  assertEquals(lines[0], "Date,Title,Amount,Category,Description,Notes,YearMonth");
});

/**
 * Test JSON export formatting
 */
Deno.test("JSON Export - Basic structure", () => {
  const data = {
    exportDate: "2025-01-15T12:00:00.000Z",
    expenses: [
      { date: "2025-01-15", title: "Test", amount: 100 }
    ],
    assets: [],
    loans: [],
    incomes: [],
    categories: [],
  };

  const json = JSON.stringify(data, null, 2);
  const parsed = JSON.parse(json);
  
  assertEquals(parsed.expenses.length, 1);
  assertEquals(parsed.expenses[0].amount, 100);
});

Deno.test("JSON Export - Preserves decimal precision", () => {
  const expense = { date: "2025-01-15", title: "Test", amount: 123.45 };
  
  const json = JSON.stringify(expense);
  const parsed = JSON.parse(json);
  
  assertEquals(parsed.amount, 123.45);
});

/**
 * Test CSV parsing (for import validation)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip the escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

Deno.test("CSV Parse - Simple fields", () => {
  const line = "2025-01-15,Coffee,45.50";
  const fields = parseCSVLine(line);
  
  assertEquals(fields.length, 3);
  assertEquals(fields[0], "2025-01-15");
  assertEquals(fields[1], "Coffee");
  assertEquals(fields[2], "45.50");
});

Deno.test("CSV Parse - Quoted fields", () => {
  const line = '2025-01-15,"Coffee Shop",45.50';
  const fields = parseCSVLine(line);
  
  assertEquals(fields.length, 3);
  assertEquals(fields[1], "Coffee Shop");
});

Deno.test("CSV Parse - Escaped quotes", () => {
  const line = '2025-01-15,"Restaurant ""The Best""",250.00';
  const fields = parseCSVLine(line);
  
  assertEquals(fields.length, 3);
  assertEquals(fields[1], 'Restaurant "The Best"');
});

Deno.test("CSV Parse - Field with comma", () => {
  const line = '2025-01-15,"Coffee, tea, and snacks",45.50';
  const fields = parseCSVLine(line);
  
  assertEquals(fields.length, 3);
  assertEquals(fields[1], "Coffee, tea, and snacks");
});

/**
 * Test round-trip (export then parse)
 */
Deno.test("CSV Round-trip - Data integrity", () => {
  const originalExpense = {
    date: "2025-01-15",
    title: 'Test "Expense" with, special chars',
    amount: 123.45,
    category: "Food & Dining",
    description: "Test description",
    notes: "",
  };

  // Export to CSV row
  const csvRow = formatExpenseRowAsCSV(originalExpense);
  
  // Parse back
  const fields = parseCSVLine(csvRow);
  
  assertEquals(fields[0], originalExpense.date);
  assertEquals(fields[1], originalExpense.title);
  assertEquals(parseFloat(fields[2]), originalExpense.amount);
  assertEquals(fields[3], originalExpense.category);
});

