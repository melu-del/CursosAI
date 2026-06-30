import { useState, useCallback, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Box, Typography, TextField, LinearProgress, Chip } from '@material-hu/mui';
import Button from '@material-hu/components/design-system/Buttons/Button';

/* ── Format options ─────────────────────────────────────────── */
interface FormatOption {
  id: string;
  icon: string;
  label: string;
  desc: string;
  videoType: string;
  boardStyle: string;
  scorm: boolean;
  badges: string[];
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'pizarra',
    icon: '✏️',
    label: 'Video Pizarra',
    desc: 'Animaciones estilo pizarra con dibujos y narración, para publicar en Humand.',
    videoType: 'explicativo',
    boardStyle: 'classic',
    scorm: false,
    badges: [],
  },
  {
    id: 'pizarra-quiz',
    icon: '✏️',
    label: 'Pizarra + Quiz',
    desc: 'Pizarra animada con quiz al final de cada escena, para publicar en Humand.',
    videoType: 'evaluacion',
    boardStyle: 'classic',
    scorm: false,
    badges: ['Quiz'],
  },
  {
    id: 'clasico',
    icon: '🎬',
    label: 'Video Clásico',
    desc: 'Presentación moderna con narración, para publicar en Humand.',
    videoType: 'explicativo',
    boardStyle: 'dark',
    scorm: false,
    badges: [],
  },
  {
    id: 'clasico-quiz',
    icon: '🎬',
    label: 'Clásico + Quiz',
    desc: 'Presentación moderna con quiz integrado, para publicar en Humand.',
    videoType: 'evaluacion',
    boardStyle: 'dark',
    scorm: false,
    badges: ['Quiz'],
  },
  {
    id: 'pizarra-scorm',
    icon: '📦',
    label: 'Pizarra + SCORM',
    desc: 'Pizarra animada con quiz, exportable como paquete SCORM para subir a Humand.',
    videoType: 'evaluacion',
    boardStyle: 'classic',
    scorm: true,
    badges: ['Quiz', 'SCORM'],
  },
  {
    id: 'clasico-scorm',
    icon: '📦',
    label: 'Clásico + SCORM',
    desc: 'Presentación moderna con quiz, exportable como paquete SCORM para subir a Humand.',
    videoType: 'evaluacion',
    boardStyle: 'dark',
    scorm: true,
    badges: ['Quiz', 'SCORM'],
  },
];

const TONE_OPTIONS = [
  { id: 'informal',     label: 'Informal',     icon: '😊', desc: 'Cercano, lenguaje simple' },
  { id: 'profesional',  label: 'Profesional',  icon: '💼', desc: 'Claro y directo' },
  { id: 'formal',       label: 'Formal',       icon: '🎓', desc: 'Serio y estructurado' },
];

const DIALECT_OPTIONS = [
  { id: 'rioplatense',     label: 'Rioplatense',      icon: '🇦🇷', desc: 'Acento local, sin coloquialismos' },
  { id: 'latinoamericano', label: 'Latinoamericano',   icon: '🌎', desc: 'Español neutro, sin regionalismos' },
];

const DURATION_OPTIONS = [
  { id: 'corto',  icon: '⚡', label: 'Corto',  time: '~2 min',  desc: '3-4 escenas, narración breve' },
  { id: 'medio',  icon: '⏱',  label: 'Medio',  time: '~5 min',  desc: '5-7 escenas, narración estándar' },
  { id: 'largo',  icon: '📽',  label: 'Largo',  time: '~10 min', desc: '8-12 escenas, narración detallada' },
];

const VIDEO_COUNT_OPTIONS = [
  { value: 1, label: '1 video',  desc: 'Todo el contenido en un solo video' },
  { value: 2, label: '2 videos', desc: 'Dividido en 2 partes' },
  { value: 3, label: '3 videos', desc: 'Dividido en 3 partes' },
  { value: 4, label: '4 videos', desc: 'Dividido en 4 partes' },
];

const GEN_MESSAGES = [
  'Leyendo el contenido…',
  'Analizando los conceptos clave…',
  'Diseñando la estructura del video…',
  'Generando las escenas y narración…',
  'Creando los dibujos para cada escena…',
  'Casi listo, revisando el guión…',
];

function ToggleChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      variant={selected ? 'contained' : 'outlined'}
      size="small"
      onClick={onClick}
      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: selected ? 600 : 400, flex: 1, justifyContent: 'center' }}
    >
      {children}
    </Button>
  );
}

/* ── Format card ─────────────────────────────────────────────── */
function FormatCard({ opt, selected, onClick }: { opt: FormatOption; selected: boolean; onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        p: 2.5, border: '2px solid', borderRadius: 2, cursor: 'pointer',
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'primary.50' : 'background.paper',
        boxShadow: selected ? '0 0 0 3px rgba(56,81,216,.12)' : 'none',
        transition: 'all 0.15s',
        '&:hover': { borderColor: 'primary.main', bgcolor: selected ? 'primary.50' : 'grey.50' },
      }}
    >
      <Typography sx={{ fontSize: 28, mb: 1, lineHeight: 1 }}>{opt.icon}</Typography>
      <Typography fontWeight={700} sx={{ fontSize: 14, mb: 0.5 }}>{opt.label}</Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, lineHeight: 1.5 }}>
        {opt.desc}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {opt.badges.map(b => (
          <Chip
            key={b} label={b} size="small"
            color={b === 'SCORM' ? 'warning' : 'primary'}
            variant={selected ? 'filled' : 'outlined'}
            sx={{ fontSize: 10, height: 18 }}
          />
        ))}
      </Box>
    </Box>
  );
}

/* ── Progress card ───────────────────────────────────────────── */
function ProgressCard({
  fileName, numVideos, progress, progressMsg, currentStep, audioProgress, courseIds, isScorm, onCancel, onSkipToResult,
}: {
  fileName: string | null;
  numVideos: number;
  progress: number;
  progressMsg: string;
  currentStep: string | null;
  audioProgress: { done: number; total: number };
  courseIds: string[];
  isScorm: boolean;
  onCancel: () => void;
  onSkipToResult: () => void;
}) {
  const pct = Math.round(progress);
  const isDone = progress >= 100;

  return (
    <Box sx={{
      mt: 4, p: 4,
      bgcolor: 'background.paper',
      borderRadius: 2,
      border: '1px solid',
      borderColor: 'divider',
      boxShadow: '-1px 8px 16px 0px rgba(170,170,186,0.45)',
    }}>
      <Typography fontWeight={600} sx={{ mb: 0.5, fontSize: 15 }}>{fileName}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Generando {numVideos === 1 ? 'tu video' : `${numVideos} videos`}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, mb: 1.5 }}>
        <Typography sx={{ fontSize: 72, fontWeight: 700, lineHeight: 1, color: isDone ? 'success.main' : 'primary.main', transition: 'color 0.4s' }}>
          {pct}
        </Typography>
        <Typography sx={{ fontSize: 36, fontWeight: 600, mb: 1, color: isDone ? 'success.main' : 'primary.main' }}>
          %
        </Typography>
      </Box>

      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 8, borderRadius: 4, mb: 1.5, bgcolor: 'grey.100',
          '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: isDone ? 'success.main' : 'primary.main', transition: 'transform 0.6s ease, background-color 0.4s' },
        }}
      />

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, minHeight: 20 }}>
        {progressMsg}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
        <Step
          label={numVideos === 1 ? 'Armando el guión con IA' : `Armando ${numVideos} guiones con IA`}
          state={currentStep === 'generate' ? 'active' : progress >= 45 ? 'done' : 'pending'}
          detail={currentStep === 'generate' ? progressMsg : undefined}
        />
        <Step
          label="Grabando la narración"
          state={currentStep === 'audio' ? 'active' : progress >= 100 ? 'done' : 'pending'}
          detail={currentStep === 'audio' && audioProgress.total > 0
            ? `${audioProgress.done} de ${audioProgress.total} video${audioProgress.total !== 1 ? 's' : ''} · ${Math.round((audioProgress.done / audioProgress.total) * 100)}%`
            : undefined}
        />
        {isScorm && (
          <Step
            label="Generando paquete SCORM"
            state={currentStep === 'scorm' ? 'active' : progress >= 100 && currentStep === null ? 'done' : 'pending'}
          />
        )}
      </Box>

      <Typography variant="caption" color="text.disabled" display="block" sx={{ mb: 2 }}>
        Podés dejar esta pestaña abierta y seguir con lo tuyo.
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button variant="text" onClick={onCancel} sx={{ textTransform: 'none', color: 'text.secondary' }}>
          ← Cancelar
        </Button>
        {courseIds.length > 0 && currentStep === 'audio' && (
          <Button variant="text" onClick={onSkipToResult} sx={{ textTransform: 'none' }}>
            Ver el resultado de todas formas →
          </Button>
        )}
      </Box>
    </Box>
  );
}

function Step({ label, state, detail }: { label: string; state: 'pending' | 'active' | 'done'; detail?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      <Box sx={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: state === 'done' ? 'success.main' : state === 'active' ? 'primary.main' : 'grey.200',
        color: state !== 'pending' ? 'white' : 'text.disabled',
        fontSize: 14, fontWeight: 700,
        transition: 'background-color 0.4s',
      }}>
        {state === 'done' ? '✓' : state === 'active' ? '…' : '·'}
      </Box>
      <Box sx={{ pt: 0.25 }}>
        <Typography variant="body2" fontWeight={state === 'active' ? 600 : 400} color={state === 'pending' ? 'text.disabled' : 'text.primary'}>
          {label}
        </Typography>
        {detail && <Typography variant="caption" color="text.secondary" display="block">{detail}</Typography>}
      </Box>
    </Box>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export function UploadCourse() {
  const [mode, setMode]         = useState<'file' | 'prompt'>('file');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [promptText, setPromptText] = useState('');
  const [numVideos, setNumVideos]   = useState(1);
  const [formatId, setFormatId]     = useState<string>('pizarra');
  const [tone, setTone]             = useState<string>('informal');
  const [dialect, setDialect]       = useState<string>('rioplatense');
  const [duration, setDuration]     = useState<string>('medio');
  const [largeFileWarning, setLargeFileWarning] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [courseIds, setCourseIds]     = useState<string[]>([]);
  const [audioProgress, setAudioProgress] = useState({ done: 0, total: 0 });
  const [error, setError]   = useState<string | null>(null);
  const [progress, setProgress]     = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [genMsgIdx, setGenMsgIdx]   = useState(0);

  const fileRef    = useRef<HTMLInputElement>(null);
  const navigate   = useNavigate();
  const abortedRef = useRef(false);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);

  const isWorking = currentStep !== null;
  const selectedFormat = FORMAT_OPTIONS.find(f => f.id === formatId) ?? FORMAT_OPTIONS[0];

  useEffect(() => {
    if (currentStep !== 'generate') return;
    const t = setInterval(() => { setGenMsgIdx(i => (i + 1) % GEN_MESSAGES.length); }, 4000);
    return () => clearInterval(t);
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === 'generate') setProgressMsg(GEN_MESSAGES[genMsgIdx]);
  }, [genMsgIdx, currentStep]);

  const startSimulatedProgress = () => {
    progressRef.current = 0;
    setProgress(0);
    timerRef.current = setInterval(() => {
      progressRef.current = progressRef.current + (44 - progressRef.current) * 0.06;
      setProgress(progressRef.current);
    }, 500);
  };

  const stopSimulatedProgress = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  useEffect(() => () => stopSimulatedProgress(), []);

  const runFlow = useCallback(async (formData: FormData | null, text: string | null) => {
    abortedRef.current = false;
    setError(null);
    setProgress(0);
    setGenMsgIdx(0);
    setProgressMsg(GEN_MESSAGES[0]);

    const fmt = FORMAT_OPTIONS.find(f => f.id === formatId) ?? FORMAT_OPTIONS[0];

    try {
      // ── Step 1: generate script ──
      setCurrentStep('generate');
      startSimulatedProgress();

      let resp: Response;
      if (formData) {
        formData.append('numVideos', String(numVideos));
        formData.append('videoType', fmt.videoType);
        formData.append('boardStyle', fmt.boardStyle);
        formData.append('scorm', String(fmt.scorm));
        formData.append('tone', tone);
        formData.append('dialect', dialect);
        formData.append('duration', duration);
        resp = await fetch('/api/courses', { method: 'POST', body: formData });
      } else {
        resp = await fetch('/api/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, numVideos, videoType: fmt.videoType, boardStyle: fmt.boardStyle, scorm: fmt.scorm, tone, dialect, duration }),
        });
      }

      stopSimulatedProgress();
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error al generar el guión');
      if (abortedRef.current) return;

      setProgress(45);
      setProgressMsg('Guión generado. Iniciando narración…');

      const courses: { id: string; title?: string }[] = data.courses || [data];
      const ids = courses.map((c) => c.id);
      setCourseIds(ids);

      // ── Step 2: audio ──
      setCurrentStep('audio');
      setAudioProgress({ done: 0, total: ids.length });

      const audioJobs: { jobId: string }[] = await Promise.all(
        ids.map((id) => fetch(`/api/courses/${id}/audio`, { method: 'POST' }).then((r) => r.json()))
      );
      if (abortedRef.current) return;

      const pending = new Set(audioJobs.map((j) => j.jobId));
      let doneCnt = 0;

      while (!abortedRef.current && pending.size > 0) {
        await new Promise((r) => setTimeout(r, 1500));
        await Promise.all(
          [...pending].map(async (jobId) => {
            const job = await fetch(`/api/jobs/${jobId}`).then((r) => r.json());
            if (job.status === 'done' || job.status === 'error') {
              pending.delete(jobId);
              doneCnt++;
              const audioPct = (doneCnt / ids.length) * (fmt.scorm ? 45 : 55);
              setProgress(45 + audioPct);
              setAudioProgress({ done: doneCnt, total: ids.length });
              setProgressMsg(
                doneCnt < ids.length
                  ? `Narración lista para ${doneCnt} de ${ids.length} video${ids.length !== 1 ? 's' : ''}…`
                  : '¡Narración completa!'
              );
            }
          })
        );
      }
      if (abortedRef.current) return;

      // ── Step 3 (optional): SCORM download ──
      if (fmt.scorm) {
        setCurrentStep('scorm');
        setProgressMsg('Generando paquetes SCORM…');
        for (const course of courses) {
          try {
            const scormResp = await fetch(`/api/courses/${course.id}/scorm`);
            if (scormResp.ok) {
              const blob = await scormResp.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const safeName = (course.title ?? course.id).replace(/[^a-z0-9áéíóúüñ\s]/gi, '').trim().replace(/\s+/g, '_').slice(0, 60) || course.id;
              a.download = `${safeName}_scorm.zip`;
              a.click();
              URL.revokeObjectURL(url);
            }
          } catch { /* non-fatal */ }
        }
        setProgress(100);
        setProgressMsg('¡Paquete SCORM descargado!');
      } else {
        setProgress(100);
        setProgressMsg('¡Todo listo!');
      }

      await new Promise(r => setTimeout(r, 600));
      setCurrentStep(null);
      if (ids.length === 1) navigate(`/courses/${ids[0]}`);
      else navigate('/');

    } catch (err: unknown) {
      stopSimulatedProgress();
      if (!abortedRef.current) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setCurrentStep(null);
      }
    }
  }, [navigate, numVideos, formatId]);

  const processFile = useCallback((file: File) => {
    if (isWorking) return;
    setLargeFileWarning(file.size > 2 * 1024 * 1024); // warn if > 2 MB
    setFileName(file.name);
    const fd = new FormData();
    fd.append('file', file);
    runFlow(fd, null);
  }, [isWorking, runFlow]);

  const processPrompt = useCallback(() => {
    if (isWorking) return;
    const text = promptText.trim();
    if (text.length < 3) { setError('Contanos un poco más sobre el tema del video.'); return; }
    setFileName(text.slice(0, 80));
    runFlow(null, text);
  }, [isWorking, promptText, runFlow]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (isWorking) return;
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const handleCancel = () => {
    abortedRef.current = true;
    stopSimulatedProgress();
    navigate('/');
  };

  return (
    <Box sx={{ maxWidth: 680, mx: 'auto' }}>

      {!isWorking && (
        <>
          <Typography variant="caption" component={Link} to="/"
            sx={{ color: 'text.secondary', textDecoration: 'none', display: 'block', mb: 2, '&:hover': { color: 'primary.main' } }}>
            ← Volver
          </Typography>

          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" fontWeight={600} gutterBottom>Creá un video educativo</Typography>
            <Typography color="text.secondary">
              Subí un PDF o Word, o describí el tema. La IA genera el video completo con animaciones y narración.
            </Typography>
          </Box>

          {/* Format selector */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="overline" color="text.secondary" fontWeight={600} gutterBottom display="block">
              ¿Qué tipo de video querés?
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5, mt: 1 }}>
              {FORMAT_OPTIONS.map((opt) => (
                <FormatCard
                  key={opt.id}
                  opt={opt}
                  selected={formatId === opt.id}
                  onClick={() => setFormatId(opt.id)}
                />
              ))}
            </Box>
          </Box>

          {/* Tone selector */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="overline" color="text.secondary" fontWeight={600} gutterBottom display="block">
              ¿Qué tono querés para el video?
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
              {TONE_OPTIONS.map((opt) => (
                <Box
                  key={opt.id}
                  onClick={() => setTone(opt.id)}
                  sx={{
                    flex: 1, p: 1.5, border: '2px solid', borderRadius: 2, cursor: 'pointer',
                    borderColor: tone === opt.id ? 'primary.main' : 'divider',
                    bgcolor: tone === opt.id ? 'primary.50' : 'background.paper',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: 'primary.main' },
                    textAlign: 'center',
                  }}
                >
                  <Typography sx={{ fontSize: 22, lineHeight: 1, mb: 0.5 }}>{opt.icon}</Typography>
                  <Typography fontWeight={tone === opt.id ? 700 : 500} sx={{ fontSize: 13 }}>{opt.label}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.3, mt: 0.25 }}>
                    {opt.desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Dialect selector */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="overline" color="text.secondary" fontWeight={600} gutterBottom display="block">
              ¿Qué variante del español?
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
              {DIALECT_OPTIONS.map((opt) => (
                <Box
                  key={opt.id}
                  onClick={() => setDialect(opt.id)}
                  sx={{
                    flex: 1, p: 1.5, border: '2px solid', borderRadius: 2, cursor: 'pointer',
                    borderColor: dialect === opt.id ? 'primary.main' : 'divider',
                    bgcolor: dialect === opt.id ? 'primary.50' : 'background.paper',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: 'primary.main' },
                    textAlign: 'center',
                  }}
                >
                  <Typography sx={{ fontSize: 22, lineHeight: 1, mb: 0.5 }}>{opt.icon}</Typography>
                  <Typography fontWeight={dialect === opt.id ? 700 : 500} sx={{ fontSize: 13 }}>{opt.label}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.3, mt: 0.25 }}>
                    {opt.desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Duration selector */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="overline" color="text.secondary" fontWeight={600} gutterBottom display="block">
              ¿Qué duración querés?
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
              {DURATION_OPTIONS.map((opt) => (
                <Box
                  key={opt.id}
                  onClick={() => setDuration(opt.id)}
                  sx={{
                    flex: 1, p: 1.5, border: '2px solid', borderRadius: 2, cursor: 'pointer',
                    borderColor: duration === opt.id ? 'primary.main' : 'divider',
                    bgcolor: duration === opt.id ? 'primary.50' : 'background.paper',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: 'primary.main' },
                    textAlign: 'center',
                  }}
                >
                  <Typography sx={{ fontSize: 22, lineHeight: 1, mb: 0.5 }}>{opt.icon}</Typography>
                  <Typography fontWeight={duration === opt.id ? 700 : 500} sx={{ fontSize: 13 }}>{opt.label}</Typography>
                  <Typography variant="caption" color="primary.main" fontWeight={600} display="block">{opt.time}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.3, mt: 0.25 }}>
                    {opt.desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Video count */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="overline" color="text.secondary" fontWeight={600} gutterBottom display="block">
              ¿En cuántos videos dividir el contenido?
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              {VIDEO_COUNT_OPTIONS.map((opt) => (
                <ToggleChip key={opt.value} selected={numVideos === opt.value} onClick={() => setNumVideos(opt.value)}>
                  {opt.label}
                </ToggleChip>
              ))}
            </Box>
            <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
              {VIDEO_COUNT_OPTIONS.find((o) => o.value === numVideos)?.desc}
            </Typography>
          </Box>

          {/* Input tabs */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button variant={mode === 'file' ? 'contained' : 'outlined'} onClick={() => setMode('file')} sx={{ textTransform: 'none' }}>
              Subir documento
            </Button>
            <Button variant={mode === 'prompt' ? 'contained' : 'outlined'} onClick={() => setMode('prompt')} sx={{ textTransform: 'none' }}>
              Describir tema
            </Button>
          </Box>

          {/* Drop zone */}
          {mode === 'file' && (
            <>
            <Box
              component="label"
              onDragOver={(e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 1, p: 5,
                border: '2px dashed', borderColor: dragOver ? 'primary.main' : 'divider',
                borderRadius: 2, bgcolor: dragOver ? 'primary.50' : 'background.paper',
                cursor: 'pointer', transition: 'all 0.15s',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'grey.50' },
              }}
            >
              <Typography sx={{ fontSize: 48 }}>📄</Typography>
              <Typography fontWeight={600}>Arrastrá tu documento acá</Typography>
              <Typography variant="body2" color="text.secondary">
                o hacé click para elegirlo desde tu computadora
              </Typography>
              <Typography variant="caption" color="text.disabled">PDF · Word · TXT — máx 50 MB</Typography>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
            </Box>
            {largeFileWarning && (
              <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200', borderRadius: 2 }}>
                <Typography variant="body2" color="warning.dark" fontWeight={600}>⚠️ Documento grande detectado</Typography>
                <Typography variant="caption" color="warning.dark" display="block">
                  Se usarán las secciones más relevantes del documento (inicio y cierre). Para mejores resultados con contenido muy extenso, dividí el material en múltiples videos.
                </Typography>
              </Box>
            )}
            </>
          )}

          {/* Prompt */}
          {mode === 'prompt' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="¿Sobre qué querés el video?"
                multiline rows={5}
                placeholder="Por ejemplo: Explicame qué es la fotosíntesis para una clase de secundaria."
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                inputProps={{ maxLength: 2000 }}
                fullWidth
                helperText="La IA usa conocimiento general sobre el tema."
              />
              <Button
                variant="contained"
                onClick={processPrompt}
                disabled={isWorking || promptText.trim().length < 3}
                sx={{ alignSelf: 'flex-start' }}
              >
                Generar {numVideos === 1 ? 'video' : `${numVideos} videos`}
              </Button>
            </Box>
          )}
        </>
      )}

      {isWorking && (
        <ProgressCard
          fileName={fileName}
          numVideos={numVideos}
          progress={progress}
          progressMsg={progressMsg}
          currentStep={currentStep}
          audioProgress={audioProgress}
          courseIds={courseIds}
          isScorm={selectedFormat.scorm}
          onCancel={handleCancel}
          onSkipToResult={() => navigate(courseIds.length === 1 ? `/courses/${courseIds[0]}` : '/')}
        />
      )}

      {error && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1, color: 'error.dark' }}>
          <Typography fontWeight={600}>Algo no funcionó.</Typography>
          <Typography variant="body2">{error}</Typography>
        </Box>
      )}
    </Box>
  );
}
