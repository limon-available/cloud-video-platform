import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ProfilePage = () => {
  const { user, isAuthenticated, isViewer, isCreator, updateDetails, updatePassword, becomeCreator, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [upgrading, setUpgrading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const handleUpdateDetails = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    try {
      await updateDetails(formData);
      setSuccess('Profile updated successfully');
      setEditing(false);
    } catch (err) {
      // Error handled by context
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return;
    }
    setLoading(true);
    setSuccess('');
    try {
      await updatePassword(passwordData.currentPassword, passwordData.newPassword);
      setSuccess('Password updated successfully');
      setShowPasswordForm(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      // Error handled by context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container max-w-2xl">
      <h1 className="section-title">Profile Settings</h1>

      {success && (
        <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-2 rounded-lg mb-6 text-sm">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-2xl font-bold">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold">{user?.username}</h2>
            <p className="text-gray-400">{user?.email}</p>
            <span className="inline-block bg-primary-600/20 text-primary-400 text-xs px-2 py-0.5 rounded mt-1">
              {user?.role}
            </span>
          </div>
        </div>

        {!editing ? (
          <button onClick={() => setEditing(true)} className="btn-secondary">
            Edit Profile
          </button>
        ) : (
          <form onSubmit={handleUpdateDetails} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div className="flex space-x-3">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Become a Creator - Only for viewers */}
      {isViewer && !isCreator && (
        <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-start space-x-4">
            <div className="text-4xl">🎬</div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-yellow-400 mb-2">
                Become a Creator
              </h3>
              <p className="text-gray-300 mb-4 text-sm">
                Upgrade your account to start uploading and sharing your videos with the world.
              </p>
              <ul className="space-y-2 mb-4">
                <li className="flex items-center text-sm text-gray-300">
                  <span className="text-green-400 mr-2">✓</span>
                  Upload unlimited videos
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <span className="text-green-400 mr-2">✓</span>
                  Manage your video library
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <span className="text-green-400 mr-2">✓</span>
                  Track views and engagement
                </li>
                <li className="flex items-center text-sm text-gray-300">
                  <span className="text-green-400 mr-2">✓</span>
                  Connect with your audience
                </li>
              </ul>
              <button
                onClick={async () => {
                  setUpgrading(true);
                  try {
                    await becomeCreator();
                    setSuccess('Congratulations! You are now a creator.');
                  } catch (err) {
                    // Error handled by context
                  } finally {
                    setUpgrading(false);
                  }
                }}
                disabled={upgrading}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {upgrading ? 'Upgrading...' : 'Upgrade to Creator'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Creator Badge */}
      {isCreator && (
        <div className="bg-gradient-to-r from-primary-900/20 to-purple-900/20 border border-primary-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-center space-x-4">
            <div className="text-4xl">⭐</div>
            <div>
              <h3 className="text-xl font-bold text-primary-400 mb-1">
                Creator Account
              </h3>
              <p className="text-gray-300 text-sm">
                You have full access to upload and manage videos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Password Change */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-bold mb-4">Change Password</h3>

        {!showPasswordForm ? (
          <button onClick={() => setShowPasswordForm(true)} className="btn-secondary">
            Change Password
          </button>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, currentPassword: e.target.value })
                }
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, newPassword: e.target.value })
                }
                className="input-field"
                minLength={6}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                }
                className="input-field"
                required
              />
              {passwordData.newPassword !== passwordData.confirmPassword &&
                passwordData.confirmPassword && (
                  <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                )}
            </div>
            <div className="flex space-x-3">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Updating...' : 'Update Password'}
              </button>
              <button
                type="button"
                onClick={() => setShowPasswordForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;