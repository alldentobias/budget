-- Migration: 002_add_savings_table
-- Description: Add savings table to track monthly savings
-- Date: 2026-01-23

CREATE TABLE IF NOT EXISTS savings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year_month INTEGER NOT NULL,
  amount BIGINT NOT NULL,
  source VARCHAR(255) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_savings_user_month ON savings(user_id, year_month);
