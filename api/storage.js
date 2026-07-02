import { loadAudioFile } from './_lib/github-storage.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { course, file } = req.query;
  if (!course || !file) {
    return res.status(400).json({ error: 'Faltan parámetros course/file' });
  }

  const buffer = await loadAudioFile(course, file);
  if (!buffer) return res.status(404).json({ error: 'Audio no encontrado' });

  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
}
