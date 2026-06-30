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

  const { id } = req.query;
  const all = loadCourses();
  const course = all[id];

  if (!course) {
    return res.status(404).json({ error: 'Curso no encontrado' });
  }

  res.setHeader('Content-Type', 'application/json');
  res.json(course);
}
