const express = require('express');
const bcrypt = require('bcrypt');
const { z } = require('zod');

const { pool } = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

const ROLE_NAMES = ['admin', 'analyst', 'viewer'];

const createSchema = z.object({
  email:     z.string().email(),
  password:  z.string().min(8),
  full_name: z.string().min(2).max(255),
  role:      z.enum(ROLE_NAMES),
  is_active: z.boolean().optional(),
});

const updateSchema = z.object({
  email:     z.string().email().optional(),
  full_name: z.string().min(2).max(255).optional(),
  role:      z.enum(ROLE_NAMES).optional(),
  is_active: z.boolean().optional(),
  password:  z.string().min(8).optional(),
});

async function findRoleId(name) {
  const { rows } = await pool.query('SELECT id FROM roles WHERE name = $1', [name]);
  return rows[0]?.id ?? null;
}

router.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.is_active, u.last_login_at, r.name AS role, u.created_at, u.updated_at
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.deleted_at IS NULL
       ORDER BY u.created_at DESC`,
    );
    res.json({ users: rows });
  }),
);

router.get(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.is_active, u.last_login_at, r.name AS role, u.created_at, u.updated_at
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ user: rows[0] });
  }),
);

router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);

    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (existing.length) return res.status(409).json({ error: 'El email ya está registrado' });

    const roleId = await findRoleId(data.role);
    if (!roleId) return res.status(400).json({ error: 'Rol inválido' });

    const hash = await bcrypt.hash(data.password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role_id, is_active)
       VALUES ($1, $2, $3, $4, COALESCE($5, TRUE))
       RETURNING id, email, full_name, is_active`,
      [data.email, hash, data.full_name, roleId, data.is_active ?? null],
    );
    res.status(201).json({ user: { ...rows[0], role: data.role } });
  }),
);

router.put(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const targetId = Number(req.params.id);

    // Construir SET dinámico
    const sets = [];
    const values = [];

    if (data.email != null) {
      values.push(data.email);
      sets.push(`email = $${values.length}`);
    }
    if (data.full_name != null) {
      values.push(data.full_name);
      sets.push(`full_name = $${values.length}`);
    }
    if (data.role != null) {
      const roleId = await findRoleId(data.role);
      if (!roleId) return res.status(400).json({ error: 'Rol inválido' });
      // No permitir que el último admin se quede sin rol admin (shoot-yourself-in-foot guard)
      if (data.role !== 'admin') {
        const { rows: admins } = await pool.query(
          `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
           WHERE r.name = 'admin' AND u.is_active AND u.deleted_at IS NULL`,
        );
        if (admins.length <= 1 && admins[0]?.id === targetId) {
          return res.status(400).json({ error: 'No se puede quitar el rol admin al último administrador activo' });
        }
      }
      values.push(roleId);
      sets.push(`role_id = $${values.length}`);
    }
    if (data.is_active != null) {
      values.push(data.is_active);
      sets.push(`is_active = $${values.length}`);
    }
    if (data.password != null) {
      const hash = await bcrypt.hash(data.password, 12);
      values.push(hash);
      sets.push(`password_hash = $${values.length}`);
    }

    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });

    values.push(targetId);
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length} AND deleted_at IS NULL
       RETURNING id, email, full_name, is_active`,
      values,
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { rows: full } = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.is_active, r.name AS role, u.updated_at
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [targetId],
    );
    res.json({ user: full[0] });
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const targetId = Number(req.params.id);
    if (targetId === req.user.sub) {
      return res.status(400).json({ error: 'No podés eliminar tu propio usuario' });
    }
    // Guard: no eliminar el último admin activo
    const { rows: target } = await pool.query(
      `SELECT u.id, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [targetId],
    );
    if (!target.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (target[0].role === 'admin') {
      const { rows: admins } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.name = 'admin' AND u.is_active AND u.deleted_at IS NULL`,
      );
      if (admins[0].n <= 1) {
        return res.status(400).json({ error: 'No se puede eliminar el último administrador activo' });
      }
    }

    await pool.query(
      `UPDATE users SET deleted_at = NOW(), is_active = FALSE WHERE id = $1`,
      [targetId],
    );
    res.status(204).end();
  }),
);

module.exports = router;
