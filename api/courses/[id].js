import { readFileSync } from 'fs';
import { join } from 'path';
import { loadDynamicCourses, deleteCourse } from '../_lib/github-storage.js';

const BUNDLED_FILE = join(process.cwd(), 'storage', 'courses.json');

async function loadCourses() {
  let courses = {};
  try { courses = JSON.parse(readFileSync(BUNDLED_FILE, 'utf-8')); } catch {}
  Object.assign(courses, await loadDynamicCourses());
  return courses;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  if (req.method === 'DELETE') {
    await deleteCourse(id);
    return res.json({ ok: true });
  }

  const all = await loadCourses();
  const course = all[id];
  if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

  res.setHeader('Content-Type', 'application/json');
  res.json(course);
}
