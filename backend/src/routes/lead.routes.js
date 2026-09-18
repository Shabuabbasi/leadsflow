import express from 'express';
import mongoose from 'mongoose';
import { requireApiSecretOrJwt, requireJwt } from '../middleware/auth.js';
import Lead from '../models/Lead.js';
import { getIO } from '../socket.js';
import { calculateLeadScore } from '../utils/calculateLeadScore.js';

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];

function requiredString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

router.post('/', requireApiSecretOrJwt, async (req, res, next) => {
  const { name, email, phone, service, budgetRange, message } = req.body ?? {};

  if (
    !requiredString(name) ||
    !requiredString(email) ||
    !requiredString(phone) ||
    !requiredString(service) ||
    !requiredString(budgetRange) ||
    !requiredString(message)
  ) {
    return res.status(400).json({
      error: 'name, email, phone, service, budgetRange, and message are required',
    });
  }

  if (!EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    const input = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      service: service.trim(),
      budgetRange: budgetRange.trim(),
      message: message.trim(),
      source: req.authType === 'wordpress' ? 'wordpress' : 'manual',
    };

    const duplicate = await Lead.exists({ email: input.email });
    if (duplicate) {
      return res.status(409).json({ error: 'A lead with this email already exists' });
    }

    const lead = await Lead.create({
      ...input,
      leadScore: calculateLeadScore(input),
    });

    // Emit real-time event to all connected dashboards
    const io = getIO();
    if (io) io.emit('lead:created', lead);

    res.status(201).json({ lead });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'A lead with this email already exists' });
    }
    next(error);
  }
});

router.get('/', requireJwt, async (req, res, next) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const status = typeof req.query.status === 'string' ? req.query.status : 'all';
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
  const minScore = Number.parseInt(req.query.minScore, 10);
  const maxScore = Number.parseInt(req.query.maxScore, 10);

  if (status !== 'all' && !STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status filter' });
  }

  const filter = {};
  if (status !== 'all') filter.status = status;
  if (Number.isFinite(minScore) || Number.isFinite(maxScore)) {
    filter.leadScore = {};
    if (Number.isFinite(minScore)) filter.leadScore.$gte = Math.max(0, minScore);
    if (Number.isFinite(maxScore)) filter.leadScore.$lte = Math.min(100, maxScore);
  }
  if (q.trim()) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const search = new RegExp(escaped, 'i');
    filter.$or = [
      { name: search },
      { email: search },
      { phone: search },
      { service: search },
      { message: search },
    ];
  }

  try {
    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Lead.countDocuments(filter),
    ]);
    res.json({
      leads,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/export.csv', requireJwt, async (_req, res, next) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 });
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = [
      'Name',
      'Email',
      'Phone',
      'Service',
      'Budget',
      'Score',
      'Status',
      'Source',
      'Created At',
    ];
    const rows = leads.map((lead) => [
      lead.name,
      lead.email,
      lead.phone,
      lead.service,
      lead.budgetRange,
      lead.leadScore,
      lead.status,
      lead.source,
      lead.createdAt.toISOString(),
    ]);
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leadflow-leads.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireJwt, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid lead id' });
  }

  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json({ lead });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireJwt, async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body ?? {};

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid lead id' });
  }

  if (!STATUSES.includes(status)) {
    return res.status(400).json({
      error: 'status must be new, contacted, qualified, won, or lost',
    });
  }

  try {
    const lead = await Lead.findByIdAndUpdate(id, { status }, { new: true });
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json({ lead });
  } catch (error) {
    next(error);
  }
});

export default router;
