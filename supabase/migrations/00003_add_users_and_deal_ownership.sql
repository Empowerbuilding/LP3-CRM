-- ============================================
-- Multi-user Support
-- Creates users table and adds deal ownership
-- ============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'sales' CHECK (role IN ('admin', 'sales')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Enable RLS on users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on users" ON users FOR ALL USING (true) WITH CHECK (true);

-- Add owner_id to deals
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_deals_owner_id ON deals(owner_id);

-- ============================================
-- Seed test users
-- ============================================
INSERT INTO users (id, email, name, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'mitchell@empowerbuilding.ai', 'Mitchell Madison', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'lp3owner@lp3roofing.com', 'LP3 Owner', 'sales')
ON CONFLICT (email) DO NOTHING;
