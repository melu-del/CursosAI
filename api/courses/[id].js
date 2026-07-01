import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BUNDLED_FILE = join(process.cwd(), 'storage', 'courses.json');
const TMP_FILE = '/tmp/courses.json';

function loadCourses() {
  let courses = {};
  try { courses = JSON.parse(readFileSync(BUNDLED_FILE, 'utf-8')); } catch {}
  try {
    const tmp = JSON.parse(readFileSync(TMP_FILE, 'utf-8'));
    Object.assign(courses, tmp);
  } catch {}
  return courses;
}

function deleteTmpCourse(id) {
  try {
    const tmp = JSON.parse(readFileSync(TMP_FILE, 'utf-8'));
    delete tmp[id];
    writeFileSync(TMP_FILE, JSON.stringify(tmp, null, 2));
  } catch {}
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  if (req.method === 'DELETE') {
    deleteTmpCourse(id);
    return res.json({ ok: true });
  }

  const all = loadCourses();
  const course = all[id];
  if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

  res.setHeader('Content-Type', 'application/json');
  res.json(course);
}
