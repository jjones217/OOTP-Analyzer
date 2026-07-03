import Papa from 'papaparse';

// Requests are proxied through Vercel edge rewrites (/statsplus-api/*) to avoid CORS.
// Returns 204 when no data is available for the request.

function buildUrl(lgurl, endpoint, params = {}) {
  const qs = new URLSearchParams({ lgurl, endpoint, ...params }).toString();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/api/proxy?${qs}`;
}

function isHtml(res) {
  return (res.headers.get('content-type') ?? '').includes('text/html');
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (isHtml(res)) throw new Error('Received HTML instead of JSON — proxy may not be routing correctly');
  return res.json();
}

async function fetchCsv(url) {
  const res = await fetch(url);
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (isHtml(res)) throw new Error('Received HTML instead of CSV — proxy may not be routing correctly');
  const text = await res.text();
  const { data, errors } = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (errors.length) console.warn('CSV parse warnings', errors);
  return data;
}

// Validate that a league URL slug points to a real StatsPlus league
export async function validateLeague(lgurl) {
  try {
    const url = buildUrl(lgurl, 'date');
    const res = await fetch(url);
    if (res.status === 204) return { valid: true, currentDate: null };
    if (!res.ok) {
      if (res.status === 429) return { valid: false, currentDate: null, error: 'Rate limited by StatsPlus — wait 30 seconds and try again.' };
      if (res.status === 404) return { valid: false, currentDate: null, error: `League "${lgurl}" not found — check the slug.` };
      let detail = `HTTP ${res.status}`;
      try { const body = await res.json(); detail = body.error ?? detail; } catch {}
      return { valid: false, currentDate: null, error: detail };
    }
    if (isHtml(res)) {
      return { valid: false, currentDate: null, error: 'Proxy is returning the app page instead of StatsPlus data — Vercel rewrite may not be active yet. Try again in 30 seconds.' };
    }
    const data = await res.json();
    return { valid: true, currentDate: data?.current_date ?? null };
  } catch (err) {
    return { valid: false, currentDate: null, error: err.message };
  }
}

// Current game date: { current_date: "YYYY-MM-DD" }
export async function fetchDate(lgurl) {
  return fetchJson(buildUrl(lgurl, 'date'));
}

// Export status for last 10 sim dates
// Returns { current_date, "YYYY-MM-DD": [teamId, ...], ... }
export async function fetchExports(lgurl) {
  return fetchJson(buildUrl(lgurl, 'exports'));
}

// League structure + standings
export async function fetchLgdata(lgurl) {
  return fetchJson(buildUrl(lgurl, 'lgdata'));
}

// Team ID → name mapping (CSV)
export async function fetchTeams(lgurl) {
  return fetchCsv(buildUrl(lgurl, 'teams'));
}

// Team batting stats (overall + L/R splits), split_id: 1=overall 2=vsL 3=vsR
export async function fetchTeamBatStats(lgurl) {
  return fetchCsv(buildUrl(lgurl, 'teambatstats'));
}

// Team pitching stats (overall + L/R splits)
export async function fetchTeamPitchStats(lgurl) {
  return fetchCsv(buildUrl(lgurl, 'teampitchstats'));
}

// Player batting stats — pass { pid, year, lid, split } as needed
export async function fetchPlayerBatStats(lgurl, params = {}) {
  return fetchCsv(buildUrl(lgurl, 'playerbatstatsv2', params));
}

// Player pitching stats
export async function fetchPlayerPitchStats(lgurl, params = {}) {
  return fetchCsv(buildUrl(lgurl, 'playerpitchstatsv2', params));
}

// Player fielding stats
export async function fetchPlayerFieldStats(lgurl, params = {}) {
  return fetchCsv(buildUrl(lgurl, 'playerfieldstatsv2', params));
}

// Trade block — requires token
export async function fetchTradeBlock(lgurl, token) {
  return fetchJson(buildUrl(lgurl, 'tradeblock', { token }));
}

// Aggregate everything needed for a single league card
// myTeamId: numeric team ID (string or number OK)
// token: optional, for /tradeblock
export async function fetchLeagueSummary(lgurl, myTeamId, token) {
  const [exportsData, lgdata, teams] = await Promise.all([
    fetchExports(lgurl).catch(() => null),
    fetchLgdata(lgurl).catch(() => null),
    fetchTeams(lgurl).catch(() => null),
  ]);

  // Determine sim status
  const currentDate = exportsData?.current_date ?? null;
  let pendingExport = false;
  if (currentDate && exportsData?.[currentDate] && myTeamId) {
    const exportedTeams = exportsData[currentDate].map(String);
    pendingExport = !exportedTeams.includes(String(myTeamId));
  }

  // Find my team's standing
  const myStanding = lgdata?.standings?.find(
    (s) => String(s.team_id) === String(myTeamId)
  ) ?? null;

  // Build team name map
  const teamNameMap = {};
  if (teams) {
    for (const row of teams) {
      teamNameMap[row['ID']] = { name: row['Name'], nickname: row['Nickname'] };
    }
  }

  // Get my team's name
  const myTeamInfo = teamNameMap[String(myTeamId)] ?? null;

  return {
    currentDate,
    pendingExport,
    myTeamInfo,
    myStanding,
    lgdata,
    teamNameMap,
  };
}

// Fetch team batting stats for a specific team (overall split only)
export async function fetchMyTeamBatStats(lgurl, myTeamId) {
  const rows = await fetchTeamBatStats(lgurl).catch(() => null);
  if (!rows) return null;
  return rows.filter(
    (r) => String(r.team_id ?? r['team_id']) === String(myTeamId) && String(r.split_id) === '1'
  );
}

export async function fetchMyTeamPitchStats(lgurl, myTeamId) {
  const rows = await fetchTeamPitchStats(lgurl).catch(() => null);
  if (!rows) return null;
  return rows.filter(
    (r) => String(r.team_id ?? r['team_id']) === String(myTeamId) && String(r.split_id) === '1'
  );
}
