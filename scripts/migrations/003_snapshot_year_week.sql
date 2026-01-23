-- Migration: 003_snapshot_year_week
-- Description: Change net_worth_snapshots from month-based to week-based
-- Date: 2026-01-23

-- Rename column from year_month to year_week
ALTER TABLE net_worth_snapshots 
RENAME COLUMN year_month TO year_week;

-- Update existing data: convert YYYYMM to YYYYWW (ISO week of first day of month)
-- For simplicity, we'll calculate the ISO week number for the 1st of each month
UPDATE net_worth_snapshots 
SET year_week = (
    EXTRACT(ISOYEAR FROM make_date(year_week / 100, year_week % 100, 1))::INTEGER * 100 
    + EXTRACT(WEEK FROM make_date(year_week / 100, year_week % 100, 1))::INTEGER
);

-- Drop old index and create new one
DROP INDEX IF EXISTS idx_net_worth_snapshots_user_month;
CREATE INDEX IF NOT EXISTS idx_net_worth_snapshots_user_week ON net_worth_snapshots(user_id, year_week);
