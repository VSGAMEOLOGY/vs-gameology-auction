-- Categories table
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Admins manage categories"
  ON categories FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Default categories for VS GAMEOLOGY
INSERT INTO categories (name, slug) VALUES
  ('Board Games', 'board-games'),
  ('Card Games', 'card-games'),
  ('Trading Card Games', 'trading-card-games'),
  ('Role Playing Games', 'rpg'),
  ('Miniature Games', 'miniature-games'),
  ('Puzzle Games', 'puzzle-games'),
  ('Accessories & Parts', 'accessories'),
  ('Collectibles', 'collectibles');
