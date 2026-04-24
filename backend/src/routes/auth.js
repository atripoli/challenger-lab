const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const { pool } = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2),
  role: z.enum(['admin', 'analyst', 'viewer']).default('analyst'),
});

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, full_name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
}

// POST /api/auth/register  — crea usuario (bootstrap; luego restringir a admins)
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);

    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (existing.length) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    const { rows: roleRows } = await pool.query('SELECT id FROM roles WHERE name = $1', [data.role]);
    if (!roleRows.length) return res.status(400).json({ error: 'Rol inválido' });

    const hash = await bcrypt.hash(data.password, 12);

    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name`,
      [data.email, hash, data.full_name, roleRows[0].id],
    );

    const user = { ...rows[0], role: data.role };
    const token = signToken(user);
    res.status(201).json({ user, token });
  }),
);

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.password_hash, u.is_active, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.email = $1 AND u.deleted_at IS NULL`,
      [email],
    );
    const user = rows[0];
    if (!user || !user.is_active) return res.status(401).json({ error: 'Credenciales inválidas' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = signToken(user);
    delete user.password_hash;
    res.json({ user, token });
  }),
);

// GET /api/auth/me
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.is_active, r.name AS role, u.last_login_at
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [req.user.sub],
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ user: rows[0] });
  }),
);

module.exports = router;
