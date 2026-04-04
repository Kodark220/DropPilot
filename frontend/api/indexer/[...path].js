export default function handler(req, res) {
  const path = (req.query.path || []).join('/');
  res.setHeader('Content-Type', 'application/json');

  // Route-specific stubs that match InterwovenKit's expected shapes
  if (path.startsWith('dex/v1/check_lp_tokens')) {
    const denoms = req.body?.denoms || [];
    const data = {};
    for (const d of denoms) data[d] = false;
    return res.status(200).json({ data });
  }
  if (path.startsWith('dex/v2/pools')) {
    return res.status(200).json({ pool: null });
  }
  if (path.startsWith('price/v1/lp_prices')) {
    return res.status(200).json({ prices: {} });
  }
  // Default: empty object
  res.status(200).json({});
}
