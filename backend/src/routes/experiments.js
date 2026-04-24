const express = require('express');
const { z } = require('zod');

const { pool } = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { runExperiment } = require('../services/orchestrator');

const router = express.Router();
router.use(requireAuth);

const RUNNING_STATUSES = new Set(['analyzing', 'optimizing', 'executing', 'scoring']);

const createSchema = z.object({
  product_id: z.number().int().positive(),
  name: z.string().min(1).max(255),
  brief_snapshot: z.string().optional().nullable(),
  champion_image_url: z.string().url().optional().nullable(),
  champion_public_id: z.string().optional().nullable(),
  historical_data: z.any().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const values = [];
    let where = 'e.deleted_at IS NULL';
    if (req.query.product_id) {
      values.push(Number(req.query.product_id));
      where += ` AND e.product_id = $${values.length}`;
    }
    if (req.query.status) {
      values.push(req.query.status);
      where += ` AND e.status = $${values.length}`;
    }
    const { rows } = await pool.query(
      `SELECT e.id, e.name, e.status, e.product_id, e.champion_image_url, e.winner_id,
              e.created_at, e.updated_at, e.completed_at,
              p.name AS product_name, c.name AS client_name
       FROM experiments e
       JOIN products p ON p.id = e.product_id
       JOIN clients  c ON c.id = p.client_id
       WHERE ${where}
       ORDER BY e.updated_at DESC`,
      values,
    );
    res.json({ experiments: rows });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT e.*, p.name AS product_name, c.name AS client_name
       FROM experiments e
       JOIN products p ON p.id = e.product_id
       JOIN clients  c ON c.id = p.client_id
       WHERE e.id = $1 AND e.deleted_at IS NULL`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Experimento no encontrado' });
    res.json({ experiment: rows[0] });
  }),
);

router.post(
  '/',
  requireRole('admin', 'analyst'),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO experiments
         (product_id, name, brief_snapshot, champion_image_url, champion_public_id, historical_data, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        data.product_id,
        data.name,
        data.brief_snapshot ?? null,
        data.champion_image_url ?? null,
        data.champion_public_id ?? null,
        data.historical_data != null ? JSON.stringify(data.historical_data) : null,
        req.user.sub,
      ],
    );
    res.status(201).json({ experiment: rows[0] });
  }),
);

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  brief_snapshot: z.string().nullable().optional(),
  champion_image_url: z.string().url().nullable().optional(),
  champion_public_id: z.string().nullable().optional(),
  historical_data: z.any().optional(),
});

router.patch(
  '/:id',
  requireRole('admin', 'analyst'),
  asyncHandler(async (req, res) => {
    const data = patchSchema.parse(req.body);
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (!entries.length) return res.status(400).json({ error: 'Nada que actualizar' });

    const setParts = [];
    const values = [];
    entries.forEach(([k, v]) => {
      values.push(k === 'historical_data' ? JSON.stringify(v) : v);
      setParts.push(`${k} = $${values.length}${k === 'historical_data' ? '::jsonb' : ''}`);
    });
    values.push(req.params.id);

    const { rows } = await pool.query(
      `UPDATE experiments SET ${setParts.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length} AND deleted_at IS NULL
       RETURNING *`,
      values,
    );
    if (!rows.length) return res.status(404).json({ error: 'Experimento no encontrado' });
    res.json({ experiment: rows[0] });
  }),
);

// POST /api/experiments/:id/run — dispara la orquestación async.
router.post(
  '/:id/run',
  requireRole('admin', 'analyst'),
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, status, champion_image_url
       FROM experiments WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id],
    );
    const exp = rows[0];
    if (!exp) return res.status(404).json({ error: 'Experimento no encontrado' });
    if (!exp.champion_image_url) {
      return res.status(400).json({ error: 'Debe subirse la imagen Champion antes de ejecutar' });
    }
    if (RUNNING_STATUSES.has(exp.status)) {
      return res.status(409).json({ error: `Ya está en ejecución (status=${exp.status})` });
    }

    await pool.query(
      `UPDATE experiments SET status = 'analyzing', error_message = NULL, updated_at = NOW()
       WHERE id = $1`,
      [exp.id],
    );

    // Fire-and-forget: el frontend hace polling sobre GET /:id
    runExperiment(exp.id).catch((err) => {
      console.error('[experiments] orchestrator error', exp.id, err.message);
    });

    res.status(202).json({ accepted: true, experiment_id: exp.id });
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query(
      `UPDATE experiments SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id],
    );
    if (!rowCount) return res.status(404).json({ error: 'Experimento no encontrado' });
    res.status(204).end();
  }),
);

module.exports = router;
