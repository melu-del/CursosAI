import { useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const STEPS_FILE = [
  { key: 'generate', label: 'Leyendo el documento y armando las escenas' },
  { key: 'audio',   label: 'Grabando la narración de cada escena' },
];

const STEPS_PROMPT = [
  { key: 'generate', label: 'Armando el video en base al tema' },
  { key: 'audio',   label: 'Grabando la narración de cada escena' },
];

export function UploadCourse() {
  const [mode, setMode] = useState<'file' | 'prompt'>('file');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [promptText, setPromptText] = useState('');
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const abortedRef = useRef(false);

  const isWorking = currentStep !== null;
  const STEPS = mode === 'prompt' ? STEPS_PROMPT : STEPS_FILE;

  const runFlow = useCallback(async (formData: FormData | null, text: string | null) => {
    abortedRef.current = false;
    setError(null);
    try {
      // Step 1: generate script
      setCurrentStep('generate');
      let resp: Response;
      if (formData) {
        resp = await fetch('/api/courses', { method: 'POST', body: formData });
      } else {
        resp = await fetch('/api/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
      }
      const course = await resp.json();
      if (!resp.ok) throw new Error(course.error || 'Error al generar el guión');
      if (abortedRef.current) return;

      setCourseId(course.id);

      // Step 2: generate audio (async job with polling)
      setCurrentStep('audio');
      setAudioProgress({ done: 0, total: 0 });
      const audioResp = await fetch(`/api/courses/${course.id}/audio`, { method: 'POST' });
      const { jobId, error: audioErr } = await audioResp.json();
      if (!audioResp.ok) throw new Error(audioErr || 'Error al generar el audio');
      if (abortedRef.current) return;

      // Poll job until done
      while (!abortedRef.current) {
        await new Promise(r => setTimeout(r, 1500));
        const job = await fetch(`/api/jobs/${jobId}`).then(r => r.json());
        if (job.total > 0) setAudioProgress({ done: job.done, total: job.total });
        if (job.status === 'done') break;
        if (job.status === 'error') throw new Error(job.error || 'Error generando audio');
      }
      if (abortedRef.current) return;

      setCurrentStep(null);
      navigate(`/courses/${course.id}`);
    } catch (err: unknown) {
      if (!abortedRef.current) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setCurrentStep(null);
      }
    }
  }, [navigate]);

  const processFile = useCallback((file: File) => {
    if (isWorking) return;
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
    e.preventDefault();
    setDragOver(false);
    if (isWorking) return;
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const handleCancel = () => {
    abortedRef.current = true;
    navigate('/');
  };

  return (
    <div className="upload-shell">
      {!isWorking && (
        <>
          <div style={{ marginBottom: 12 }}>
            <Link to="/" className="back-link">← Volver</Link>
          </div>
          <div className="upload-hero">
            <h1>Creá un video pizarra en minutos</h1>
            <p>
              Subí un PDF o Word, o describí el tema y la IA arma el video
              con animaciones pizarra y narración.
            </p>
          </div>

          <div className="mode-tabs">
            <button className={`mode-tab ${mode === 'file' ? 'active' : ''}`} onClick={() => setMode('file')}>
              Subir documento
            </button>
            <button className={`mode-tab ${mode === 'prompt' ? 'active' : ''}`} onClick={() => setMode('prompt')}>
              Describir tema
            </button>
          </div>

          {mode === 'file' && (
            <label
              className={`dropzone-big ${dragOver ? 'active' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="dropzone-icon">📄</div>
              <div className="dropzone-title">Arrastrá tu documento acá</div>
              <div className="dropzone-sub">o hacé click para elegirlo desde tu computadora</div>
              <div className="dropzone-formats">PDF · Word · TXT — máx 50 MB</div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }}
              />
            </label>
          )}

          {mode === 'prompt' && (
            <div className="prompt-box">
              <label className="prompt-label">¿Sobre qué querés el video?</label>
              <textarea
                className="prompt-input"
                rows={5}
                placeholder="Por ejemplo: Explicame qué es la fotosíntesis para una clase de secundaria."
                value={promptText}
                onChange={e => setPromptText(e.target.value)}
                maxLength={2000}
              />
              <div className="prompt-hint">
                La IA usa conocimiento general sobre el tema. No inventa estadísticas ni citas específicas.
              </div>
              <button
                className="btn"
                onClick={processPrompt}
                disabled={isWorking || promptText.trim().length < 3}
              >
                Generar video
              </button>
            </div>
          )}
        </>
      )}

      {isWorking && (
        <div className="progress-card">
          <div className="progress-file">
            <div>
              <div className="progress-file-name">{fileName}</div>
              <div className="progress-file-hint">Generando tu video, esto puede tardar un par de minutos.</div>
            </div>
          </div>

          <div className="progress-steps">
            {STEPS.map(s => {
              const order = STEPS.findIndex(x => x.key === s.key);
              const cur = STEPS.findIndex(x => x.key === currentStep);
              const state = order < cur ? 'done' : order === cur ? 'active' : 'pending';
              return (
                <div key={s.key} className={`progress-step ${state}`}>
                  <div className="progress-step-indicator">
                    {state === 'done'    && <span className="check">✓</span>}
                    {state === 'active'  && <span className="spinner-inner" />}
                    {state === 'pending' && <span className="dot" />}
                  </div>
                  <div className="progress-step-body">
                    <div className="progress-step-label">{s.label}</div>
                    {s.key === 'audio' && state === 'active' && audioProgress.total > 0 && (
                      <div className="progress-step-detail">
                        {audioProgress.done} de {audioProgress.total} escenas
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="progress-tip">Podés dejar esta pestaña abierta y seguir con lo tuyo.</div>

          <div style={{ marginTop: 16, textAlign: 'center', display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={handleCancel} className="btn-link">
              ← Cancelar y volver
            </button>
            {courseId && currentStep === 'audio' && (
              <button type="button" onClick={() => navigate(`/courses/${courseId}`)} className="btn-link">
                Ver el video de todas formas →
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="error-box">
          <strong>Algo no funcionó.</strong><br />{error}
        </div>
      )}
    </div>
  );
}
