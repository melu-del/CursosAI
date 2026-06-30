import { readFileSync } from 'fs';
import { join } from 'path';

function loadCourses() {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'storage', 'courses.json'), 'utf-8'));
  } catch {
    return {};
  }
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const all = loadCourses();
  const list = Object.values(all)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      status: c.status,
      sceneCount: c.scenes?.length || 0,
      audioReady: c.scenes?.every(s => s.audioUrl) || false,
      createdAt: c.createdAt,
      source: c.source || 'file',
    }));

  res.setHeader('Content-Type', 'application/json');
  res.json(list);
}
