-- Categories table
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  display_order INT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
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
INSERT INTO categories (name, display_order) VALUES
('NS 1', 1),
('NS 2', 2),
('PS4', 3),
('PS5', 4),
('PSP', 5),
('PS Vita', 6),
('TCG', 7),
('Figures', 8),
('Others', 9);
