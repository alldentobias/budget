-- Migration: 001_add_sort_index_to_staged_expenses
-- Description: Add sort_index column to staged_expenses to preserve original file order
-- Date: 2026-01-11

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staged_expenses' AND column_name = 'sort_index'
    ) THEN
        ALTER TABLE staged_expenses ADD COLUMN sort_index INTEGER DEFAULT 0 NOT NULL;
    END IF;
END $$;

