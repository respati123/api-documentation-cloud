ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_discipline_check;
ALTER TABLE project_members ADD CONSTRAINT project_members_discipline_check CHECK (discipline IN ('backend', 'frontend', 'mobile', 'pm', 'qa', 'ui_ux', 'devops', 'other'));
