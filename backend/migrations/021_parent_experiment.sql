-- Soporte para iteraciones Champion & Challenger.
-- Cada experimento puede tener un parent_experiment_id; cuando está seteado,
-- el orchestrator copia los ángulos del padre y saltea skill 1 (Analyzer),
-- arrancando directo en awaiting_review. Esto refleja la realidad operativa:
-- a lo largo del año hay N versiones del aviso sobre los mismos ángulos
-- estratégicos, lo que cambia es la ejecución creativa.

BEGIN;

ALTER TABLE experiments
  ADD COLUMN IF NOT EXISTS parent_experiment_id INTEGER REFERENCES experiments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_experiments_parent ON experiments(parent_experiment_id);

COMMIT;
