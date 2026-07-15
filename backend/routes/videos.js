const express = require('express');
const router = express.Router();
const {
  uploadVideo,
  getVideos,
  getVideo,
  updateVideo,
  deleteVideo,
  toggleLike,
  addToWatchHistory,
  getMyVideos,
} = require('../controllers/videoController');
const {
  addComment,
  getComments,
} = require('../controllers/commentController');
const { protect, authorize } = require('../middleware/auth');
const { uploadVideoWithThumbnail } = require('../middleware/upload');
const {
  uploadVideoValidation,
  updateVideoValidation,
} = require('../validators/videoValidator');
const { body } = require('express-validator');

// Public routes
router.get('/', getVideos);
router.get('/:id', getVideo);

// Comment routes (nested under videos)
router.get('/:videoId/comments', getComments);
router.post(
  '/:videoId/comments',
  protect,
  [
    body('text')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Comment must be between 1 and 1000 characters'),
  ],
  addComment
);

// Protected routes
router.get('/my-videos/list', protect, getMyVideos);
router.post(
  '/',
  protect,
  authorize('admin'),
  uploadVideoWithThumbnail,
  uploadVideoValidation,
  uploadVideo
);
router.put(
  '/:id',
  protect,
  authorize('admin'),
  uploadVideoWithThumbnail,
  updateVideoValidation,
  updateVideo
);
router.delete('/:id', protect, authorize('admin'), deleteVideo);
router.post('/:id/like', protect, toggleLike);
router.post('/:id/watch', protect, addToWatchHistory);

module.exports = router;