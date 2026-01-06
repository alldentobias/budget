-- Seed data for local development
-- Test user: test@example.com / password123

-- Create test user (password: password123, hashed with bcrypt)
INSERT INTO users (id, email, password_hash, created_at)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'test@example.com',
  '$2a$10$rQEY7zQGxP.GpGkMqQHYn.9ZDqVTHoLVV8q5VPqNqNqGqVHnq5XWK',
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

-- Add some sample assets
INSERT INTO assets (user_id, type, name, ticker, quantity, current_price, ownership_pct) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'stock', 'Apple Inc.', 'AAPL', '10', '185.00', '100'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'stock', 'Microsoft', 'MSFT', '5', '380.00', '100'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'property', 'Home', NULL, '1', NULL, '50'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'cash', 'Savings Account', NULL, '1', NULL, '100')
ON CONFLICT DO NOTHING;

-- Update property and cash with manual values
UPDATE assets SET manual_value = '2500000' WHERE user_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND name = 'Home';
UPDATE assets SET manual_value = '50000' WHERE user_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND name = 'Savings Account';

-- Add sample loan
INSERT INTO loans (user_id, name, principal, current_balance, interest_rate, ownership_pct, notes) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Home Mortgage', '2000000', '1800000', '3.5', '50', 'Split with spouse')
ON CONFLICT DO NOTHING;


