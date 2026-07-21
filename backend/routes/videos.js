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
  getUploadUrls,
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
  presignValidation,
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

// Presigned URL route (event-driven: creates pending doc, returns presigned URL)
router.post(
  '/presign',
  protect,
  authorize('admin', 'creator'),
  presignValidation,
  getUploadUrls
);

// Protected routes
router.get('/my-videos/list', protect, getMyVideos);
router.post(
  '/',
  protect,
  authorize('admin', 'creator'),
  uploadVideoWithThumbnail,
  uploadVideoValidation,
  uploadVideo
);
router.put(
  '/:id',
  protect,
  authorize('admin', 'creator'),
  uploadVideoWithThumbnail,
  updateVideoValidation,
  updateVideo
);
router.delete('/:id', protect, authorize('admin', 'creator'), deleteVideo);
router.post('/:id/like', protect, toggleLike);
router.post('/:id/watch', protect, addToWatchHistory);

module.exports = router;