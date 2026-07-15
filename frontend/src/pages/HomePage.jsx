import { useState, useEffect } from 'react';
import api from '../api/axios';
import VideoCard from '../components/VideoCard';

const HomePage = () => {
  const [videos, setVideos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchVideos();
  }, [selectedCategory, page]);

  // Fetch new videos every 30 seconds for demo (simulating CloudFront updates)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) fetchVideos();
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedCategory, page, loading]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, limit: 20 };
      if (selectedCategory) params.category = selectedCategory;
      
      const { data } = await api.get('/videos', { params });
      setVideos(data.data || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError('Failed to load videos. Please try again.');
      console.error('Fetch videos error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/videos', { params: { limit: 100 } });
      const cats = [...new Set((data.data || []).map((v) => v.category).filter(Boolean))];
      setCategories(cats);
    } catch (err) {
      console.error('Fetch categories error:', err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return (
    <div className="page-container">
      {/* Hero Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Welcome to CloudVideo</h1>
        <p className="text-gray-400">
          Discover and stream videos powered by AWS Cloud Infrastructure
        </p>
      </div>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !selectedCategory
                ? 'bg-primary-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* Video Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="spinner"></div>
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={fetchVideos} className="btn-primary">
            Try Again
          </button>
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-400 text-lg">No videos found</p>
          <p className="text-gray-500 text-sm mt-1">Try a different category or check back later</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {videos.map((video) => (
              <VideoCard key={video._id} video={video} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-4 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HomePage;