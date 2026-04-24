const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn('[db] DATABASE_URL no configurada');
}

const needsSSL = process.env.NODE_ENV === 'production' || /railway|render|supabase|neon/.test(connectionString || '');

const pool = new Pool({
  connectionString,
  ssl: needsSSL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => {
  console.error('[db] unexpected pool error', err);
});

module.exports = { pool };
