// Vercel serverless function — proxies StatsPlus API requests server-side to avoid CORS.
// Usage: /api/proxy?lgurl=gbl&endpoint=date[&param1=val1...]

export default async function handler(req, res) {
  const { lgurl, endpoint, ...rest } = req.query;

  if (!lgurl || !endpoint) {
    return res.status(400).json({ error: 'lgurl and endpoint are required' });
  }

  // Only allow known StatsPlus endpoints
  const ALLOWED = new Set([
    'date', 'exports', 'lgdata', 'teams', 'players',
    'teambatstats', 'teampitchstats',
    'playerbatstatsv2', 'playerpitchstatsv2', 'playerfieldstatsv2',
    'tradeblock', 'ballparks', 'contract', 'contractextension',
    'gamehistory', 'draftv2', 'ratings',
  ]);

  if (!ALLOWED.has(endpoint)) {
    return res.status(400).json({ error: `Unknown endpoint: ${endpoint}` });
  }

  const qs = new URLSearchParams(rest).toString();
  const url = `https://statsplus.net/${lgurl}/api/${endpoint}${qs ? `?${qs}` : ''}`;

  try {
    const upstream = await fetch(url);

    if (upstream.status === 204) {
      return res.status(204).end();
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `StatsPlus returned ${upstream.status} for ${url}` });
    }

    const contentType = upstream.headers.get('content-type') ?? '';
    const body = await upstream.text();

    res.setHeader('Content-Type', contentType || 'text/plain');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).send(body);
  } catch (err) {
    return res.status(502).json({ error: `${err.message} (fetching ${url})` });
  }
}
