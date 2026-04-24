const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn('[db] DATABASE_URL no configurada');
}

// Railway internal hostnames (`*.railway.internal`) son VPN privadas sin TLS.
// Solo forzamos SSL para URLs públicas o de cloud providers.
const isInternalRailway = /\.railway\.internal\b/.test(connectionString || '');
const isPublicCloud = /proxy\.rlwy\.net|render\.com|supabase\.co|neon\.tech|amazonaws/.test(connectionString || '');
const needsSSL = !isInternalRailway && (isPublicCloud || (process.env.NODE_ENV === 'production' && !isInternalRailway));

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
