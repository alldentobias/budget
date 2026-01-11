-- ============================================
-- SEED DATA FOR LOCAL DEVELOPMENT ONLY
-- DO NOT USE IN PRODUCTION
-- 
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
INSERT INTO expenses (user_id, category_id, date, amount, title, year_month, is_shared, settled) 
SELECT 
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  c.id,
  CURRENT_DATE,
  25000,
  'Sample Grocery Shopping',
  202601,
  true,
  true
FROM categories c 
WHERE c.user_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND c.name = 'Food & Dining'
ON CONFLICT DO NOTHING;


