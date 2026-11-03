-- Commits written before the insert fix stored the snapshot and parent ids as JSON strings. Store the value itself.
UPDATE commits SET snapshot = (snapshot #>> '{}')::jsonb WHERE jsonb_typeof(snapshot) = 'string';
UPDATE commits SET parent_ids = (parent_ids #>> '{}')::jsonb WHERE jsonb_typeof(parent_ids) = 'string';
