-- A draft BRD or PRD that should not go on is discarded: kept for the record, but no longer worked on.
ALTER TABLE planning_documents DROP CONSTRAINT planning_documents_status_check;
ALTER TABLE planning_documents ADD CONSTRAINT planning_documents_status_check CHECK (status IN ('draft', 'review_pm', 'review_team', 'approved', 'superseded', 'discarded'));
