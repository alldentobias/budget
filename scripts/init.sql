-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#6b7280',
  is_default BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Expenses table (amounts stored as integers in minor units, e.g. øre/cents)
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  amount BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  notes TEXT,
  source VARCHAR(100),
  source_file VARCHAR(255),
  is_shared BOOLEAN DEFAULT FALSE NOT NULL,
  collect_to_me BIGINT DEFAULT 0 NOT NULL,
  collect_from_me BIGINT DEFAULT 0 NOT NULL,
  settled BOOLEAN DEFAULT FALSE NOT NULL,
  year_month INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Staged expenses table (amounts stored as integers in minor units)
CREATE TABLE IF NOT EXISTS staged_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  amount BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  source VARCHAR(100),
  raw_data TEXT,
  is_duplicate BOOLEAN DEFAULT FALSE NOT NULL,
  duplicate_of UUID REFERENCES expenses(id) ON DELETE SET NULL,
  is_shared BOOLEAN DEFAULT FALSE NOT NULL,
  collect_to_me BIGINT DEFAULT 0 NOT NULL,
  collect_from_me BIGINT DEFAULT 0 NOT NULL,
  year_month INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Assets table (monetary values stored as integers in minor units)
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  ticker VARCHAR(20),
  quantity DECIMAL(18, 8) NOT NULL DEFAULT 0,
  manual_value BIGINT,
  current_price BIGINT,
  ownership_pct DECIMAL(5, 2) NOT NULL DEFAULT 100,
  last_price_update TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Loans table (monetary values stored as integers in minor units)
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  principal BIGINT NOT NULL,
  current_balance BIGINT NOT NULL,
  interest_rate DECIMAL(5, 2) NOT NULL,
  ownership_pct DECIMAL(5, 2) NOT NULL DEFAULT 100,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Incomes table (amounts stored as integers in minor units)
CREATE TABLE IF NOT EXISTS incomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year_month INTEGER NOT NULL,
  amount BIGINT NOT NULL,
  source VARCHAR(255) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Net worth snapshots table (amounts stored as integers in minor units)
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year_month INTEGER NOT NULL,
  total_assets BIGINT NOT NULL,
  total_liabilities BIGINT NOT NULL,
  net_worth BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_user_month ON expenses(user_id, year_month);
CREATE INDEX IF NOT EXISTS idx_staged_expenses_user_month ON staged_expenses(user_id, year_month);
CREATE INDEX IF NOT EXISTS idx_incomes_user_month ON incomes(user_id, year_month);
CREATE INDEX IF NOT EXISTS idx_net_worth_snapshots_user_month ON net_worth_snapshots(user_id, year_month);

-- ============================================
-- SEED DATA FOR LOCAL DEVELOPMENT
-- Test user: test@example.com / password123
-- All monetary values are in minor units (øre/cents, i.e. * 100)
-- ============================================

-- The password hash below is for "password123" using bcrypt
-- Generated with cost factor 10
INSERT INTO users (id, email, password_hash, created_at)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'test@example.com',
  '$2a$10$u5nLpPFEt0HzIQU18k5JneIKWBnyAUyuNEHH1DSoY2HogiTCbPSom',
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Create default categories for test user
INSERT INTO categories (user_id, name, color, is_default) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Food & Dining', '#f97316', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Transportation', '#3b82f6', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Shopping', '#8b5cf6', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Entertainment', '#ec4899', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Bills & Utilities', '#eab308', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Healthcare', '#14b8a6', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Housing', '#6366f1', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Other', '#6b7280', true)
ON CONFLICT DO NOTHING;

-- Add sample assets (prices in minor units: 185.00 -> 18500, 380.00 -> 38000)
INSERT INTO assets (user_id, type, name, ticker, quantity, current_price, ownership_pct) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'stock', 'Apple Inc.', 'AAPL', 10, 18500, 100),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'stock', 'Microsoft', 'MSFT', 5, 38000, 100),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'property', 'Home', NULL, 1, NULL, 50),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'cash', 'Savings Account', NULL, 1, NULL, 100)
ON CONFLICT DO NOTHING;

-- Update property and cash with manual values (2500000.00 -> 250000000, 50000.00 -> 5000000)
UPDATE assets SET manual_value = 250000000 WHERE user_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND name = 'Home';
UPDATE assets SET manual_value = 5000000 WHERE user_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND name = 'Savings Account';

-- Add sample loan (2000000.00 -> 200000000, 1800000.00 -> 180000000)
INSERT INTO loans (user_id, name, principal, current_balance, interest_rate, ownership_pct, notes) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Home Mortgage', 200000000, 180000000, 3.5, 50, 'Split with spouse')
ON CONFLICT DO NOTHING;

-- Add sample income for current month (45000.00 -> 4500000)
INSERT INTO incomes (user_id, year_month, amount, source, notes) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 202601, 4500000, 'Salary', 'Monthly salary')
ON CONFLICT DO NOTHING;

-- Add a sample expense (250.00 -> 25000)
INSERT INTO expenses (user_id, category_id, date, amount, title, year_month) 
SELECT 
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  c.id,
  CURRENT_DATE,
  25000,
  'Sample Grocery Shopping',
  202601
FROM categories c 
WHERE c.user_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND c.name = 'Food & Dining'
ON CONFLICT DO NOTHING;
