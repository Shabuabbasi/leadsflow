import dns from 'node:dns';
import mongoose from 'mongoose';
import Lead from '../models/Lead.js';
import { calculateLeadScore } from '../utils/calculateLeadScore.js';

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  if (uri.startsWith('mongodb+srv://')) {
    const servers = (process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1')
      .split(',')
      .map((server) => server.trim())
      .filter(Boolean);
    dns.setServers(servers);
  }

  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB || 'leadflow',
    serverSelectionTimeoutMS: 10000,
  });

  const unscoredLeads = await Lead.find({ leadScore: { $exists: false } });
  if (unscoredLeads.length) {
    await Promise.all(
      unscoredLeads.map((lead) => {
        lead.leadScore = calculateLeadScore(lead);
        return lead.save();
      })
    );
  }

  console.log(`MongoDB connected: ${mongoose.connection.name}`);
}

export { connectDatabase };
