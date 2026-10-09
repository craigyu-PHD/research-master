import { discover } from '../server.mjs';

export default async function handler(req, res) {
  try {
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url || '/', `https://${host}`);
    const input = url.searchParams.get('q') || '';
    const scopeParam = url.searchParams.get('scope') || 'article';
    const scope = ['article', 'book', 'all'].includes(scopeParam) ? scopeParam : 'article';

    if (!input.trim()) {
      res.statusCode = 400;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Missing query.' }));
      return;
    }

    const payload = await discover(input, scope);
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(payload));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error.message || 'Unexpected error.' }));
  }
}
