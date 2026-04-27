-- Tracking de uso real de la API de Anthropic por experimento.
-- El orchestrator registra después de cada skill: input_tokens, output_tokens,
-- cache_creation_input_tokens, cache_read_input_tokens, modelo, costo USD.
-- Estructura: { "skills": [ {...}, {...}, ... ] }
-- Se acumula hasta 4 entradas por experimento (una por skill).

BEGIN;

ALTER TABLE experiments
  ADD COLUMN IF NOT EXISTS usage JSONB;

ALTER TABLE experiments DROP CONSTRAINT IF EXISTS experiments_usage_shape;
ALTER TABLE experiments
  ADD CONSTRAINT experiments_usage_shape
  CHECK (usage IS NULL OR jsonb_typeof(usage) = 'object');

COMMIT;
