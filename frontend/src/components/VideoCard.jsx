import { Link } from 'react-router-dom';

const VideoCard = ({ video }) => {
  const formatViews = (views) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views || 0;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  return (
    <Link to={`/watch/${video._id}`} className="card group">
      <div className="relative aspect-video bg-gray-700 overflow-hidden">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}
        {video.duration > 0 && (
          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-0.5 rounded">
            {formatDuration(video.duration)}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-medium text-sm line-clamp-2 mb-1 group-hover:text-primary-400 transition-colors">
          {video.title}
        </h3>
        <p className="text-xs text-gray-400 mb-1">{video.user?.username || 'Unknown'}</p>
        <div className="flex items-center text-xs text-gray-500 space-x-1">
          <span>{formatViews(video.views)} views</span>
          <span>•</span>
          <span>{formatDate(video.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
};

export default VideoCard;