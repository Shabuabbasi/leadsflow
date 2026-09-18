import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import analyticsRoutes from './routes/analytics.routes.js';
import authRoutes from './routes/auth.routes.js';
import leadRoutes from './routes/lead.routes.js';

const app = express();
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: [
      clientUrl,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4200',
      'http://127.0.0.1:4200',
    ],
  })
);
app.use(helmet());
app.use(express.json());
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  })
);

app.get('/health', (_req, res) => {
  const database = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(database === 'connected' ? 200 : 503).json({
    ok: database === 'connected',
    service: 'leadflow-api',
    database,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
