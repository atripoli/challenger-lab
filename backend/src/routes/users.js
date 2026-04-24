const express = require('express');
const { pool } = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// GET /api/users  — solo admin
router.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.is_active, u.last_login_at, r.name AS role, u.created_at
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.deleted_at IS NULL
       ORDER BY u.created_at DESC`,
    );
    res.json({ users: rows });
  }),
);

module.exports = router;
