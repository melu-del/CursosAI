import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Player } from '@remotion/player';
import { Box, Typography, Chip, LinearProgress } from '@material-hu/mui';
import Button from '@material-hu/components/design-system/Buttons/Button';
import Alert from '@material-hu/components/design-system/Alert';
import CardContainer from '@material-hu/components/design-system/CardContainer';
import { WhiteboardComposition } from '../video/WhiteboardComposition';
import type { WhiteboardScene } from '../video/types';
import { LessonQuiz } from '../components/LessonQuiz';

const FPS = 30;
const ACCENT_COLOR = '#3851d8';

interface Course {
  id: string;
  title: string;
  description: string;
  status: string;
  source?: string;
  boardStyle?: string;
  scorm?: boolean;
  scenes: WhiteboardScene[];
}

const SCENE_ICONS: Record<string, string> = {
  title:    '🎯',
  problem:  '🤔',
  solution: '✅',
  example:  '💡',
  closing:  '🚀',
  content:  '📋',
};

const SCENE_BG: Record<string, string> = {
  title:    '#e8f4ee',
  problem:  '#fee2e2',
  solution: '#dcfce7',
  example:  '#dbeafe',
  closing:  '#f3e8ff',
  content:  '#f0f9ff',
};

const SCENE_FG: Record<string, string> = {
  title:    '#1b8e5a',
  problem:  '#b91c1c',
  solution: '#15803d',
  example:  '#1d4ed8',
  closing:  '#7e22ce',
  content:  '#0369a1',
};

/* ── Full video player ───────────────────────────────────────── */
type BoardStyle = 'classic' | 'dark' | 'chalk' | 'colorful';

function FullVideoPlayer({ scenes, courseTitle, boardStyle }: { scenes: WhiteboardScene[]; courseTitle: string; boardStyle: string }) {
  const totalFrames = scenes.reduce((a, s) => a + s.duration, 0);
  const config = { topic: courseTitle, accentColor: ACCENT_COLOR, boardStyle: boardStyle as BoardStyle, scenes };

  return (
    <Box sx={{
      borderRadius: 2, overflow: 'hidden',
      boxShadow: '0 4px 32px rgba(56,81,216,0.18)',
      aspectRatio: '16 / 9',
      bgcolor: '#faf8f5',
    }}>
      <Player
        component={WhiteboardComposition}
        inputProps={{ config }}
        durationInFrames={Math.max(totalFrames, 30)}
        compositionWidth={1280}
        compositionHeight={720}
        fps={FPS}
        style={{ width: '100%', height: '100%' }}
        controls
      />
    </Box>
  );
}

/* ── Individual scene preview (collapsed by default) ────────── */
function ScenePlayer({ scene, courseTitle, boardStyle }: { scene: WhiteboardScene; courseTitle: string; boardStyle: string }) {
  const [open, setOpen] = useState(false);
  const config = { topic: courseTitle, accentColor: ACCENT_COLOR, boardStyle: boardStyle as BoardStyle, scenes: [scene] };
  const secs = Math.round(scene.duration / FPS);

  if (!open) {
    return (
      <Button
        variant="outlined"
        fullWidth
        onClick={() => setOpen(true)}
        sx={{ my: 1, py: 1.5, borderStyle: 'dashed', textTransform: 'none' }}
      >
        ▶ Previsualizar escena ({secs}s)
      </Button>
    );
  }

  return (
    <Box sx={{ my: 1 }}>
      <Box sx={{ aspectRatio: '16 / 9', borderRadius: 1, overflow: 'hidden' }}>
        <Player
          component={WhiteboardComposition}
          inputProps={{ config }}
          durationInFrames={Math.max(scene.duration, 30)}
          compositionWidth={1280}
          compositionHeight={720}
          fps={FPS}
          style={{ width: '100%', height: '100%' }}
          controls
        />
      </Box>
      <Button variant="text" size="small" onClick={() => setOpen(false)} sx={{ textTransform: 'none', mt: 0.5 }}>
        Cerrar preview
      </Button>
    </Box>
  );
}

/* ── Main page ───────────────────────────────────────────────── */
export function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [course,           setCourse]           = useState<Course | null>(null);
  const [error,            setError]            = useState<string | null>(null);
  const [deleting,         setDeleting]         = useState(false);
  const [generatingAudio,  setGeneratingAudio]  = useState(false);
  const [audioMsg,         setAudioMsg]         = useState<string | null>(null);
  const [rendering,        setRendering]        = useState(false);
  const [renderProgress,   setRenderProgress]   = useState(0);
  const [renderError,      setRenderError]      = useState<string | null>(null);
  const [scenesOpen,       setScenesOpen]       = useState(false);
  const [exportingScorm,   setExportingScorm]   = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    fetch(`/api/courses/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        if (mountedRef.current) setCourse(data);
      })
      .catch(e => { if (mountedRef.current) setError(e.message); });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleExportScorm = async () => {
    if (!course) return;
    setExportingScorm(true);
    try {
      const resp = await fetch(`/api/courses/${course.id}/scorm`);
      if (!resp.ok) throw new Error('Error al generar SCORM');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${course.title.replace(/[^a-z0-9]/gi, '_')}_scorm.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error al exportar SCORM');
    } finally {
      setExportingScorm(false);
    }
  };

  const handleDelete = async () => {
    if (!course) return;
    if (!confirm(`¿Eliminar "${course.title}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/courses/${course.id}`, { method: 'DELETE' });
      navigate('/');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
      if (mountedRef.current) setDeleting(false);
    }
  };

  const handleRender = async () => {
    if (!course) return;
    setRendering(true);
    setRenderProgress(0);
    setRenderError(null);
    try {
      const resp = await fetch(`/api/courses/${course.id}/render`, { method: 'POST' });
      const { jobId } = await resp.json();
      while (mountedRef.current) {
        await new Promise(r => setTimeout(r, 1500));
        const job = await fetch(`/api/jobs/${jobId}`).then(r => r.json());
        if (mountedRef.current) setRenderProgress(job.progress ?? 0);
        if (job.status === 'done') {
          const a = document.createElement('a');
          a.href = job.outputPath;
          a.download = `${course.title.replace(/[^a-z0-9]/gi, '_')}.mp4`;
          a.click();
          break;
        }
        if (job.status === 'error') throw new Error(job.error || 'Error al renderizar');
      }
    } catch (e: unknown) {
      if (mountedRef.current) setRenderError(e instanceof Error ? e.message : 'Error');
    } finally {
      if (mountedRef.current) { setRendering(false); setRenderProgress(0); }
    }
  };

  const handleGenerateAudio = async () => {
    if (!course) return;
    setGeneratingAudio(true);
    setAudioMsg(null);
    try {
      const resp = await fetch(`/api/courses/${course.id}/audio`, { method: 'POST' });
      const { jobId, error: err } = await resp.json();
      if (!resp.ok) throw new Error(err || 'Error al generar audio');
      while (mountedRef.current) {
        await new Promise(r => setTimeout(r, 1500));
        const job = await fetch(`/api/jobs/${jobId}`).then(r => r.json());
        if (job.status === 'done') {
          const updated = await fetch(`/api/courses/${course.id}`).then(r => r.json());
          if (mountedRef.current) {
            setCourse(updated);
            const count = updated.scenes?.filter((s: WhiteboardScene) => s.audioUrl).length ?? 0;
            setAudioMsg(`Listo. Se generó la narración para ${count} escena${count !== 1 ? 's' : ''}.`);
          }
          break;
        }
        if (job.status === 'error') throw new Error(job.error || 'Error generando audio');
      }
    } catch (e: unknown) {
      if (mountedRef.current) setAudioMsg(e instanceof Error ? e.message : 'Error al generar audio');
    } finally {
      if (mountedRef.current) setGeneratingAudio(false);
    }
  };

  if (error) {
    return (
      <Box>
        <Alert severity="error" title="Algo no funcionó" description={error} sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" onClick={load}>Reintentar</Button>
          <Button variant="outlined" component={Link} to="/">Volver</Button>
        </Box>
      </Box>
    );
  }

  if (!course) {
    return (
      <Box>
        <Button variant="text" component={Link} to="/" sx={{ mb: 2, textTransform: 'none' }}>← Volver</Button>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ aspectRatio: '16/9', bgcolor: 'grey.100', borderRadius: 2 }} />
          {[1, 0.6].map((w, i) => (
            <Box key={i} sx={{ height: 16, width: `${w * 60}%`, bgcolor: 'grey.100', borderRadius: 1 }} />
          ))}
        </Box>
      </Box>
    );
  }

  const scenes           = course.scenes || [];
  const missingAudio     = scenes.filter(s => !s.audioUrl).length;
  const totalSecs        = Math.round(scenes.reduce((a, s) => a + s.duration, 0) / FPS);
  const isDemo           = course.id === 'course_demo';
  const totalQuizQ       = scenes.reduce((a, s) => a + (s.quiz?.length || 0), 0);
  const scenesWithQuiz   = scenes.filter(s => s.quiz && s.quiz.length > 0);

  return (
    <>
      <Button variant="text" component={Link} to="/" sx={{ mb: 2, textTransform: 'none' }}>
        ← Volver a mis videos
      </Button>

      {/* ── Full video player ── */}
      <FullVideoPlayer scenes={scenes} courseTitle={course.title} boardStyle={course.boardStyle || 'classic'} />

      {/* ── Video metadata + actions ── */}
      <Box sx={{ mt: 2.5, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="h5" fontWeight={600}>{course.title}</Typography>
              {isDemo && <Chip label="Demo" size="small" color="warning" sx={{ fontSize: 10, height: 18 }} />}
            </Box>
            {course.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {course.description}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">📽 {scenes.length} escenas</Typography>
              <Typography variant="caption" color="text.secondary">⏱ {totalSecs}s</Typography>
              {missingAudio === 0
                ? <Typography variant="caption" color="success.main">🎙 Con narración</Typography>
                : <Typography variant="caption" color="text.disabled">{missingAudio} sin narración</Typography>
              }
              {totalQuizQ > 0 && (
                <Typography variant="caption" color="primary.main">✏️ {totalQuizQ} preguntas</Typography>
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', flexShrink: 0 }}>
            {missingAudio > 0 && (
              <Button variant="outlined" onClick={handleGenerateAudio} loading={generatingAudio} sx={{ textTransform: 'none' }}>
                🎙 Agregar narración
              </Button>
            )}
            {(course.scorm || (course.scorm == null && totalQuizQ > 0)) && (
              <Button
                variant="outlined"
                onClick={handleExportScorm}
                loading={exportingScorm}
                disabled={isDemo}
                sx={{ textTransform: 'none' }}
              >
                📦 Exportar SCORM
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleRender}
              disabled={rendering || isDemo}
              loading={rendering}
              sx={{ textTransform: 'none' }}
            >
              {rendering ? `Renderizando ${renderProgress}%` : '⬇️ Descargar MP4'}
            </Button>
            {!isDemo && (
              <Button variant="outlined" color="error" onClick={handleDelete} loading={deleting} sx={{ textTransform: 'none' }}>
                Eliminar
              </Button>
            )}
          </Box>
        </Box>

        {rendering && <LinearProgress variant="determinate" value={renderProgress} sx={{ mt: 2, borderRadius: 1 }} />}
      </Box>

      {/* ── Alerts ── */}
      {isDemo && (
        <Alert
          severity="info"
          title="Curso de demostración"
          description={
            <>
              Para crear los tuyos, agregá tu <code>GEMINI_API_KEY</code> en el archivo <code>.env</code> y hacé clic en{' '}
              <Link to="/upload" style={{ color: 'inherit', fontWeight: 600 }}>Crear video</Link>.
            </>
          }
          sx={{ mb: 2 }}
        />
      )}
      {missingAudio > 0 && !isDemo && (
        <Alert
          severity="warning"
          title={`${missingAudio} escena${missingAudio !== 1 ? 's' : ''} sin narración`}
          action={{ text: generatingAudio ? 'Generando...' : 'Generar narración', onClick: handleGenerateAudio }}
          sx={{ mb: 2 }}
        />
      )}
      {renderError && <Alert severity="error" title="Error al exportar" description={renderError} sx={{ mb: 2 }} />}
      {audioMsg && missingAudio === 0 && <Alert severity="success" title={audioMsg} sx={{ mb: 2 }} />}

      {/* ── Quiz section ── */}
      {scenesWithQuiz.length > 0 && (
        <Box sx={{ mt: 2, mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>✏️ Preguntas del quiz</Typography>
            <Chip label={`${totalQuizQ} preguntas`} size="small" color="primary" variant="outlined" />
            {course.scorm && (
              <Chip label="Incluido en SCORM" size="small" color="warning" variant="outlined" sx={{ fontSize: 10 }} />
            )}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {scenesWithQuiz.map((scene) => (
              <Box key={scene.id}>
                <Typography variant="overline" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 1 }}>
                  {SCENE_ICONS[scene.type] || '📋'} {scene.title}
                </Typography>
                <LessonQuiz quiz={scene.quiz!} />
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* ── Scenes (collapsible) ── */}
      <Box sx={{ mt: 1 }}>
        <Button
          variant="text"
          fullWidth
          onClick={() => setScenesOpen(o => !o)}
          sx={{
            textTransform: 'none', justifyContent: 'space-between',
            py: 1.5, px: 2, borderRadius: 2,
            bgcolor: scenesOpen ? 'primary.50' : 'grey.50',
            '&:hover': { bgcolor: 'primary.50' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography fontWeight={600}>Escenas del video</Typography>
            <Chip label={`${scenes.length} escenas`} size="small" color="primary" variant="outlined" />
          </Box>
          <Typography color="text.secondary" sx={{ fontSize: 20 }}>
            {scenesOpen ? '▲' : '▼'}
          </Typography>
        </Button>

        {scenesOpen && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            {scenes.map((scene) => {
              const bg   = SCENE_BG[scene.type]   || SCENE_BG.content;
              const fg   = SCENE_FG[scene.type]   || SCENE_FG.content;
              const icon = SCENE_ICONS[scene.type] || '📋';
              const secs = Math.round(scene.duration / FPS);

              return (
                <CardContainer key={scene.id} hasShadow fullWidth>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1 }}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: 1, flexShrink: 0,
                      bgcolor: bg, color: fg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18,
                    }}>
                      {icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={600} sx={{ fontSize: 15 }}>{scene.title}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                        <Typography variant="caption" color="text.disabled">
                          {scene.type} · {secs}s
                        </Typography>
                        {scene.audioUrl && (
                          <Chip label="🎙 Con narración" size="small" color="success" sx={{ fontSize: 10, height: 18 }} />
                        )}
                      </Box>
                    </Box>
                  </Box>

                  {scene.narration && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, pl: 0.5 }}>
                      {scene.narration}
                    </Typography>
                  )}

                  <ScenePlayer scene={scene} courseTitle={course.title} boardStyle={course.boardStyle || 'classic'} />

                  {scene.bullets?.length > 0 && (
                    <Box sx={{ mt: 1, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                      {scene.bullets.slice(0, 3).map((b, i) => (
                        <Typography key={i} variant="body2" color="text.secondary" sx={{ py: 0.25 }}>
                          • {b}
                        </Typography>
                      ))}
                      {scene.bullets.length > 3 && (
                        <Typography variant="caption" color="text.disabled">
                          +{scene.bullets.length - 3} más...
                        </Typography>
                      )}
                    </Box>
                  )}

                  {scene.quiz && scene.quiz.length > 0 && <LessonQuiz quiz={scene.quiz} />}
                </CardContainer>
              );
            })}
          </Box>
        )}
      </Box>
    </>
  );
}
