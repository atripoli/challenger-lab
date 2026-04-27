-- Mueve `platforms` y `formats` al nivel de experimento.
-- El producto los mantiene como "típicos / default sugerido" para precargar
-- formularios, pero la fuente de verdad para una corrida pasa a ser el
-- experimento. Backfill de filas existentes copiando del producto.

BEGIN;

ALTER TABLE experiments
  ADD COLUMN IF NOT EXISTS platforms JSONB,
  ADD COLUMN IF NOT EXISTS formats   JSONB;

ALTER TABLE experiments DROP CONSTRAINT IF EXISTS experiments_platforms_is_array;
ALTER TABLE experiments DROP CONSTRAINT IF EXISTS experiments_formats_is_array;
ALTER TABLE experiments
  ADD CONSTRAINT experiments_platforms_is_array
    CHECK (platforms IS NULL OR jsonb_typeof(platforms) = 'array'),
  ADD CONSTRAINT experiments_formats_is_array
    CHECK (formats IS NULL OR jsonb_typeof(formats) = 'array');

-- Backfill desde el producto (para experimentos creados antes del cambio).
UPDATE experiments e
   SET platforms = p.platforms,
       formats   = p.formats
  FROM products p
 WHERE e.product_id = p.id
   AND e.platforms IS NULL
   AND e.formats IS NULL;

COMMIT;
