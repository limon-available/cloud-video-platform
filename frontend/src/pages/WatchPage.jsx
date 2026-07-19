import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import VideoCard from '../components/VideoCard';

const WatchPage = () => {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [video, setVideo] = useState(null);
  const [relatedVideos, setRelatedVideos] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchVideo();
    window.scrollTo(0, 0);
  }, [id]);

  const fetchVideo = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get(`/videos/${id}`);
      setVideo(data.data);
      setComments(data.data.comments || []);

      // Check if liked
      if (user && user.likedVideos) {
        setLiked(user.likedVideos.includes(id));
      }

      // Fetch related videos
      const relatedRes = await api.get('/videos', {
        params: { category: data.data.category, limit: 8 },
      });
      setRelatedVideos(
        (relatedRes.data.data || []).filter((v) => v._id !== id)
      );

      // Add to watch history
      if (isAuthenticated) {
        await api.post(`/videos/${id}/watch`).catch(() => {});
      }
    } catch (err) {
      setError('Failed to load video');
      console.error('Fetch video error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!isAuthenticated) return;
    try {
      const { data } = await api.post(`/videos/${id}/like`);
      setLiked(data.liked);
      setVideo((prev) => ({ ...prev, likes: data.likes }));
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const { data } = await api.post(`/videos/${id}/comments`, {
        text: newComment.trim(),
      });
      setComments((prev) => [data.data, ...prev]);
      setNewComment('');
    } catch (err) {
      console.error('Comment error:', err);
    }
  };

  const formatViews = (views) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views || 0;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="page-container text-center py-20">
        <p className="text-red-400 text-xl mb-4">{error || 'Video not found'}</p>
        <Link to="/" className="btn-primary">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content */}
        <div className="flex-1">
          {/* Video Player */}
          <div className="bg-black rounded-xl overflow-hidden mb-4">
            {video.videoUrl ? (
              <video
                controls
                autoPlay
                className="w-full aspect-video"
                poster={video.thumbnailUrl}
              >
                <source src={video.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="w-full aspect-video bg-gray-800 flex items-center justify-center">
                <p className="text-gray-400">Video URL not available</p>
              </div>
            )}
          </div>

          {/* Video Info */}
          <div className="mb-6">
            <h1 className="text-xl font-bold mb-2">{video.title}</h1>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-4 text-sm text-gray-400">
                <span>{formatViews(video.views)} views</span>
                <span>•</span>
                <span>{formatDate(video.createdAt)}</span>
              </div>

              <div className="flex items-center space-x-4">
                {/* Like Button */}
                {isAuthenticated ? (
                  <button
                    onClick={handleLike}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      liked
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <svg className="w-5 h-5" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    <span>{video.likes || 0}</span>
                  </button>
                ) : (
                  <div className="relative group">
                    <button
                      disabled
                      className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-500 cursor-not-allowed"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                      </svg>
                      <span>{video.likes || 0}</span>
                    </button>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-gray-700">
                      Login to like this video
                    </div>
                  </div>
                )}

                {/* Share Button */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Link copied to clipboard!');
                  }}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-gray-800 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-300 whitespace-pre-wrap">
              {video.description}
            </p>
            {video.tags && video.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {video.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-xs bg-gray-700 text-primary-400 px-2 py-1 rounded"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div className="mb-6">
            <h2 className="text-lg font-bold mb-4">
              Comments ({comments.length})
            </h2>

            {isAuthenticated ? (
              <form onSubmit={handleComment} className="flex space-x-3 mb-6">
                <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    rows="3"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="submit"
                      disabled={!newComment.trim()}
                      className="btn-primary text-sm"
                    >
                      Comment
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="bg-gray-800 rounded-xl p-4 text-center mb-6">
                <p className="text-gray-400">
                  <Link to="/login" className="text-primary-400 hover:underline">
                    Sign in
                  </Link>{' '}
                  to leave a comment
                </p>
              </div>
            )}

            {/* Comments List */}
            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No comments yet. Be the first to comment!
                </p>
              ) : (
                comments.map((comment) => (
                  <div key={comment._id} className="flex space-x-3">
                    <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm">
                      {comment.user?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">
                          {comment.user?.username || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 mt-1">
                        {comment.text}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Related Videos Sidebar */}
        <div className="w-full lg:w-80">
          <h2 className="text-lg font-bold mb-4">Related Videos</h2>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
            {relatedVideos.slice(0, 8).map((v) => (
              <VideoCard key={v._id} video={v} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WatchPage;