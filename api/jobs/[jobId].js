export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  // Vercel can't maintain in-memory job state between invocations.
  // Audio generation is fire-and-forget; return done so the frontend proceeds.
  res.json({ status: 'done' });
}
