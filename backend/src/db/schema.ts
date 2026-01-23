import {
  bigint,
  boolean,
  date,
  decimal,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, {
    onDelete: "cascade",
  }),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).notNull().default("#6b7280"),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// All monetary amounts are stored as integers in minor units (øre/cents)
// e.g., 12.50 kr is stored as 1250
export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, {
    onDelete: "cascade",
  }),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  date: date("date").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  notes: text("notes"),
  source: varchar("source", { length: 100 }),
  sourceFile: varchar("source_file", { length: 255 }),
  isShared: boolean("is_shared").default(false).notNull(),
  collectToMe: bigint("collect_to_me", { mode: "number" }).default(0).notNull(),
  collectFromMe: bigint("collect_from_me", { mode: "number" }).default(0)
    .notNull(),
  settled: boolean("settled").default(false).notNull(),
  yearMonth: integer("year_month").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stagedExpenses = pgTable("staged_expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, {
    onDelete: "cascade",
  }),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  date: date("date").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  source: varchar("source", { length: 100 }),
  rawData: text("raw_data"),
  isDuplicate: boolean("is_duplicate").default(false).notNull(),
  duplicateOf: uuid("duplicate_of").references(() => expenses.id, {
    onDelete: "set null",
  }),
  isShared: boolean("is_shared").default(false).notNull(),
  collectToMe: bigint("collect_to_me", { mode: "number" }).default(0).notNull(),
  collectFromMe: bigint("collect_from_me", { mode: "number" }).default(0)
    .notNull(),
  yearMonth: integer("year_month").notNull(),
  notes: text("notes"),
  sortIndex: integer("sort_index").default(0).notNull(), // Preserves original file order
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, {
    onDelete: "cascade",
  }),
  type: varchar("type", { length: 50 }).notNull(), // 'stock', 'property', 'cash', 'other'
  name: varchar("name", { length: 255 }).notNull(),
  ticker: varchar("ticker", { length: 20 }),
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull().default(
    "0",
  ),
  manualValue: bigint("manual_value", { mode: "number" }),
  currentPrice: bigint("current_price", { mode: "number" }),
  ownershipPct: decimal("ownership_pct", { precision: 5, scale: 2 }).notNull()
    .default("100"),
  lastPriceUpdate: timestamp("last_price_update"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const loans = pgTable("loans", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, {
    onDelete: "cascade",
  }),
  name: varchar("name", { length: 255 }).notNull(),
  principal: bigint("principal", { mode: "number" }).notNull(),
  currentBalance: bigint("current_balance", { mode: "number" }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(),
  ownershipPct: decimal("ownership_pct", { precision: 5, scale: 2 }).notNull()
    .default("100"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const incomes = pgTable("incomes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, {
    onDelete: "cascade",
  }),
  yearMonth: integer("year_month").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  source: varchar("source", { length: 255 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const savings = pgTable("savings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, {
    onDelete: "cascade",
  }),
  yearMonth: integer("year_month").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  source: varchar("source", { length: 255 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const netWorthSnapshots = pgTable("net_worth_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, {
    onDelete: "cascade",
  }),
  yearWeek: integer("year_week").notNull(),
  totalAssets: bigint("total_assets", { mode: "number" }).notNull(),
  totalLiabilities: bigint("total_liabilities", { mode: "number" }).notNull(),
  netWorth: bigint("net_worth", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  categories: many(categories),
  expenses: many(expenses),
  stagedExpenses: many(stagedExpenses),
  assets: many(assets),
  loans: many(loans),
  incomes: many(incomes),
  savings: many(savings),
  netWorthSnapshots: many(netWorthSnapshots),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.userId],
    references: [users.id],
  }),
  expenses: many(expenses),
  stagedExpenses: many(stagedExpenses),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  user: one(users, {
    fields: [expenses.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [expenses.categoryId],
    references: [categories.id],
  }),
}));

export const stagedExpensesRelations = relations(stagedExpenses, ({ one }) => ({
  user: one(users, {
    fields: [stagedExpenses.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [stagedExpenses.categoryId],
    references: [categories.id],
  }),
  duplicateExpense: one(expenses, {
    fields: [stagedExpenses.duplicateOf],
    references: [expenses.id],
  }),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
  user: one(users, {
    fields: [assets.userId],
    references: [users.id],
  }),
}));

export const loansRelations = relations(loans, ({ one }) => ({
  user: one(users, {
    fields: [loans.userId],
    references: [users.id],
  }),
}));

export const incomesRelations = relations(incomes, ({ one }) => ({
  user: one(users, {
    fields: [incomes.userId],
    references: [users.id],
  }),
}));

export const savingsRelations = relations(savings, ({ one }) => ({
  user: one(users, {
    fields: [savings.userId],
    references: [users.id],
  }),
}));

export const netWorthSnapshotsRelations = relations(
  netWorthSnapshots,
  ({ one }) => ({
    user: one(users, {
      fields: [netWorthSnapshots.userId],
      references: [users.id],
    }),
  }),
);
