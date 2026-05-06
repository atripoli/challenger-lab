-- Imagen generada por Nano Banana (Gemini 2.5 Flash Image) para un brief.
-- Una imagen por brief; regenerar sobreescribe (no historial por ahora).
-- Si querés rotar versiones, después agregamos creative_image_revisions.

BEGIN;

ALTER TABLE creative_image_briefs
  ADD COLUMN IF NOT EXISTS image_url           TEXT,
  ADD COLUMN IF NOT EXISTS image_public_id     TEXT,
  ADD COLUMN IF NOT EXISTS image_model         VARCHAR(80),
  ADD COLUMN IF NOT EXISTS image_prompt_used   TEXT,           -- snapshot del prompt al momento de generar
  ADD COLUMN IF NOT EXISTS image_cost_usd      NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS image_generated_at  TIMESTAMPTZ;

COMMIT;
