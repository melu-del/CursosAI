import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import { CoursesList } from './pages/CoursesList';
import { UploadCourse } from './pages/UploadCourse';
import { CourseDetail } from './pages/CourseDetail';
import { ThemeProvider } from '@material-hu/mui/styles';
import { createHuGoTheme } from '@material-hu/theme/hugo';
import { DialogLayerProvider } from '@material-hu/components/layers/Dialogs';
import { DrawerLayerProvider } from '@material-hu/components/layers/Drawers';
import { MenuLayerProvider } from '@material-hu/components/layers/Menus';
import Button from '@material-hu/components/design-system/Buttons/Button';
import GlobalStyles from '@material-hu/components/composed-components/GlobalStyles';
import { AppBar, Toolbar, Typography, Avatar, Box } from '@material-hu/mui';

export default function App() {
  const navigate = useNavigate();
  const theme = createHuGoTheme();

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <MenuLayerProvider>
        <DialogLayerProvider>
          <DrawerLayerProvider>
            <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
              <AppBar position="static" elevation={0} sx={{
                bgcolor: 'white',
                borderBottom: '1px solid',
                borderColor: 'divider',
                color: 'text.primary',
              }}>
                <Toolbar sx={{ px: { xs: 2, sm: 3 }, minHeight: '56px !important', gap: 2 }}>
                  <Box
                    onClick={() => navigate('/')}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', flexGrow: 1 }}
                  >
                    <Typography sx={{ fontSize: 20, lineHeight: 1 }}>✏️</Typography>
                    <Box>
                      <Typography variant="body1" fontWeight={600} sx={{ lineHeight: 1.2, letterSpacing: '0.2px' }}>
                        Humand
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.2px' }}>
                        Generador de Capacitaciones
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    component={Link}
                    to="/upload"
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    + Crear video
                  </Button>
                  <Avatar sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 600, bgcolor: 'primary.main' }}>
                    W
                  </Avatar>
                </Toolbar>
              </AppBar>

              <Box sx={{ flexGrow: 1, px: { xs: 2, sm: 3 }, py: 3, maxWidth: 1100, width: '100%', mx: 'auto' }}>
                <Routes>
                  <Route path="/" element={<CoursesList />} />
                  <Route path="/upload" element={<UploadCourse />} />
                  <Route path="/courses/:id" element={<CourseDetail />} />
                </Routes>
              </Box>
            </Box>
          </DrawerLayerProvider>
        </DialogLayerProvider>
      </MenuLayerProvider>
    </ThemeProvider>
  );
}
