import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import VideoCard from '../components/VideoCard';

const CreatorStudio = () => {
  const { isAuthenticated, isCreator, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalVideos: 0,
    totalViews: 0,
    totalLikes: 0,
  });

  if (!isAuthenticated || (!isCreator && !isAdmin)) {
    navigate('/');
    return null;
  }

  useEffect(() => {
    fetchMyVideos();
  }, []);

  const fetchMyVideos = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/videos/my-videos/list');

      if (data.success) {
        setVideos(data.data || []);
        const totalViews = (data.data || []).reduce((sum, v) => sum + (v.views || 0), 0);
        const totalLikes = (data.data || []).reduce((sum, v) => sum + (v.likes || 0), 0);
        setStats({
          totalVideos: data.data?.length || 0,
          totalViews,
          totalLikes,
        });
      }
    } catch (err) {
      console.error('Fetch my videos error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (videoId) => {
    if (!window.confirm('Are you sure you want to delete this video?')) return;

    try {
      await api.delete(`/videos/${videoId}`);
      setVideos((prev) => prev.filter((v) => v._id !== videoId));
      setStats((prev) => ({
        ...prev,
        totalVideos: prev.totalVideos - 1,
      }));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete video');
    }
  };

  return (
    <div className="page-container max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="section-title mb-0">Creator Studio</h1>
        {isCreator && (
          <Link to="/studio/upload" className="btn-primary">
            + Upload Video
          </Link>
        )}
        {isAdmin && (
          <Link to="/admin/upload" className="btn-primary">
            + Upload Video (Admin)
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm mb-1">Total Videos</p>
          <p className="text-3xl font-bold">{stats.totalVideos}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm mb-1">Total Views</p>
          <p className="text-3xl font-bold">{stats.totalViews.toLocaleString()}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm mb-1">Total Likes</p>
          <p className="text-3xl font-bold">{stats.totalLikes.toLocaleString()}</p>
        </div>
      </div>

      {/* Videos List */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">My Videos</h2>
      </div>

      {loading ? (
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="spinner"></div>
        </div>
      ) : videos.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400 text-lg mb-4">You haven't uploaded any videos yet.</p>
          <Link to="/admin/upload" className="btn-primary">
            Upload Your First Video
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {videos.map((video) => (
            <div
              key={video._id}
              className="bg-gray-800 rounded-xl p-4 flex flex-col sm:flex-row gap-4"
            >
              <div className="sm:w-64 flex-shrink-0">
                <img
                  src={video.thumbnailUrl || '/placeholder.jpg'}
                  alt={video.title}
                  className="w-full aspect-video object-cover rounded-lg"
                />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-2">{video.title}</h3>
                <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                  {video.description}
                </p>
                <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                  <span>👁️ {video.views || 0} views</span>
                  <span>❤️ {video.likes || 0} likes</span>
                  <span>📅 {new Date(video.createdAt).toLocaleDateString()}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    video.status === 'ready'
                      ? 'bg-green-500/20 text-green-400'
                      : video.status === 'processing'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {video.status || 'unknown'}
                  </span>
                </div>
              </div>
              <div className="flex sm:flex-col gap-2 sm:w-32">
                <Link
                  to={`/watch/${video._id}`}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm text-center transition-colors"
                >
                  View
                </Link>
                <button
                  onClick={() => handleDelete(video._id)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CreatorStudio;