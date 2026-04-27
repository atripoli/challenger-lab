require('dotenv').config({ override: true });

const express = require('express');
const cors = require('cors');

const { pool } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const clientRoutes = require('./routes/clients');
const productRoutes = require('./routes/products');
const productHistoryRoutes = require('./routes/productHistory');
const experimentResultsRoutes = require('./routes/experimentResults');
const experimentRoutes = require('./routes/experiments');
const skillPromptRoutes = require('./routes/skillPrompts');
const uploadRoutes = require('./routes/uploads');
const statsRoutes = require('./routes/stats');

const app = express();

const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', async (_req, res) => {
  const dbHostHint = (process.env.DATABASE_URL || '').match(/@([^:/?]+)/)?.[1] || null;
  try {
    const { rows } = await pool.query('SELECT current_database() AS db, version() AS version');
    res.json({ status: 'ok', db: 'up', database: rows[0].db, db_host: dbHostHint });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      db: 'down',
      db_host: dbHostHint,
      error: err.message || String(err) || 'unknown',
      code: err.code,
      errno: err.errno,
      syscall: err.syscall,
      hostname: err.hostname,
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/products/:productId/history', productHistoryRoutes);
app.use('/api/experiments/:experimentId/results', experimentResultsRoutes);
app.use('/api/experiments', experimentRoutes);
app.use('/api/skill-prompts', skillPromptRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/stats', statsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[challenger-lab] API listening on 0.0.0.0:${PORT}`);
});
