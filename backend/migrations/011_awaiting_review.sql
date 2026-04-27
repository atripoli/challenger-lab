-- Pausa interactiva entre Analyzer (skill 1) y los demás skills.
-- Tras generar 5 ángulos el experimento queda en `awaiting_review`; el usuario
-- puede editar ángulos y elegir N (1-5) para continuar el pipeline.

BEGIN;

ALTER TABLE experiments DROP CONSTRAINT IF EXISTS experiments_status_check;
ALTER TABLE experiments
  ADD CONSTRAINT experiments_status_check
  CHECK (status IN (
    'draft','analyzing','awaiting_review','optimizing','executing','scoring','completed','failed'
  ));

ALTER TABLE experiments
  ADD COLUMN IF NOT EXISTS selected_angle_numbers JSONB;

ALTER TABLE experiments DROP CONSTRAINT IF EXISTS experiments_selected_is_array;
ALTER TABLE experiments
  ADD CONSTRAINT experiments_selected_is_array
  CHECK (selected_angle_numbers IS NULL OR jsonb_typeof(selected_angle_numbers) = 'array');

COMMIT;
