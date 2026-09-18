import express from 'express';
import { requireJwt } from '../middleware/auth.js';
import Lead from '../models/Lead.js';

const router = express.Router();
const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];

router.get('/insights', requireJwt, async (_req, res, next) => {
  try {
    const [total, groupedStatuses, topLeads] = await Promise.all([
      Lead.countDocuments(),
      Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Lead.find()
        .sort({ leadScore: -1, createdAt: -1 })
        .limit(5)
        .select('name email status leadScore source createdAt'),
    ]);

    const countsByStatus = Object.fromEntries(STATUSES.map((status) => [status, 0]));
    for (const item of groupedStatuses) {
      countsByStatus[item._id] = item.count;
    }

    res.json({ total, countsByStatus, topLeads });
  } catch (error) {
    next(error);
  }
});

export default router;
