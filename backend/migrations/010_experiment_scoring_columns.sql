-- Columnas para el nuevo shape del Performance Scorer (prompts v2):
-- - champion_score: JSONB con {novelty, appeal, conversion, total} del Champion
-- - uplift_vs_champion: delta entre ganador y Champion (puede ser negativo)
-- - winner_payload: objeto completo del winner (angle_number, total_score, recommendation)
-- El array de scores por challenger se sigue guardando en `scores` (challenger_scores renombrado).

BEGIN;

ALTER TABLE experiments
  ADD COLUMN IF NOT EXISTS champion_score     JSONB,
  ADD COLUMN IF NOT EXISTS uplift_vs_champion NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS winner_payload     JSONB;

COMMIT;
