-- Migration: Add default "me" to userId parameters in Gmail capabilities
-- This ensures agents don't need to explicitly pass userId="me" for every call.
--
-- Updates all Gmail capabilities where detail_json contains a parameter named "userId"
-- by adding "default": "me" to that parameter object.

UPDATE capabilities
SET detail_json = (
  SELECT jsonb_set(
    detail_json::jsonb,
    '{parameters}',
    (
      SELECT jsonb_agg(
        CASE
          WHEN elem->>'name' = 'userId'
          THEN elem || '{"default": "me"}'::jsonb
          ELSE elem
        END
      )
      FROM jsonb_array_elements(detail_json::jsonb->'parameters') AS elem
    )
  )
)
WHERE service_id = (SELECT id FROM services WHERE domain = 'gmail.googleapis.com')
  AND detail_json::jsonb->'parameters' @> '[{"name": "userId"}]';
