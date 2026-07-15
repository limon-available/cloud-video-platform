import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import WatchPage from './pages/WatchPage';
import SearchPage from './pages/SearchPage';
import ProfilePage from './pages/ProfilePage';
import WatchHistoryPage from './pages/WatchHistoryPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminUploadPage from './pages/AdminUploadPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-gray-900">
          <Navbar />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/watch/:id" element={<WatchPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/history" element={<WatchHistoryPage />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/upload" element={<AdminUploadPage />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;