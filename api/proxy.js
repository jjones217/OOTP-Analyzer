// Vercel serverless function — proxies StatsPlus API requests server-side to avoid CORS.
// api/package.json sets "type": "commonjs" so this file uses require/module.exports
// regardless of the root package.json having "type": "module".

const ALLOWED = new Set([
  'date', 'exports', 'lgdata', 'teams', 'players',
  'teambatstats', 'teampitchstats',
  'playerbatstatsv2', 'playerpitchstatsv2', 'playerfieldstatsv2',
  'tradeblock', 'ballparks', 'contract', 'contractextension',
  'gamehistory', 'draftv2', 'ratings',
]);

module.exports = async function handler(req, res) {
  const { lgurl, endpoint, ...rest } = req.query;

  if (!lgurl || !endpoint) {
    return res.status(400).json({ error: 'lgurl and endpoint are required' });
  }

  if (!ALLOWED.has(endpoint)) {
    return res.status(400).json({ error: `Unknown endpoint: ${endpoint}` });
  }

  const qs = new URLSearchParams(rest).toString();
  const url = `https://statsplus.net/${lgurl}/api/${endpoint}${qs ? `?${qs}` : ''}`;

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'OOTP-Dashboard/1.0' },
    });

    if (upstream.status === 204) {
      return res.status(204).end();
    }

    const contentType = upstream.headers.get('content-type') ?? 'text/plain';
    const body = await upstream.text();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(upstream.status).send(body);
  } catch (err) {
    console.error('[proxy] fetch error:', err.message, 'url:', url);
    return res.status(502).json({ error: `Proxy fetch failed: ${err.message}` });
  }
};
