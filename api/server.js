import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { generateScript } from './generate.js';
import { generateAudio } from './audio.js';
import { buildScormZip } from './scorm-generator.js';

// Render jobs in memory
const renderJobs = new Map(); // jobId → { status, progress, error, outputPath }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STORAGE = path.join(ROOT, 'storage');
const COURSES_FILE = path.join(STORAGE, 'courses.json');

fs.mkdirSync(STORAGE, { recursive: true });

// ── Persistent course store ──────────────────────────────────────────────────
function loadCourses() {
  try { return JSON.parse(fs.readFileSync(COURSES_FILE, 'utf-8')); }
  catch { return {}; }
}
function saveCourses(courses) {
  fs.writeFileSync(COURSES_FILE, JSON.stringify(courses, null, 2));
}
function getCourse(id) {
  return loadCourses()[id] || null;
}
function putCourse(course) {
  const all = loadCourses();
  all[course.id] = course;
  saveCourses(all);
}
function deleteCourse(id) {
  const all = loadCourses();
  delete all[id];
  saveCourses(all);
}

// ── Smart text truncation ────────────────────────────────────────────────────
// For large docs: takes 70% from the beginning and 30% from the end.
// This captures the intro/context and the conclusions.
function smartTruncate(text, maxChars = 40000) {
  if (text.length <= maxChars) return text;
  const front = Math.floor(maxChars * 0.7);
  const back  = maxChars - front;
  return text.slice(0, front) +
    '\n\n[...contenido extenso omitido para mantener el foco...]\n\n' +
    text.slice(-back);
}

// ── App setup ────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/storage', express.static(STORAGE));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ── Extract text from file ───────────────────────────────────────────────────
async function extractText(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.pdf') {
    const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
    const data = await pdfParse(file.buffer);
    return data.text;
  } else if (ext === '.docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.default.extractRawText({ buffer: file.buffer });
    return result.value;
  } else {
    return file.buffer.toString('utf-8');
  }
}

// ── GET /api/courses ─────────────────────────────────────────────────────────
app.get('/api/courses', (req, res) => {
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
  res.json(list);
});

// ── GET /api/courses/:id ─────────────────────────────────────────────────────
app.get('/api/courses/:id', (req, res) => {
  const course = getCourse(req.params.id);
  if (!course) return res.status(404).json({ error: 'Curso no encontrado' });
  res.json(course);
});

// ── POST /api/courses ────────────────────────────────────────────────────────
// Creates a course from a file upload or from a text prompt.
// source=file: multipart with "file" field
// source=prompt: JSON { text: "..." }
app.post('/api/courses', upload.single('file'), async (req, res) => {
  try {
    let rawText = '';
    let source = 'file';

    if (req.file) {
      rawText = await extractText(req.file);
      source = 'file';
    } else if (req.body.text) {
      rawText = req.body.text;
      source = 'prompt';
    } else {
      return res.status(400).json({ error: 'Se requiere un archivo o texto' });
    }

    const numVideos = Math.min(Math.max(parseInt(req.body.numVideos) || 1, 1), 5);
    const videoType = req.body.videoType || 'explicativo';
    const tone = req.body.tone || 'informal';
    const dialect = req.body.dialect || 'rioplatense';
    const duration = req.body.duration || 'medio';
    rawText = smartTruncate(rawText, 40000);
    const videos = await generateScript(rawText, numVideos, videoType, tone, dialect, duration);

    const courses = videos.map((v, idx) => {
      const id = `course_${Date.now()}_${idx}`;
      const course = {
        id,
        title: v.topic || `Video ${idx + 1}`,
        description: v.scenes.map(s => s.title).join(' · '),
        status: 'content_ready',
        source,
        boardStyle: req.body.boardStyle || 'classic',
        scorm: req.body.scorm === 'true' || req.body.scorm === true,
        scenes: v.scenes,
        createdAt: new Date(Date.now() + idx).toISOString(),
      };
      putCourse(course);
      return course;
    });

    res.json({ courses });
  } catch (err) {
    console.error('[POST /api/courses]', err);
    res.status(500).json({ error: err.message || 'Error al generar el guión' });
  }
});

// ── POST /api/courses/:id/audio ──────────────────────────────────────────────
// Returns { jobId } immediately. Poll GET /api/jobs/:jobId for progress.
app.post('/api/courses/:id/audio', async (req, res) => {
  const course = getCourse(req.params.id);
  if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

  const jobId = `audio_${Date.now()}`;
  const total = course.scenes.filter(s => s.narration).length;
  renderJobs.set(jobId, { status: 'running', done: 0, total, error: null });
  res.json({ jobId });

  (async () => {
    try {
      const enriched = await generateAudio(course.scenes, course.id, (done) => {
        renderJobs.set(jobId, { status: 'running', done, total, error: null });
      });
      course.scenes = enriched;
      course.status = 'ready';
      putCourse(course);
      renderJobs.set(jobId, { status: 'done', done: total, total, error: null });
    } catch (err) {
      console.error('[audio job]', err);
      renderJobs.set(jobId, { status: 'error', done: 0, total, error: err.message });
    }
  })();
});

// ── GET /api/courses/:id/scorm ───────────────────────────────────────────────
// Downloads a SCORM 1.2 ZIP with an HTML quiz player for the course.
app.get('/api/courses/:id/scorm', async (req, res) => {
  const course = getCourse(req.params.id);
  if (!course) return res.status(404).json({ error: 'Curso no encontrado' });
  try {
    const zip = await buildScormZip(course);
    const filename = course.title.replace(/[^a-z0-9áéíóúüñ\s]/gi, '').trim().replace(/\s+/g, '_').slice(0, 60) || course.id;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}_scorm.zip"`);
    res.send(zip);
  } catch (err) {
    console.error('[scorm]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/courses/:id ──────────────────────────────────────────────────
app.delete('/api/courses/:id', (req, res) => {
  const id = req.params.id;
  const course = getCourse(id);
  if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

  // Also remove audio files from disk
  const dir = path.join(STORAGE, id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });

  deleteCourse(id);
  res.json({ ok: true });
});

// ── Legacy routes (keep for compatibility) ───────────────────────────────────
app.post('/api/generate', upload.single('file'), async (req, res) => {
  try {
    let rawText = req.file ? await extractText(req.file) : req.body.text;
    if (!rawText) return res.status(400).json({ error: 'Se requiere un archivo o texto' });
    const scenes = await generateScript(rawText);
    res.json({ scenes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/audio', async (req, res) => {
  try {
    const { scenes, courseId } = req.body;
    if (!scenes?.length) return res.status(400).json({ error: 'Se requieren escenas' });
    const id = courseId || `course_${Date.now()}`;
    const enriched = await generateAudio(scenes, id);
    res.json({ scenes: enriched, courseId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/courses/:id/render ─────────────────────────────────────────────
// Starts an async MP4 render job. Returns { jobId }.
app.post('/api/courses/:id/render', async (req, res) => {
  const course = getCourse(req.params.id);
  if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

  const jobId = `job_${Date.now()}`;
  renderJobs.set(jobId, { status: 'pending', progress: 0, error: null, outputPath: null });
  res.json({ jobId });

  // Run render async
  (async () => {
    try {
      const { bundle } = await import('@remotion/bundler');
      const { renderMedia, selectComposition } = await import('@remotion/renderer');

      renderJobs.set(jobId, { status: 'bundling', progress: 5, error: null, outputPath: null });

      const entryPoint = path.join(ROOT, 'src', 'video', 'index.tsx');
      const bundled = await bundle({
        entryPoint,
        webpackOverride: (c) => c,
      });

      renderJobs.set(jobId, { status: 'rendering', progress: 20, error: null, outputPath: null });

      const totalFrames = course.scenes.reduce((a, s) => a + s.duration, 0);
      // Remotion renders from its own bundled server — audioUrls must be absolute
      const apiBase = `http://localhost:${PORT}`;
      const scenesWithAbsoluteAudio = course.scenes.map(s => ({
        ...s,
        audioUrl: s.audioUrl?.startsWith('/') ? `${apiBase}${s.audioUrl}` : (s.audioUrl || null),
      }));
      const inputProps = {
        config: {
          topic: course.title,
          accentColor: '#3851d8',
          boardStyle: course.boardStyle || 'classic',
          scenes: scenesWithAbsoluteAudio,
        },
      };

      const composition = await selectComposition({
        serveUrl: bundled,
        id: 'WhiteboardVideo',
        inputProps,
      });

      const outDir = path.join(STORAGE, course.id);
      fs.mkdirSync(outDir, { recursive: true });
      const outputPath = path.join(outDir, 'video.mp4');

      await renderMedia({
        composition: { ...composition, durationInFrames: totalFrames },
        serveUrl: bundled,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps,
        onProgress: ({ progress }) => {
          renderJobs.set(jobId, {
            status: 'rendering',
            progress: Math.round(20 + progress * 78),
            error: null,
            outputPath: null,
          });
        },
      });

      renderJobs.set(jobId, {
        status: 'done',
        progress: 100,
        error: null,
        outputPath: `/storage/${course.id}/video.mp4`,
      });
    } catch (err) {
      console.error('[render]', err);
      renderJobs.set(jobId, { status: 'error', progress: 0, error: err.message, outputPath: null });
    }
  })();
});

// ── GET /api/jobs/:jobId ──────────────────────────────────────────────────────
app.get('/api/jobs/:jobId', (req, res) => {
  const job = renderJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job no encontrado' });
  res.json(job);
});

app.get('/api/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`[whiteboard-ai] API en http://localhost:${PORT}`));
