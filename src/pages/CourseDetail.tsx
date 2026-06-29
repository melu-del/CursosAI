import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Player } from '@remotion/player';
import { WhiteboardComposition } from '../video/WhiteboardComposition';
import type { WhiteboardScene } from '../video/types';

const FPS = 30;
const ACCENT_COLOR = '#1b8e5a';
const BOARD_STYLE = 'classic' as const;

interface Course {
  id: string;
  title: string;
  description: string;
  status: string;
  source?: string;
  scenes: WhiteboardScene[];
}

const SCENE_ICONS: Record<string, string> = {
  title: '🎯',
  problem: '🤔',
  solution: '✅',
  example: '💡',
  closing: '🚀',
  content: '📋',
};

const SCENE_COLORS: Record<string, { bg: string; fg: string }> = {
  title:    { bg: '#e8f4ee', fg: '#1b8e5a' },
  problem:  { bg: '#fee2e2', fg: '#b91c1c' },
  solution: { bg: '#dcfce7', fg: '#15803d' },
  example:  { bg: '#dbeafe', fg: '#1d4ed8' },
  closing:  { bg: '#f3e8ff', fg: '#7e22ce' },
  content:  { bg: '#f0f9ff', fg: '#0369a1' },
};

function ScenePlayer({ scene, courseTitle }: { scene: WhiteboardScene; courseTitle: string }) {
  const [open, setOpen] = useState(false);
  const config = {
    topic: courseTitle,
    accentColor: ACCENT_COLOR,
    boardStyle: BOARD_STYLE,
    scenes: [scene],
  };
  const secs = Math.round(scene.duration / FPS);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          width: '100%', padding: '28px 0',
          background: 'var(--hu-bg)', border: '1px dashed var(--hu-border-strong)',
          borderRadius: 'var(--hu-radius-m)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          color: 'var(--hu-text-soft)', fontSize: 14, fontWeight: 500,
          fontFamily: 'inherit', marginBottom: 12,
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--hu-brand)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--hu-brand)'; }}
        onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--hu-border-strong)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--hu-text-soft)'; }}
      >
        <span style={{ fontSize: 20 }}>▶</span>
        <span>Previsualizar escena ({secs}s)</span>
      </button>
    );
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div className="lesson-player-wrapper" style={{ aspectRatio: '16 / 9' }}>
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
      </div>
      <button
        onClick={() => setOpen(false)}
        style={{
          background: 'none', border: 'none', color: 'var(--hu-text-faint)',
          fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0',
        }}
      >
        Cerrar preview
      </button>
    </div>
  );
}

export function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [audioMsg, setAudioMsg] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);
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

      // Poll until done
      while (mountedRef.current) {
        await new Promise(r => setTimeout(r, 1500));
        const job = await fetch(`/api/jobs/${jobId}`).then(r => r.json());
        if (mountedRef.current) setRenderProgress(job.progress ?? 0);
        if (job.status === 'done') {
          // Download
          const a = document.createElement('a');
          a.href = job.outputPath;
          a.download = `${course.title.replace(/[^a-z0-9]/gi, '_')}.mp4`;
          a.click();
          break;
        }
        if (job.status === 'error') {
          throw new Error(job.error || 'Error al renderizar');
        }
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

      // Poll job
      while (mountedRef.current) {
        await new Promise(r => setTimeout(r, 1500));
        const job = await fetch(`/api/jobs/${jobId}`).then(r => r.json());
        if (job.status === 'done') {
          // Reload course from API
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
      <div className="error-box">
        <div>Algo no funcionó: {error}</div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="btn" onClick={load}>Reintentar</button>
          <Link to="/" className="btn btn-secondary">Volver</Link>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <>
        <Link to="/" className="back-link">← Volver</Link>
        <div style={{ marginTop: 16 }}>
          <div className="skeleton-line skeleton-line--title" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line--short" />
        </div>
      </>
    );
  }

  const scenes = course.scenes || [];
  const missingAudio = scenes.filter(s => !s.audioUrl).length;
  const totalSecs = Math.round(scenes.reduce((a, s) => a + s.duration, 0) / FPS);
  const isDemo = course.id === 'course_demo';

  return (
    <>
      <Link to="/" className="back-link">← Volver a mis videos</Link>

      <div className="page-header">
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h2 style={{ margin: 0 }}>{course.title}</h2>
            {isDemo && (
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                padding: '3px 8px', borderRadius: 999,
                background: '#fef3c7', color: '#b45309',
                textTransform: 'uppercase',
              }}>
                Demo
              </span>
            )}
          </div>
          <p className="subtitle">{course.description}</p>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13, color: 'var(--hu-text-soft)' }}>
            <span>📽 {scenes.length} escenas</span>
            <span>⏱ {totalSecs}s de video</span>
            {missingAudio === 0
              ? <span style={{ color: 'var(--hu-success)' }}>🎙 Con narración</span>
              : <span>{missingAudio} sin narración</span>
            }
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {missingAudio > 0 && (
            <button className="btn btn-secondary" onClick={handleGenerateAudio} disabled={generatingAudio}>
              {generatingAudio ? 'Generando...' : '🎙 Agregar narración'}
            </button>
          )}
          <button
            className="btn"
            onClick={handleRender}
            disabled={rendering || isDemo}
            title={isDemo ? 'Disponible en cursos reales' : ''}
          >
            {rendering
              ? `⏳ Renderizando ${renderProgress}%`
              : '⬇️ Descargar MP4'}
          </button>
          {!isDemo && (
            <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          )}
        </div>
      </div>

      {/* Demo banner */}
      {isDemo && (
        <div style={{
          margin: '16px 0',
          padding: '14px 18px',
          background: 'var(--hu-info-soft)',
          border: '1px solid #bfdbfe',
          borderRadius: 'var(--hu-radius-s)',
          fontSize: 14,
          color: 'var(--hu-info)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>ℹ️</span>
          <span>
            Este es un <strong>curso de demostración</strong>. Para crear los tuyos, agregá tu{' '}
            <code style={{ background: '#dbeafe', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>GEMINI_API_KEY</code>{' '}
            en el archivo <code style={{ background: '#dbeafe', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>.env</code>{' '}
            y hacé clic en <Link to="/upload" style={{ color: 'var(--hu-info)', fontWeight: 600, textDecoration: 'underline' }}>Crear video</Link>.
          </span>
        </div>
      )}

      {/* Alert audio faltante */}
      {missingAudio > 0 && !isDemo && (
        <div className="alert-warning">
          <div>Hay {missingAudio} escena{missingAudio !== 1 ? 's' : ''} sin narración.</div>
          <button onClick={handleGenerateAudio} disabled={generatingAudio}>
            {generatingAudio ? 'Generando narraciones...' : 'Generar narración faltante'}
          </button>
          {audioMsg && <div style={{ marginTop: 8, fontSize: 13 }}>{audioMsg}</div>}
        </div>
      )}

      {renderError && (
        <div className="error-box" style={{ marginTop: 12 }}>
          <strong>Error al exportar:</strong> {renderError}
        </div>
      )}

      {audioMsg && missingAudio === 0 && (
        <div style={{
          margin: '12px 0', padding: '10px 14px',
          background: 'var(--hu-success-soft)', color: 'var(--hu-success)',
          borderRadius: 'var(--hu-radius-s)', fontSize: 14,
        }}>
          ✅ {audioMsg}
        </div>
      )}

      {/* Module block — igual que osdepym */}
      <div className="module-block">
        <div className="module-header">
          <h2>Escenas del video</h2>
          <span className="module-pill">{scenes.length} escenas</span>
        </div>
        <p className="module-desc">
          Cada escena es una parte del video pizarra. Hacé clic en ▶ para previsualizarla.
        </p>

        {scenes.map((scene) => {
          const c = SCENE_COLORS[scene.type] || SCENE_COLORS.content;
          const icon = SCENE_ICONS[scene.type] || '📋';
          const secs = Math.round(scene.duration / FPS);
          return (
            <div key={scene.id} className="lesson-card">
              {/* Lesson header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: c.bg, color: c.fg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}>
                  {icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0 }}>{scene.title}</h3>
                  <div style={{ fontSize: 12, color: 'var(--hu-text-faint)', marginTop: 2 }}>
                    {scene.type} · {secs}s
                    {scene.audioUrl && (
                      <span style={{
                        marginLeft: 8, fontSize: 11, fontWeight: 600,
                        color: 'var(--hu-success)', background: 'var(--hu-success-soft)',
                        padding: '1px 7px', borderRadius: 999,
                      }}>
                        🎙 Con narración
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Narration text */}
              {scene.narration && (
                <div className="lesson-desc">{scene.narration}</div>
              )}

              {/* Embedded player */}
              <ScenePlayer scene={scene} courseTitle={course.title} />

              {/* Bullets preview */}
              {scene.bullets?.length > 0 && (
                <div style={{
                  marginTop: 8, padding: '10px 14px',
                  background: 'var(--hu-bg)', borderRadius: 'var(--hu-radius-s)',
                  fontSize: 13, color: 'var(--hu-text-muted)',
                }}>
                  {scene.bullets.slice(0, 3).map((b, i) => (
                    <div key={i} style={{ padding: '3px 0' }}>• {b}</div>
                  ))}
                  {scene.bullets.length > 3 && (
                    <div style={{ color: 'var(--hu-text-faint)' }}>
                      +{scene.bullets.length - 3} más...
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
