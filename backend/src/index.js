require('dotenv').config({ override: true });

const express = require('express');
const cors = require('cors');

const { pool } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const clientRoutes = require('./routes/clients');
const productRoutes = require('./routes/products');
const experimentRoutes = require('./routes/experiments');
const skillPromptRoutes = require('./routes/skillPrompts');
const uploadRoutes = require('./routes/uploads');

const app = express();

const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'down', error: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/experiments', experimentRoutes);
app.use('/api/skill-prompts', skillPromptRoutes);
app.use('/api/uploads', uploadRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[challenger-lab] API listening on 0.0.0.0:${PORT}`);
});
