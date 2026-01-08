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
