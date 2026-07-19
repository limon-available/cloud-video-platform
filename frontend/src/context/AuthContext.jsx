import { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // Register user
  const register = async (username, email, password) => {
    try {
      setError(null);
      const { data } = await api.post('/auth/register', {
        username,
        email,
        password,
      });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return data;
    } catch (err) {
      const message =
        err.response?.data?.error || 'Registration failed. Please try again.';
      setError(message);
      throw new Error(message);
    }
  };

  // Login user
  const login = async (email, password) => {
    try {
      setError(null);
      const { data } = await api.post('/auth/login', { email, password });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return data;
    } catch (err) {
      const message =
        err.response?.data?.error || 'Login failed. Please try again.';
      setError(message);
      throw new Error(message);
    }
  };

  // Logout user
  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  // Get current user profile
  const getProfile = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      return data.user;
    } catch (err) {
      console.error('Get profile error:', err);
      throw err;
    }
  };

  // Update user details
  const updateDetails = async (details) => {
    try {
      const { data } = await api.put('/auth/updatedetails', details);
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      return data.user;
    } catch (err) {
      const message =
        err.response?.data?.error || 'Update failed. Please try again.';
      setError(message);
      throw new Error(message);
    }
  };

  // Update password
  const updatePassword = async (currentPassword, newPassword) => {
    try {
      const { data } = await api.put('/auth/updatepassword', {
        currentPassword,
        newPassword,
      });
      localStorage.setItem('token', data.token);
      return data;
    } catch (err) {
      const message =
        err.response?.data?.error || 'Password update failed.';
      setError(message);
      throw new Error(message);
    }
  };

  // Upgrade viewer role to creator
  const becomeCreator = async () => {
    try {
      setError(null);
      const { data } = await api.put('/auth/become-creator');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return data;
    } catch (err) {
      const message =
        err.response?.data?.error || 'Failed to upgrade to creator.';
      setError(message);
      throw new Error(message);
    }
  };

  const clearError = () => setError(null);

  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
    getProfile,
    updateDetails,
    updatePassword,
    becomeCreator,
    clearError,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isCreator: user?.role === 'creator',
    isViewer: user?.role === 'viewer',
    role: user?.role || null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;