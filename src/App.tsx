import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import { CoursesList } from './pages/CoursesList';
import { UploadCourse } from './pages/UploadCourse';
import { CourseDetail } from './pages/CourseDetail';

export default function App() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="app-header">
        <div className="brand" onClick={() => navigate('/')}>
          <div className="brand-mark" style={{ fontSize: 20 }}>✏️</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--hu-text)', letterSpacing: '-0.01em' }}>
              Whiteboard AI
            </h1>
            <div className="header-subtitle">Generador de videos pizarra</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/upload" className="btn" style={{ fontSize: 13, padding: '8px 14px' }}>
            + Crear video
          </Link>
          <div className="user-avatar">W</div>
        </div>
      </header>

      <div className="container" style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<CoursesList />} />
          <Route path="/upload" element={<UploadCourse />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
        </Routes>
      </div>
    </div>
  );
}
