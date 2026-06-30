import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Box, Grid, Typography, Chip, IconButton } from '@material-hu/mui';
import Button from '@material-hu/components/design-system/Buttons/Button';
import CardContainer from '@material-hu/components/design-system/CardContainer';

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

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'success' | 'error'> = {
  pending: 'default',
  content_ready: 'primary',
  ready: 'success',
  error: 'error',
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
      <Box sx={{ p: 3, bgcolor: 'error.light', borderRadius: 1, color: 'error.dark' }}>
        <Typography>Algo no funcionó: {error}</Typography>
        <Button variant="contained" sx={{ mt: 2 }} onClick={load}>Reintentar</Button>
      </Box>
    );
  }

  if (!courses) {
    return (
      <>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight={600}>Tus videos</Typography>
        </Box>
        <Grid container spacing={2}>
          {[0, 1, 2].map(i => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <CardContainer sx={{ height: 200 }} />
            </Grid>
          ))}
        </Grid>
      </>
    );
  }

  if (courses.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography sx={{ fontSize: 64, mb: 2, lineHeight: 1 }}>✏️</Typography>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          Todavía no generaste ningún video
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 420, mx: 'auto', mb: 3 }}>
          Subí un PDF o Word, o describí el tema y la IA arma el video pizarra con animaciones y narración.
        </Typography>
        <Button variant="contained" component={Link} to="/upload">
          + Crear mi primer video
        </Button>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={600}>Tus videos</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {courses.length} video{courses.length !== 1 ? 's' : ''} generado{courses.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      <Grid container spacing={2} alignItems="stretch">
        {courses.map(c => (
          <Grid item xs={12} sm={6} md={4} key={c.id}>
            <CardContainer
              onClick={() => navigate(`/courses/${c.id}`)}
              hasShadow
              fullWidth
              padding={0}
              sx={{ position: 'relative', cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              {/* Thumbnail */}
              <Box sx={{
                height: 90,
                background: 'linear-gradient(135deg, #3851d8 0%, #4d6ae0 50%, #2f3fc6 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36,
                borderRadius: '8px 8px 0 0',
                flexShrink: 0,
              }}>
                ✏️
              </Box>

              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', flex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography fontWeight={600} sx={{ fontSize: 14, flex: 1, mr: 1, lineHeight: 1.4 }}>
                    {c.title}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={e => handleDelete(e, c)}
                    disabled={deletingId === c.id}
                    sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' }, mt: -0.5, mr: -0.5, flexShrink: 0 }}
                  >
                    {deletingId === c.id ? '…' : '×'}
                  </IconButton>
                </Box>

                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  {c.sceneCount} escenas
                  {c.audioReady && ' · Con narración'}
                  {c.source === 'prompt' && ' · Por tema'}
                </Typography>
                <Typography variant="caption" color="text.disabled" display="block">
                  {formatDate(c.createdAt)}
                </Typography>

                <Box sx={{ mt: 'auto', pt: 1.5 }}>
                  <Chip
                    label={STATUS_LABELS[c.status] || c.status}
                    color={STATUS_COLORS[c.status] || 'default'}
                    size="small"
                    sx={{ fontSize: 11, height: 20 }}
                  />
                </Box>
              </Box>
            </CardContainer>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
