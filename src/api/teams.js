import { SUPABASE_URL, SUPABASE_ANON_KEY, authHeaders, getToken, authFetch } from './auth';

/**
 * Fetch ranked team leaderboard (anon-safe).
 * @param {{ limit?: number, minTrades?: number }} [opts]
 */
export async function fetchTeamsLeaderboard(opts = {}) {
  const limit = Number.isFinite(opts.limit) ? opts.limit : 50;
  const minTrades = Number.isFinite(opts.minTrades) ? opts.minTrades : 0;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_teams_leaderboard`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ p_limit: limit, p_min_trades: minTrades }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const entries = Array.isArray(data?.entries) ? data.entries : [];

  return {
    entries: entries.map((e, i) => ({
      rank: e.rank_pnl ?? i + 1,
      teamId: e.team_id,
      teamName: e.team_name,
      teamTag: e.team_tag,
      description: e.description,
      color: e.color || '#7c3aed',
      inviteCode: e.invite_code,
      createdAt: e.created_at,
      leaderName: e.leader_name || 'Leader',
      memberCount: Number(e.member_count) || 0,
      tradeCount: Number(e.trade_count) || 0,
      wins: Number(e.wins) || 0,
      losses: Number(e.losses) || 0,
      totalPnl: Number(e.total_pnl) || 0,
      winRate: Number(e.win_rate) || 0,
    })),
    limit: data?.limit ?? limit,
  };
}

/**
 * Fetch team details and its member rankings.
 * @param {string} teamId
 */
export async function fetchTeamDetails(teamId) {
  if (!teamId) return null;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_team_details`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ p_team_id: teamId }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  if (!data || !data.team) return null;

  const members = Array.isArray(data.members) ? data.members : [];
  return {
    team: {
      id: data.team.id,
      name: data.team.name,
      tag: data.team.tag,
      description: data.team.description,
      color: data.team.color || '#7c3aed',
      inviteCode: data.team.invite_code,
      createdAt: data.team.created_at,
      createdBy: data.team.created_by,
    },
    members: members.map((m, i) => ({
      rank: m.rank_pnl ?? i + 1,
      memberId: m.member_id,
      userId: m.user_id,
      role: m.role,
      joinedAt: m.joined_at,
      displayName: m.display_name || 'Trader',
      accountId: m.account_id,
      accountName: m.account_name,
      shareToken: m.share_token,
      accountType: m.account_type,
      tradeCount: Number(m.trade_count) || 0,
      wins: Number(m.wins) || 0,
      losses: Number(m.losses) || 0,
      totalPnl: Number(m.total_pnl) || 0,
      winRate: Number(m.win_rate) || 0,
      profitFactor: m.profit_factor == null ? null : Number(m.profit_factor),
    })),
  };
}

/**
 * Fetch current user's team membership.
 */
export async function fetchMyTeam() {
  const token = getToken();
  if (!token) return null;

  const res = await authFetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_team`, {
    method: 'POST',
    headers: { ...authHeaders(token) },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data) return null;

  return {
    memberId: data.member_id,
    teamId: data.team_id,
    role: data.role,
    accountId: data.account_id,
    joinedAt: data.joined_at,
    teamName: data.team_name,
    teamTag: data.team_tag,
    teamColor: data.team_color || '#7c3aed',
    inviteCode: data.invite_code,
  };
}

/**
 * Create a new team.
 */
export async function createTeam({ name, tag, description = '', color = '#7c3aed', accountId = null }) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/rpc/create_team`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify({
      p_name: name,
      p_tag: tag,
      p_description: description,
      p_color: color,
      p_account_id: accountId || null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || await res.text());
  }
  return res.json();
}

/**
 * Join an existing team.
 */
export async function joinTeam({ teamId = null, inviteCode = null, accountId = null }) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/rpc/join_team`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify({
      p_team_id: teamId || null,
      p_invite_code: inviteCode || null,
      p_account_id: accountId || null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || await res.text());
  }
  return res.json();
}

/**
 * Leave current team.
 */
export async function leaveTeam() {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/rpc/leave_team`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || await res.text());
  }
  return res.json();
}

/**
 * Update member's active trading account in team.
 */
export async function updateTeamAccount(accountId) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/rpc/update_team_member_account`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()) },
    body: JSON.stringify({ p_account_id: accountId || null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || await res.text());
  }
  return res.json();
}
