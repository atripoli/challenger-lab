const express = require('express');
const { z } = require('zod');

const { pool } = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

const NUM_OR_NULL = z.union([z.number(), z.string()]).transform((v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
});

const schema = z.object({
  challenger_id:            z.string().min(1).max(60),    // p.ej. "angle_3"
  platform:                 z.string().min(1).max(40),    // p.ej. "LinkedIn"
  impressions:              NUM_OR_NULL.optional(),
  clicks:                   NUM_OR_NULL.optional(),
  ctr:                      NUM_OR_NULL.optional(),
  conversions:              NUM_OR_NULL.optional(),
  conversion_rate:          NUM_OR_NULL.optional(),
  cpc:                      NUM_OR_NULL.optional(),
  cpa:                      NUM_OR_NULL.optional(),
  budget_spent:             NUM_OR_NULL.optional(),
  currency:                 z.string().length(3).optional(),
  campaign_duration_days:   NUM_OR_NULL.optional(),
  actual_performance_score: NUM_OR_NULL.optional(),
  notes:                    z.string().nullable().optional(),
});

/**
 * Deriva el predicted_score buscando en experiment.scores la entrada cuyo
 * angle_number matchee con challenger_id. Prefiere platform_prediction[platform];
 * cae a total como fallback.
 */
function derivePredictedScore(scores, challengerId, platform) {
  if (!Array.isArray(scores)) return null;
  // challengerId puede venir como "angle_3" o "3"
  const match = challengerId.match(/(\d+)/);
  const num = match ? Number(match[1]) : null;
  if (num == null) return null;
  const entry = scores.find((s) => Number(s.angle_number) === num);
  if (!entry) return null;
  const platformKey = String(platform || '').toLowerCase();
  const pp = entry.platform_prediction || {};
  // intenta varias variantes de la key
  for (const k of Object.keys(pp)) {
    if (k.toLowerCase() === platformKey) {
      const v = Number(pp[k]);
      if (Number.isFinite(v)) return v;
    }
  }
  // fallback a total
  const t = Number(entry.total);
  return Number.isFinite(t) ? t : null;
}

async function checkExperimentExists(experimentId) {
  const { rows } = await pool.query(
    `SELECT id, scores FROM experiments WHERE id = $1 AND deleted_at IS NULL`,
    [experimentId],
  );
  return rows[0] || null;
}

// GET /api/experiments/:experimentId/results
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const exp = await checkExperimentExists(req.params.experimentId);
    if (!exp) return res.status(404).json({ error: 'Experimento no encontrado' });

    const { rows } = await pool.query(
      `SELECT r.*, u.full_name AS recorded_by_name
         FROM experiment_results r
         LEFT JOIN users u ON u.id = r.recorded_by
        WHERE r.experiment_id = $1
        ORDER BY r.recorded_at DESC`,
      [req.params.experimentId],
    );
    res.json({ results: rows });
  }),
);

// POST /api/experiments/:experimentId/results
router.post(
  '/',
  requireRole('admin', 'analyst'),
  asyncHandler(async (req, res) => {
    const data = schema.parse(req.body);
    const exp = await checkExperimentExists(req.params.experimentId);
    if (!exp) return res.status(404).json({ error: 'Experimento no encontrado' });

    const predicted = derivePredictedScore(exp.scores, data.challenger_id, data.platform);

    const { rows } = await pool.query(
      `INSERT INTO experiment_results
        (experiment_id, challenger_id, platform, impressions, clicks, ctr,
         conversions, conversion_rate, cpc, cpa, predicted_score,
         actual_performance_score, campaign_duration_days, budget_spent,
         currency, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        req.params.experimentId,
        data.challenger_id,
        data.platform,
        data.impressions ?? null,
        data.clicks ?? null,
        data.ctr ?? null,
        data.conversions ?? null,
        data.conversion_rate ?? null,
        data.cpc ?? null,
        data.cpa ?? null,
        predicted,
        data.actual_performance_score ?? null,
        data.campaign_duration_days ?? null,
        data.budget_spent ?? null,
        (data.currency || 'USD').toUpperCase(),
        data.notes || null,
        req.user.sub,
      ],
    );
    res.status(201).json({ result: rows[0] });
  }),
);

// PUT /api/experiments/:experimentId/results/:id
router.put(
  '/:id',
  requireRole('admin', 'analyst'),
  asyncHandler(async (req, res) => {
    const data = schema.parse(req.body);
    const exp = await checkExperimentExists(req.params.experimentId);
    if (!exp) return res.status(404).json({ error: 'Experimento no encontrado' });

    const predicted = derivePredictedScore(exp.scores, data.challenger_id, data.platform);

    const { rows } = await pool.query(
      `UPDATE experiment_results
          SET challenger_id            = $1,
              platform                 = $2,
              impressions              = $3,
              clicks                   = $4,
              ctr                      = $5,
              conversions              = $6,
              conversion_rate          = $7,
              cpc                      = $8,
              cpa                      = $9,
              predicted_score          = $10,
              actual_performance_score = $11,
              campaign_duration_days   = $12,
              budget_spent             = $13,
              currency                 = $14,
              notes                    = $15
        WHERE id = $16 AND experiment_id = $17
        RETURNING *`,
      [
        data.challenger_id,
        data.platform,
        data.impressions ?? null,
        data.clicks ?? null,
        data.ctr ?? null,
        data.conversions ?? null,
        data.conversion_rate ?? null,
        data.cpc ?? null,
        data.cpa ?? null,
        predicted,
        data.actual_performance_score ?? null,
        data.campaign_duration_days ?? null,
        data.budget_spent ?? null,
        (data.currency || 'USD').toUpperCase(),
        data.notes || null,
        req.params.id,
        req.params.experimentId,
      ],
    );
    if (!rows.length) return res.status(404).json({ error: 'Resultado no encontrado' });
    res.json({ result: rows[0] });
  }),
);

// DELETE /api/experiments/:experimentId/results/:id
router.delete(
  '/:id',
  requireRole('admin', 'analyst'),
  asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query(
      `DELETE FROM experiment_results WHERE id = $1 AND experiment_id = $2`,
      [req.params.id, req.params.experimentId],
    );
    if (!rowCount) return res.status(404).json({ error: 'Resultado no encontrado' });
    res.status(204).end();
  }),
);

module.exports = router;
