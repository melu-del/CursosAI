import { loadAudioFile } from '../_lib/github-storage.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const parts = req.query.path || [];
  // Expected shape: [courseId, "audio", filename]
  const [courseId, kind, filename] = parts;
  if (kind !== 'audio' || !filename) {
    return res.status(404).json({ error: 'Recurso no encontrado' });
  }

  const buffer = await loadAudioFile(courseId, filename);
  if (!buffer) return res.status(404).json({ error: 'Audio no encontrado' });

  res.setHeader('Content-Type', 'audio/wav');
  res.send(buffer);
}
