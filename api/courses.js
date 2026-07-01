import { readFileSync } from 'fs';
import { join } from 'path';
import { generateScript } from './generate.js';
import { loadDynamicCourses, saveCourse } from './_lib/github-storage.js';

export const config = { api: { bodyParser: false } };

const BUNDLED_FILE = join(process.cwd(), 'storage', 'courses.json');

async function loadCourses() {
  let courses = {};
  try { courses = JSON.parse(readFileSync(BUNDLED_FILE, 'utf-8')); } catch {}
  Object.assign(courses, await loadDynamicCourses());
  return courses;
}

function smartTruncate(text, max = 40000) {
  if (text.length <= max) return text;
  const front = Math.floor(max * 0.7);
  return text.slice(0, front) + '\n...[contenido omitido]...\n' + text.slice(-(max - front));
}

async function readRawBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function parseRequest(req) {
  const ct = req.headers['content-type'] || '';

  if (ct.includes('multipart/form-data')) {
    const { default: formidable } = await import('formidable');
    const form = formidable({ maxFileSize: 50 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);
    return {
      text: fields.text?.[0] || null,
      file: files.file?.[0] || null,
      numVideos: parseInt(fields.numVideos?.[0]) || 1,
      videoType: fields.videoType?.[0] || 'explicativo',
      tone: fields.tone?.[0] || 'informal',
      dialect: fields.dialect?.[0] || 'rioplatense',
      duration: fields.duration?.[0] || 'medio',
      boardStyle: fields.boardStyle?.[0] || 'classic',
      source: files.file?.[0] ? 'file' : 'prompt',
    };
  }

  const raw = await readRawBody(req);
  const body = JSON.parse(raw.toString() || '{}');
  return {
    text: body.text || null,
    file: null,
    numVideos: parseInt(body.numVideos) || 1,
    videoType: body.videoType || 'explicativo',
    tone: body.tone || 'informal',
    dialect: body.dialect || 'rioplatense',
    duration: body.duration || 'medio',
    boardStyle: body.boardStyle || 'classic',
    source: 'prompt',
  };
}

async function extractTextFromFile(file) {
  const ext = (file.originalFilename || file.newFilename || '').split('.').pop()?.toLowerCase();
  if (ext === 'pdf') {
    const { default: pdfParse } = await import('pdf-parse');
    const buf = readFileSync(file.filepath);
    const result = await pdfParse(buf);
    return result.text;
  } else if (ext === 'docx' || ext === 'doc') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: file.filepath });
    return result.value;
  }
  return readFileSync(file.filepath, 'utf-8');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const all = await loadCourses();
    const list = Object.values(all)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(c => ({
        id: c.id, title: c.title, description: c.description,
        status: c.status, sceneCount: c.scenes?.length || 0,
        audioReady: c.scenes?.every(s => s.audioUrl) || false,
        createdAt: c.createdAt, source: c.source || 'file',
      }));
    return res.json(list);
  }

  if (req.method === 'POST') {
    try {
      const parsed = await parseRequest(req);
      let { text, file, numVideos, videoType, tone, dialect, duration, boardStyle, source } = parsed;

      if (file) {
        text = await extractTextFromFile(file);
      }
      if (!text) {
        return res.status(400).json({ error: 'Se requiere un archivo o texto' });
      }

      text = smartTruncate(text);
      const count = Math.min(Math.max(numVideos, 1), 5);
      const videos = await generateScript(text, count, videoType, tone, dialect, duration);

      const courses = [];
      for (let idx = 0; idx < videos.length; idx++) {
        const v = videos[idx];
        const id = `course_${Date.now()}_${idx}`;
        const course = {
          id, title: v.topic || `Video ${idx + 1}`,
          description: v.scenes.map(s => s.title).join(' · '),
          status: 'content_ready', source, boardStyle,
          scorm: false, scenes: v.scenes,
          createdAt: new Date(Date.now() + idx).toISOString(),
        };
        await saveCourse(course);
        courses.push(course);
      }

      return res.json({ courses });
    } catch (err) {
      console.error('[POST /api/courses]', err);
      return res.status(500).json({ error: err.message || 'Error al generar el guión' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
