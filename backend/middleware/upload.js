const multer = require('multer');
const ErrorResponse = require('../utils/errorResponse');

/**
 * Multer Configuration for File Uploads
 * 
 * Files are uploaded to memory first, then streamed to S3
 * This enables server-side validation before S3 upload
 */

// Maximum file sizes
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024; // 5MB

// Allowed MIME types
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
];

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
];

// Memory storage
const storage = multer.memoryStorage();

// File filter for videos
const videoFileFilter = (req, file, cb) => {
  if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ErrorResponse(
        `Invalid video type: ${file.mimetype}. Allowed types: MP4, MPEG, MOV, AVI, MKV, WebM`,
        400
      ),
      false
    );
  }
};

// File filter for images
const imageFileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ErrorResponse(
        `Invalid image type: ${file.mimetype}. Allowed types: JPEG, PNG, WebP`,
        400
      ),
      false
    );
  }
};

// Multer instance for video upload
const uploadVideo = multer({
  storage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: MAX_VIDEO_SIZE,
  },
});

// Multer instance for thumbnail upload
const uploadThumbnail = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_THUMBNAIL_SIZE,
  },
});

// Multer instance for both video and thumbnail
const uploadVideoWithThumbnail = multer({
  storage,
  limits: {
    fileSize: MAX_VIDEO_SIZE,
  },
}).fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

module.exports = {
  uploadVideo,
  uploadThumbnail,
  uploadVideoWithThumbnail,
};