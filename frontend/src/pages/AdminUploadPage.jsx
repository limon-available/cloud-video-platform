import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const AdminUploadPage = () => {
  const { isAdmin, isAuthenticated, isCreator } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    tags: '',
    visibility: 'public',
  });
  const [videoFile, setVideoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [progress, setProgress] = useState('');

  if (!isAuthenticated || (!isAdmin && !isCreator)) {
    navigate('/');
    return null;
  }

  const pollVideoStatus = async (videoId) => {
    return new Promise((resolve, reject) => {
      const maxAttempts = 30;
      let attempts = 0;

      const check = async () => {
        attempts++;
        try {
          const { data } = await api.get(`/videos/${videoId}`);
          if (data.data.status === 'ready') {
            resolve(data.data);
          } else if (data.data.status === 'failed') {
            reject(new Error('Video processing failed'));
          } else if (attempts >= maxAttempts) {
            reject(new Error('Processing timeout'));
          } else {
            setTimeout(check, 2000);
          }
        } catch (err) {
          reject(err);
        }
      };
      check();
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!videoFile) {
      setError('Please select a video file');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Step 1: Request presigned URL + create pending MongoDB doc
      setProgress('Requesting upload URL...');
      const { data: presignData } = await api.post('/videos/presign', {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        tags: formData.tags,
        visibility: formData.visibility,
        videoFileName: videoFile.name,
        videoContentType: videoFile.type,
      });

      const { videoId, video } = presignData.data;

      // Step 2: Upload video directly to S3 via presigned URL
      setProgress('Uploading video to S3...');
      await fetch(video.url, {
        method: 'PUT',
        headers: {
          'Content-Type': videoFile.type,
          'x-amz-server-side-encryption': 'AES256',
        },
        body: videoFile,
      });

      // Step 3: Poll until Lambda processes and status becomes "ready"
      setProgress('Processing video (generating thumbnail, extracting duration)...');
      const processedVideo = await pollVideoStatus(videoId);

      setSuccess(`Video "${processedVideo.title}" published successfully!`);
      setFormData({
        title: '',
        description: '',
        category: '',
        tags: '',
        visibility: 'public',
      });
      setVideoFile(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress('');
    }
  };

  return (
    <div className="page-container max-w-2xl">
      <h1 className="section-title">Upload Video</h1>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-2 rounded-lg mb-6 text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 space-y-5">
        {/* Video File */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Video File *
          </label>
          <input
            type="file"
            accept="video/mp4,video/mpeg,video/quicktime,video/webm"
            onChange={(e) => setVideoFile(e.target.files[0])}
            className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-600 file:text-white hover:file:bg-primary-700"
          />
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="input-field"
            placeholder="Enter video title"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="input-field h-32 resize-none"
            placeholder="Enter video description"
            required
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Category
          </label>
          <input
            type="text"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="input-field"
            placeholder="e.g., Education, Entertainment, Music"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            className="input-field"
            placeholder="e.g., tutorial, javascript, coding"
          />
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Visibility
          </label>
          <select
            value={formData.visibility}
            onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
            className="input-field"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="unlisted">Unlisted</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="btn-primary w-full"
        >
          {uploading ? (
            <span className="flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
              {progress || 'Uploading...'}
            </span>
          ) : (
            'Upload Video'
          )}
        </button>
      </form>
    </div>
  );
};

export default AdminUploadPage;