const express = require('express');
const { z } = require('zod');

const { pool } = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const clientSchema = z.object({
  name: z.string().min(1).max(255),
  industry: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT id, name, industry, notes, created_at, updated_at
       FROM clients WHERE deleted_at IS NULL ORDER BY name ASC`,
    );
    res.json({ clients: rows });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, name, industry, notes, created_at, updated_at
       FROM clients WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ client: rows[0] });
  }),
);

router.post(
  '/',
  requireRole('admin', 'analyst'),
  asyncHandler(async (req, res) => {
    const data = clientSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO clients (name, industry, notes, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.name, data.industry ?? null, data.notes ?? null, req.user.sub],
    );
    res.status(201).json({ client: rows[0] });
  }),
);

router.put(
  '/:id',
  requireRole('admin', 'analyst'),
  asyncHandler(async (req, res) => {
    const data = clientSchema.parse(req.body);
    const { rows } = await pool.query(
      `UPDATE clients SET name = $1, industry = $2, notes = $3
       WHERE id = $4 AND deleted_at IS NULL RETURNING *`,
      [data.name, data.industry ?? null, data.notes ?? null, req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ client: rows[0] });
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query(
      `UPDATE clients SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id],
    );
    if (!rowCount) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.status(204).end();
  }),
);

module.exports = router;
