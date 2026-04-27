const express = require('express');
const { z } = require('zod');

const { pool } = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const productSchema = z.object({
  client_id:       z.number().int().positive(),
  name:            z.string().min(1).max(255),
  category:        z.string().max(100).optional().nullable(),
  description:     z.string().optional().nullable(),
  brief_text:      z.string().min(1, 'brief_text es obligatorio'),
  target_audience: z.string().min(1, 'target_audience es obligatorio'),
  key_benefit:     z.string().optional().nullable(),
  context:         z.string().optional().nullable(),
  platforms:       z.array(z.string()).default([]),  // sugerencia / default; el experimento define lo definitivo
  formats:         z.array(z.string()).default([]),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const clientId = req.query.client_id ? Number(req.query.client_id) : null;
    const values = [];
    let where = 'p.deleted_at IS NULL';
    if (clientId) {
      values.push(clientId);
      where += ` AND p.client_id = $${values.length}`;
    }
    const { rows } = await pool.query(
      `SELECT p.*, c.name AS client_name
       FROM products p JOIN clients c ON c.id = p.client_id
       WHERE ${where}
       ORDER BY p.updated_at DESC`,
      values,
    );
    res.json({ products: rows });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT p.*, c.name AS client_name
       FROM products p JOIN clients c ON c.id = p.client_id
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ product: rows[0] });
  }),
);

router.post(
  '/',
  requireRole('admin', 'analyst'),
  asyncHandler(async (req, res) => {
    const data = productSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO products
         (client_id, name, category, description, brief_text, target_audience,
          key_benefit, context, platforms, formats, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)
       RETURNING *`,
      [
        data.client_id,
        data.name,
        data.category    ?? null,
        data.description ?? null,
        data.brief_text,
        data.target_audience,
        data.key_benefit ?? null,
        data.context     ?? null,
        JSON.stringify(data.platforms),
        JSON.stringify(data.formats),
        req.user.sub,
      ],
    );
    res.status(201).json({ product: rows[0] });
  }),
);

router.put(
  '/:id',
  requireRole('admin', 'analyst'),
  asyncHandler(async (req, res) => {
    const data = productSchema.parse(req.body);
    const { rows } = await pool.query(
      `UPDATE products
          SET client_id       = $1,
              name            = $2,
              category        = $3,
              description     = $4,
              brief_text      = $5,
              target_audience = $6,
              key_benefit     = $7,
              context         = $8,
              platforms       = $9::jsonb,
              formats         = $10::jsonb
        WHERE id = $11 AND deleted_at IS NULL
        RETURNING *`,
      [
        data.client_id,
        data.name,
        data.category    ?? null,
        data.description ?? null,
        data.brief_text,
        data.target_audience,
        data.key_benefit ?? null,
        data.context     ?? null,
        JSON.stringify(data.platforms),
        JSON.stringify(data.formats),
        req.params.id,
      ],
    );
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ product: rows[0] });
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query(
      `UPDATE products SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id],
    );
    if (!rowCount) return res.status(404).json({ error: 'Producto no encontrado' });
    res.status(204).end();
  }),
);

module.exports = router;
