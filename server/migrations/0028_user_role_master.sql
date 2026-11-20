CREATE TABLE IF NOT EXISTS role_master (
  id TEXT PRIMARY KEY CHECK (id IN ('backend', 'frontend', 'mobile', 'pm', 'qa', 'ui_ux', 'devops', 'other', 'tech_lead')),
  sort_order SMALLINT NOT NULL UNIQUE
);

INSERT INTO role_master (id, sort_order) VALUES
  ('pm', 1),
  ('tech_lead', 2),
  ('ui_ux', 3),
  ('backend', 4),
  ('frontend', 5),
  ('mobile', 6),
  ('qa', 7),
  ('devops', 8),
  ('other', 9)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES role_master(id) ON DELETE RESTRICT,
  assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS user_roles_role_idx ON user_roles(role_id, user_id);
