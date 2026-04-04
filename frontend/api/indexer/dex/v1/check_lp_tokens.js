export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  // InterwovenKit expects { data: { [denom]: boolean } }
  const denoms = req.body?.denoms || [];
  const data = {};
  for (const d of denoms) data[d] = false;
  res.status(200).json({ data });
}
