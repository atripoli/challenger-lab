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
  campaign_name:   z.string().min(1).max(255),
  period_start:    z.string().nullable().optional(),
  period_end:      z.string().nullable().optional(),
  platform:        z.string().max(40).nullable().optional(),
  impressions:     NUM_OR_NULL.optional(),
  clicks:          NUM_OR_NULL.optional(),
  ctr:             NUM_OR_NULL.optional(),
  conversions:     NUM_OR_NULL.optional(),
  conversion_rate: NUM_OR_NULL.optional(),
  cpc:             NUM_OR_NULL.optional(),
  cpa:             NUM_OR_NULL.optional(),
  budget_spent:    NUM_OR_NULL.optional(),
  currency:        z.string().length(3).optional(),
  source:          z.enum(['manual','experiment','xlsx']).optional(),
  notes:           z.string().nullable().optional(),
});

async function checkProductExists(productId) {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM products WHERE id = $1 AND deleted_at IS NULL`,
    [productId],
  );
  return rowCount > 0;
}

// GET /api/products/:productId/history
router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!(await checkProductExists(req.params.productId))) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    const { rows } = await pool.query(
      `SELECT *
         FROM product_history
        WHERE product_id = $1
        ORDER BY COALESCE(period_start, recorded_at::date) DESC, id DESC`,
      [req.params.productId],
    );
    res.json({ history: rows });
  }),
);

// POST /api/products/:productId/history
router.post(
  '/',
  requireRole('admin', 'analyst'),
  asyncHandler(async (req, res) => {
    const data = schema.parse(req.body);
    if (!(await checkProductExists(req.params.productId))) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    const { rows } = await pool.query(
      `INSERT INTO product_history
        (product_id, campaign_name, period_start, period_end, platform,
         impressions, clicks, ctr, conversions, conversion_rate,
         cpc, cpa, budget_spent, currency, source, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        req.params.productId,
        data.campaign_name,
        data.period_start || null,
        data.period_end || null,
        data.platform || null,
        data.impressions ?? null,
        data.clicks ?? null,
        data.ctr ?? null,
        data.conversions ?? null,
        data.conversion_rate ?? null,
        data.cpc ?? null,
        data.cpa ?? null,
        data.budget_spent ?? null,
        data.currency || 'USD',
        data.source || 'manual',
        data.notes || null,
        req.user.sub,
      ],
    );
    res.status(201).json({ entry: rows[0] });
  }),
);

// PUT /api/products/:productId/history/:id
router.put(
  '/:id',
  requireRole('admin', 'analyst'),
  asyncHandler(async (req, res) => {
    const data = schema.parse(req.body);
    const { rows } = await pool.query(
      `UPDATE product_history
          SET campaign_name   = $1,
              period_start    = $2,
              period_end      = $3,
              platform        = $4,
              impressions     = $5,
              clicks          = $6,
              ctr             = $7,
              conversions     = $8,
              conversion_rate = $9,
              cpc             = $10,
              cpa             = $11,
              budget_spent    = $12,
              currency        = $13,
              source          = $14,
              notes           = $15,
              updated_at      = NOW()
        WHERE id = $16 AND product_id = $17
        RETURNING *`,
      [
        data.campaign_name,
        data.period_start || null,
        data.period_end || null,
        data.platform || null,
        data.impressions ?? null,
        data.clicks ?? null,
        data.ctr ?? null,
        data.conversions ?? null,
        data.conversion_rate ?? null,
        data.cpc ?? null,
        data.cpa ?? null,
        data.budget_spent ?? null,
        data.currency || 'USD',
        data.source || 'manual',
        data.notes || null,
        req.params.id,
        req.params.productId,
      ],
    );
    if (!rows.length) return res.status(404).json({ error: 'Entrada no encontrada' });
    res.json({ entry: rows[0] });
  }),
);

// DELETE /api/products/:productId/history/:id
router.delete(
  '/:id',
  requireRole('admin', 'analyst'),
  asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query(
      `DELETE FROM product_history WHERE id = $1 AND product_id = $2`,
      [req.params.id, req.params.productId],
    );
    if (!rowCount) return res.status(404).json({ error: 'Entrada no encontrada' });
    res.status(204).end();
  }),
);

module.exports = router;
