import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const AdminUploadPage = () => {
  const { isAdmin, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    tags: '',
    visibility: 'public',
  });
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const { isCreator } = useAuth();

  if (!isAuthenticated || (!isAdmin && !isCreator)) {
    navigate('/');
    return null;
  }

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
      const formDataObj = new FormData();
      formDataObj.append('video', videoFile);
      if (thumbnailFile) formDataObj.append('thumbnail', thumbnailFile);
      formDataObj.append('title', formData.title);
      formDataObj.append('description', formData.description);
      formDataObj.append('category', formData.category);
      formDataObj.append('tags', formData.tags);
      formDataObj.append('visibility', formData.visibility);

      const { data } = await api.post('/videos', formDataObj, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess(`Video "${data.data.title}" uploaded successfully!`);
      setFormData({
        title: '',
        description: '',
        category: '',
        tags: '',
        visibility: 'public',
      });
      setVideoFile(null);
      setThumbnailFile(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
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

        {/* Thumbnail */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Thumbnail Image
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setThumbnailFile(e.target.files[0])}
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
              Uploading to S3...
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