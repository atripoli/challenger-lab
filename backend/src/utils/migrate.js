#!/usr/bin/env node
require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'migrations');

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function appliedSet() {
  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

async function run() {
  await ensureTable();
  const applied = await appliedSet();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[migrate] skip  ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`[migrate] apply ${file}`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[migrate] ok    ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[migrate] fail  ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
