#!/usr/bin/env node
/**
 * Crea el primer usuario admin. Lee credenciales desde argv o env:
 *   node src/utils/createAdmin.js <email> <full_name> <password>
 * Si el email ya existe, actualiza rol a admin y resetea la contraseña.
 */
require('dotenv').config({ override: true });
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

async function main() {
  const [, , emailArg, nameArg, passwordArg] = process.argv;
  const email    = emailArg    || process.env.ADMIN_EMAIL;
  const fullName = nameArg     || process.env.ADMIN_NAME;
  const password = passwordArg || process.env.ADMIN_PASSWORD;

  if (!email || !fullName || !password) {
    console.error('Uso: node src/utils/createAdmin.js <email> "<Full Name>" <password>');
    process.exit(1);
  }

  const { rows: roleRows } = await pool.query(`SELECT id FROM roles WHERE name = 'admin'`);
  if (!roleRows.length) throw new Error('Rol "admin" no existe — correr migraciones primero');
  const adminRoleId = roleRows[0].id;

  const hash = await bcrypt.hash(password, 12);

  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role_id, is_active)
     VALUES ($1, $2, $3, $4, TRUE)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           full_name     = EXCLUDED.full_name,
           role_id       = EXCLUDED.role_id,
           is_active     = TRUE,
           updated_at    = NOW()
     RETURNING id, email, full_name`,
    [email, hash, fullName, adminRoleId],
  );

  console.log(`[createAdmin] ok · id=${rows[0].id} · ${rows[0].email}`);
  await pool.end();
}

main().catch((err) => {
  console.error('[createAdmin] fail:', err.message);
  process.exit(1);
});
