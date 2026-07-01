import { readFileSync } from 'fs';
import { join } from 'path';
import { loadDynamicCourses, saveCourse } from '../../_lib/github-storage.js';

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const all = await loadCourses();
  const course = all[id];
  if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

  const jobId = `audio_${id}`;

  // Trigger async audio generation (best-effort — Vercel may timeout for long courses)
  generateAudioAsync(course).catch(err => console.error('[audio async]', err));

  res.json({ jobId });
}

async function generateAudioAsync(course) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  const { generateAudio } = await import('../../audio.js');

  const enriched = await generateAudio(course.scenes, course.id);

  course.scenes = enriched;
  course.status = 'ready';

  await saveCourse(course);
}
