-- Migration: 001_add_sort_index_to_staged_expenses
-- Description: Add sort_index column to staged_expenses to preserve original file order
-- Date: 2026-01-11

ALTER TABLE staged_expenses ADD COLUMN sort_index INTEGER DEFAULT 0 NOT NULL;

