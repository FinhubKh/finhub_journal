import { SUPABASE_URL, authFetch, authHeaders, getToken } from './auth';
import { mergeSiacConfig } from '../lib/riskEligibility';

export async function fetchSiacRuleConfig() {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/rpc/get_siac_rule_config`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return mergeSiacConfig(text ? JSON.parse(text) : null);
}

export async function adminUpdateSiacRuleConfig(config) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/rpc/admin_update_siac_rule_config`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_config: config }),
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return mergeSiacConfig(text ? JSON.parse(text) : null);
}
