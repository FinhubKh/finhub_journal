import { handleCorsPreflight, applyCors } from '../_cors.js';
import { handleSaveInvestorCredentials, getInvestorCredentialsDepsFromEnv } from '../../backend/api/investor-credentials-handler.mjs';

export const config = {
  maxDuration: 15,
};

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const deps = getInvestorCredentialsDepsFromEnv(process.env);
  if (!deps.supabaseUrl || !deps.anonKey || !deps.serviceKey || !deps.encryptionKey) {
    res.status(500).json({ error: 'Investor credentials service is not configured' });
    return;
  }

  try {
    const result = await handleSaveInvestorCredentials(req, deps);
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to save investor credentials' });
  }
}
