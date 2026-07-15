import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import VideoCard from '../components/VideoCard';

const WatchHistoryPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchHistory();
  }, [isAuthenticated]);

  const fetchHistory = async () => {
    try {
      const { data } = await api.get('/auth/me');
      // Extract video details from watch history
      const historyVideos = (data.user?.watchHistory || [])
        .filter((item) => item.video)
        .map((item) => item.video)
        .reverse();
      setVideos(historyVideos);
    } catch (err) {
      console.error('Fetch history error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 className="section-title">Watch History</h1>

      {videos.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-400 text-lg">No watch history</p>
          <p className="text-gray-500 text-sm mt-1">
            Videos you watch will appear here
          </p>
          <Link to="/" className="btn-primary mt-4 inline-block">
            Browse Videos
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((video) => (
            <VideoCard key={video._id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
};

export default WatchHistoryPage;