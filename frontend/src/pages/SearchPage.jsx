import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import VideoCard from '../components/VideoCard';

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (query) {
      searchVideos();
    }
  }, [query]);

  const searchVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/videos', {
        params: { search: query, limit: 50 },
      });
      setVideos(data.data || []);
    } catch (err) {
      setError('Search failed. Please try again.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          Search results for "{query}"
        </h1>
        <p className="text-gray-400 mt-1">
          {videos.length} video{videos.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="spinner"></div>
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={searchVideos} className="btn-primary">
            Try Again
          </button>
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-gray-400 text-lg">No videos found</p>
          <p className="text-gray-500 text-sm mt-1">
            Try different keywords or check your spelling
          </p>
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

export default SearchPage;