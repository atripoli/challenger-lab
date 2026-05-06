-- Distinguir 2 estados del brief:
-- - is_edited: humano editó el brief manualmente (los campos se modificaron)
-- - is_stale: el creative subyacente cambió desde que se generó el brief
--   (el copy del overlay, headline, etc. ya no coincide con lo que el brief
--    armó como final_nano_banana_prompt)
-- Pueden ser ambos true simultáneamente.

BEGIN;

ALTER TABLE creative_image_briefs
  ADD COLUMN IF NOT EXISTS is_stale BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
