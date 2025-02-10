import React from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import GalleryPage from './pages/GalleryPage';
import AdminPage from './pages/AdminPage';
import TagPage from './pages/TagPage';
import UploadPage from './pages/UploadPage';
import ProtectedRoute from './ProtectedRoute';
import ShowcasePage from './pages/ShowcasePage'

const Layout = ({ children }) => {
  const location = useLocation();
  const hideNavbarRoutes = ["/login", "/showcase"]; // Rutas donde no se muestra el Navbar

  return (
    <>
      {!hideNavbarRoutes.includes(location.pathname) && <Navbar />}
      {children}
    </>
  );
};

function App() {
  return (
    <Router basename="image_tagger">
      <Layout>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/showcase" element={<ShowcasePage />} />

          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Routes>
                  <Route path="/gallery" element={<GalleryPage />} />
                  <Route path="/tag" element={<TagPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/image-upload" element={<UploadPage />} />
                </Routes>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
