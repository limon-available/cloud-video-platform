import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const AdminDashboard = () => {
  const { isAdmin, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [videos, setVideos] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingThumbnail, setUpdatingThumbnail] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate('/');
      return;
    }
    fetchData();
  }, [isAuthenticated, isAdmin, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'overview') {
        const { data } = await api.get('/admin/stats');
        setStats(data.data);
      } else if (activeTab === 'videos') {
        const { data } = await api.get('/videos', { params: { limit: 100 } });
        setVideos(data.data || []);
      } else if (activeTab === 'users') {
        const { data } = await api.get('/admin/users');
        setUsers(data.data || []);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVideo = async (videoId) => {
    if (!window.confirm('Are you sure you want to delete this video?')) return;
    try {
      await api.delete(`/videos/${videoId}`);
      setVideos((prev) => prev.filter((v) => v._id !== videoId));
    } catch (err) {
      alert('Failed to delete video');
    }
  };

  const handleThumbnailUpdate = async (videoId, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('thumbnail', file);
    setUpdatingThumbnail(videoId);
    try {
      await api.put(`/videos/${videoId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setVideos((prev) =>
        prev.map((v) => (v._id === videoId ? { ...v, thumbnailUrl: URL.createObjectURL(file) } : v))
      );
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update thumbnail');
    } finally {
      setUpdatingThumbnail(null);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user and all their data?')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u._id !== userId));
    } catch (err) {
      alert('Failed to delete user');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const { data } = await api.put(`/admin/users/${userId}/role`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      alert('Failed to update user role');
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'videos', label: 'Videos' },
    { id: 'users', label: 'Users' },
  ];

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h1 className="section-title mb-0">Admin Dashboard</h1>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-800 rounded-lg p-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && stats && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-800 rounded-xl p-6">
                  <p className="text-gray-400 text-sm mb-1">Total Users</p>
                  <p className="text-3xl font-bold">{stats.totalUsers}</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-6">
                  <p className="text-gray-400 text-sm mb-1">Total Videos</p>
                  <p className="text-3xl font-bold">{stats.totalVideos}</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-6">
                  <p className="text-gray-400 text-sm mb-1">Total Comments</p>
                  <p className="text-3xl font-bold">{stats.totalComments}</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-6">
                  <p className="text-gray-400 text-sm mb-1">Total Views</p>
                  <p className="text-3xl font-bold">
                    {stats.totalViews?.toLocaleString() || 0}
                  </p>
                </div>
              </div>

              {/* Categories Breakdown */}
              {stats.videosByCategory?.length > 0 && (
                <div className="bg-gray-800 rounded-xl p-6 mb-8">
                  <h3 className="text-lg font-bold mb-4">Videos by Category</h3>
                  <div className="space-y-3">
                    {stats.videosByCategory.map((cat) => (
                      <div key={cat._id} className="flex items-center justify-between">
                        <span className="text-gray-300">{cat._id}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-32 bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-primary-500 h-2 rounded-full"
                              style={{
                                width: `${(cat.count / stats.totalVideos) * 100}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-400">{cat.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-800 rounded-xl p-6">
                  <h3 className="text-lg font-bold mb-4">Recent Users</h3>
                  <div className="space-y-3">
                    {stats.recentUsers?.map((user) => (
                      <div key={user._id} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{user.username}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                        <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                          {user.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-6">
                  <h3 className="text-lg font-bold mb-4">Recent Videos</h3>
                  <div className="space-y-3">
                    {stats.recentVideos?.map((video) => (
                      <div key={video._id} className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-sm font-medium truncate">{video.title}</p>
                          <p className="text-xs text-gray-500">{video.user?.username}</p>
                        </div>
                        <span className="text-xs text-gray-400">
                          {video.views} views
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Videos Tab */}
          {activeTab === 'videos' && (
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Title</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Category</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Views</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {videos.map((video) => (
                      <tr key={video._id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium truncate max-w-xs">{video.title}</p>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-400">{video.category}</td>
                        <td className="py-3 px-4 text-sm text-gray-400">{video.views}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              video.status === 'ready'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}
                          >
                            {video.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteVideo(video._id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {videos.length === 0 && (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-gray-500">
                          No videos uploaded yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Username</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Email</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Role</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Joined</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user._id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium">{user.username}</p>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-400">{user.email}</td>
                        <td className="py-3 px-4">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user._id, e.target.value)}
                            className="bg-gray-700 text-xs px-2 py-1 rounded border border-gray-600"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="creator">Creator</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-400">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <label className="text-blue-400 hover:text-blue-300 text-sm cursor-pointer mr-3">
                            Change Thumbnail
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => handleThumbnailUpdate(video._id, e.target.files[0])}
                              disabled={updatingThumbnail === video._id}
                            />
                          </label>
                          <button
                            onClick={() => handleDeleteVideo(video._id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Delete
                          </button>
                          {updatingThumbnail === video._id && (
                            <div className="inline-block ml-2 w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-gray-500">
                          No users found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminDashboard;