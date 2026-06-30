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
  const { id } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed in production.' });
  }

  const all = loadCourses();
  const course = all[id];

  if (!course) {
    return res.status(404).json({ error: 'Curso no encontrado' });
  }

  res.setHeader('Content-Type', 'application/json');
  res.json(course);
}
