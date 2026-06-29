import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface CourseSummary {
  id: string;
  title: string;
  description: string;
  status: string;
  sceneCount: number;
  audioReady: boolean;
  createdAt: string;
  source: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Procesando',
  content_ready: 'Guión listo',
  ready: 'Con narración',
  error: 'Error',
};

export function CoursesList() {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = () => {
    setError(null);
    setCourses(null);
    fetch('/api/courses')
      .then(r => r.json())
      .then(setCourses)
      .catch(e => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (e: React.MouseEvent, course: CourseSummary) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${course.title}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(course.id);
    try {
      await fetch(`/api/courses/${course.id}`, { method: 'DELETE' });
      setCourses(prev => prev?.filter(c => c.id !== course.id) ?? prev);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('es-AR', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch { return ''; }
  };

  if (error) {
    return (
      <div className="error-box">
        <div>Algo no funcionó: {error}</div>
        <button className="btn" style={{ marginTop: 12 }} onClick={load}>Reintentar</button>
      </div>
    );
  }

  if (!courses) {
    return (
      <>
        <div className="page-title-row"><h2>Tus videos</h2></div>
        <div className="course-grid">
          {[0, 1, 2].map(i => (
            <div key={i} className="course-card" aria-hidden style={{ pointerEvents: 'none' }}>
              <div className="skeleton-line skeleton-line--title" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-line--short" />
            </div>
          ))}
        </div>
      </>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: 64, marginBottom: 16, lineHeight: 1 }}>✏️</div>
        <h2>Todavía no generaste ningún video</h2>
        <p style={{ maxWidth: 420, margin: '0 auto 24px' }}>
          Subí un PDF o Word, o describí el tema y la IA arma el video pizarra con animaciones y narración.
        </p>
        <Link to="/upload" className="btn">+ Crear mi primer video</Link>
      </div>
    );
  }

  return (
    <>
      <div className="page-title-row">
        <div>
          <h2>Tus videos</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--hu-text-soft)' }}>
            {courses.length} video{courses.length !== 1 ? 's' : ''} generado{courses.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link to="/upload" className="btn">+ Crear video</Link>
      </div>
      <div className="course-grid">
        {courses.map(c => (
          <div key={c.id} className="course-card" onClick={() => navigate(`/courses/${c.id}`)}>
            <button
              className="course-delete-btn"
              onClick={e => handleDelete(e, c)}
              disabled={deletingId === c.id}
              title="Eliminar"
            >
              {deletingId === c.id ? '…' : '×'}
            </button>

            {/* Miniatura visual */}
            <div style={{
              height: 80, borderRadius: 8, marginBottom: 12,
              background: 'linear-gradient(135deg, #1b8e5a 0%, #2a9e6a 50%, #156e45 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36,
            }}>
              ✏️
            </div>

            <h3>{c.title}</h3>
            <div className="meta" style={{ marginBottom: 4 }}>
              {c.sceneCount} escenas
              {c.audioReady && ' · Con narración'}
              {c.source === 'prompt' && ' · Por tema'}
            </div>
            <div className="meta">{formatDate(c.createdAt)}</div>
            <span className={`status-pill status-${c.status}`}>
              {STATUS_LABELS[c.status] || c.status}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
