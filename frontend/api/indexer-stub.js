export default function handler(req, res) {
  const url = req.url || '';
  res.setHeader('Content-Type', 'application/json');

  if (url.includes('check_lp_tokens')) {
    const denoms = req.body?.denoms || [];
    const data = {};
    for (const d of denoms) data[d] = false;
    return res.status(200).json({ data });
  }
  if (url.includes('lp_prices')) {
    return res.status(200).json({ prices: {} });
  }
  if (url.includes('/pools/')) {
    return res.status(200).json({ pool: null });
  }
  if (url.includes('/txs/')) {
    return res.status(200).json({ txs: [] });
  }
  if (url.includes('/positions/')) {
    return res.status(200).json({ positions: [] });
  }
  if (url.includes('/tokens/')) {
    return res.status(200).json({ tokens: [] });
  }
  if (url.includes('/collections/')) {
    return res.status(200).json({ collections: [] });
  }
  // Default empty object
  res.status(200).json({});
}
