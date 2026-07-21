const Video = require('../models/Video');
const User = require('../models/User');
const Comment = require('../models/Comment');
const ErrorResponse = require('../utils/errorResponse');
const {
  uploadToS3,
  getPresignedUploadUrl,
  deleteFromS3,
  getVideoKey,
  getThumbnailKey,
  getCloudFrontSignedUrl,
} = require('../config/aws');
const { validationResult } = require('express-validator');
const {
  publishVideoUploaded,
  publishVideoFailed,
  publishVideoDeleted,
} = require('../utils/notificationService');
const {
  logUploadSuccess,
  logUploadFailure,
} = require('../utils/cloudwatchLogger');

/**
 * @desc    Upload a video
 * @route   POST /api/videos
 * @access  Private/Admin
 * 
 * Architecture Flow:
 * 1. User uploads video file and thumbnail via React frontend
 * 2. Express receives files via multer middleware
 * 3. Video and thumbnail are uploaded to S3 bucket
 * 4. CloudFront URL is generated for CDN delivery
 * 5. Video metadata is saved to MongoDB Atlas
 * 6. Response includes CloudFront URLs for playback
 */
exports.uploadVideo = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(
        new ErrorResponse(errors.array().map((e) => e.msg).join(', '), 400)
      );
    }

    const { title, description, category, tags, visibility } = req.body;

    // Check if files exist
    if (!req.files || !req.files.video) {
      return next(new ErrorResponse('Please upload a video file', 400));
    }

    const videoFile = req.files.video[0];
    const thumbnailFile = req.files.thumbnail ? req.files.thumbnail[0] : null;

    // Generate S3 keys
    const videoKey = getVideoKey(req.user.id, videoFile.originalname);
    let thumbnailKey = '';

    // Upload video to S3
    const videoUploadResult = await uploadToS3(
      videoFile.buffer,
      videoKey,
      videoFile.mimetype,
      'private'
    );

    // Upload thumbnail to S3 if provided
    if (thumbnailFile) {
      thumbnailKey = getThumbnailKey(req.user.id, thumbnailFile.originalname);
      await uploadToS3(
        thumbnailFile.buffer,
        thumbnailKey,
        thumbnailFile.mimetype,
        'private'
      );
    }

    // Generate CloudFront URLs
    const videoUrl = getCloudFrontSignedUrl(videoKey);
    const thumbnailUrl = thumbnailKey
      ? getCloudFrontSignedUrl(thumbnailKey)
      : '';

    // Parse tags
    const parsedTags = tags
      ? tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : [];

    // Create video document in MongoDB
    const video = await Video.create({
      title,
      description,
      thumbnailUrl,
      videoUrl,
      s3VideoKey: videoKey,
      s3ThumbnailKey: thumbnailKey,
      category: category || 'Uncategorized',
      tags: parsedTags,
      visibility: visibility || 'public',
      status: 'processing',
      user: req.user.id,
      uploadedBy: req.user.role,
    });

    res.status(201).json({
      success: true,
      data: video,
    });
  } catch (error) {
    next(error);
  }
};

// Allowed MIME types for presigned direct uploads (mirrors middleware/upload.js)
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

/**
 * @desc    Generate presigned S3 URLs and create pending video document
 * @route   POST /api/videos/presign
 * @access  Private/Creator/Admin
 *
 * Architecture Flow (fully event-driven):
 * 1. Creator/Admin provides metadata + filenames
 * 2. Backend generates presigned URL, creates pending MongoDB doc
 * 3. Frontend uploads directly to S3
 * 4. S3 ObjectCreated → Lambda → processes, publishes, logs
 */
exports.getUploadUrls = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(
        new ErrorResponse(errors.array().map((e) => e.msg).join(', '), 400)
      );
    }

    const {
      title,
      description,
      category,
      tags,
      visibility,
      videoFileName,
      videoContentType,
    } = req.body;

    if (!ALLOWED_VIDEO_TYPES.includes(videoContentType)) {
      return next(
        new ErrorResponse(
          `Invalid video type: ${videoContentType}. Allowed types: MP4, MPEG, MOV, AVI, MKV, WebM`,
          400
        )
      );
    }

    // Generate server-owned S3 key for the video
    const videoKey = getVideoKey(req.user.id, videoFileName);
    const presigned = await getPresignedUploadUrl(videoKey, videoContentType);

    // Parse tags
    const parsedTags = tags
      ? tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : [];

    // Create pending video document in MongoDB (status: pending)
    const video = await Video.create({
      title,
      description,
      s3VideoKey: videoKey,
      category: category || 'Uncategorized',
      tags: parsedTags,
      visibility: visibility || 'public',
      status: 'pending',
      user: req.user.id,
      uploadedBy: req.user.role,
    });

    res.status(200).json({
      success: true,
      data: {
        videoId: video._id,
        video: {
          key: videoKey,
          url: presigned.url,
          headers: presigned.headers,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all videos (with pagination, filtering, search)
 * @route   GET /api/videos
 * @access  Public
 */
exports.getVideos = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      sort = '-createdAt',
    } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Build query
    let query = { visibility: 'public', status: 'ready' };

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    // Build sort object
    let sortObj = {};
    if (sort.startsWith('-')) {
      sortObj[sort.substring(1)] = -1;
    } else {
      sortObj[sort] = 1;
    }

    const videos = await Video.find(query)
      .populate('user', 'username avatar')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNumber)
      .lean();

    const total = await Video.countDocuments(query);

    res.status(200).json({
      success: true,
      count: videos.length,
      total,
      totalPages: Math.ceil(total / limitNumber),
      currentPage: pageNumber,
      data: videos,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single video by ID
 * @route   GET /api/videos/:id
 * @access  Public
 */
exports.getVideo = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id)
      .populate('user', 'username avatar')
      .lean();

    if (!video) {
      return next(new ErrorResponse('Video not found', 404));
    }

    // Check visibility
    if (
      video.visibility === 'private' &&
      (!req.user || req.user.id !== video.user._id.toString())
    ) {
      return next(new ErrorResponse('Video not found', 404));
    }

    // Increment view count
    await Video.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

    // Fetch comments for this video
    const comments = await Comment.find({ video: req.params.id })
      .populate('user', 'username avatar')
      .sort('-createdAt')
      .lean();

    res.status(200).json({
      success: true,
      data: {
        ...video,
        views: video.views + 1,
        comments,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update video
 * @route   PUT /api/videos/:id
 * @access  Private/Admin
 */
exports.updateVideo = async (req, res, next) => {
  try {
    let video = await Video.findById(req.params.id);

    if (!video) {
      return next(new ErrorResponse('Video not found', 404));
    }

    // Check ownership or admin
    if (
      video.user.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return next(
        new ErrorResponse('Not authorized to update this video', 403)
      );
    }

    const { title, description, category, tags, visibility } = req.body;

    // Handle thumbnail update if new file provided
    if (req.files && req.files.thumbnail) {
      // Delete old thumbnail from S3
      if (video.s3ThumbnailKey) {
        await deleteFromS3(video.s3ThumbnailKey);
      }

      // Upload new thumbnail
      const thumbnailFile = req.files.thumbnail[0];
      const thumbnailKey = getThumbnailKey(
        req.user.id,
        thumbnailFile.originalname
      );
      await uploadToS3(
        thumbnailFile.buffer,
        thumbnailKey,
        thumbnailFile.mimetype,
        'private'
      );

      video.s3ThumbnailKey = thumbnailKey;
      video.thumbnailUrl = getCloudFrontSignedUrl(thumbnailKey);
    }

    // Parse tags
    const parsedTags = tags
      ? tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : video.tags;

    // Update fields
    video.title = title || video.title;
    video.description = description || video.description;
    video.category = category || video.category;
    video.tags = parsedTags;
    video.visibility = visibility || video.visibility;

    await video.save();

    res.status(200).json({
      success: true,
      data: video,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete video
 * @route   DELETE /api/videos/:id
 * @access  Private/Admin
 */
exports.deleteVideo = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return next(new ErrorResponse('Video not found', 404));
    }

    // Check ownership or admin
    if (
      video.user.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return next(
        new ErrorResponse('Not authorized to delete this video', 403)
      );
    }

    // Delete video from S3
    await deleteFromS3(video.s3VideoKey);

    // Delete thumbnail from S3 if exists
    if (video.s3ThumbnailKey) {
      await deleteFromS3(video.s3ThumbnailKey);
    }

    // Delete all comments for this video
    await Comment.deleteMany({ video: video._id });

    // Remove video from users' liked videos and watch history
    await User.updateMany(
      { likedVideos: video._id },
      { $pull: { likedVideos: video._id } }
    );
    await User.updateMany(
      { 'watchHistory.video': video._id },
      { $pull: { watchHistory: { video: video._id } } }
    );

    // Delete video document
    await video.remove();

    // Non-blocking notification
    publishVideoDeleted(video, req.user);

    res.status(200).json({
      success: true,
      message: 'Video deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Like/unlike a video
 * @route   POST /api/videos/:id/like
 * @access  Private
 */
exports.toggleLike = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return next(new ErrorResponse('Video not found', 404));
    }

    const user = await User.findById(req.user.id);
    const isLiked = user.likedVideos.includes(video._id);

    if (isLiked) {
      // Unlike
      user.likedVideos.pull(video._id);
      await video.decrementLikes();
      await user.save();

      res.status(200).json({
        success: true,
        liked: false,
        likes: video.likes,
      });
    } else {
      // Like
      user.likedVideos.push(video._id);
      await video.incrementLikes();
      await user.save();

      res.status(200).json({
        success: true,
        liked: true,
        likes: video.likes,
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add video to watch history
 * @route   POST /api/videos/:id/watch
 * @access  Private
 */
exports.addToWatchHistory = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return next(new ErrorResponse('Video not found', 404));
    }

    const user = await User.findById(req.user.id);

    // Check if already in history, update timestamp
    const existingIndex = user.watchHistory.findIndex(
      (item) => item.video.toString() === req.params.id
    );

    if (existingIndex > -1) {
      user.watchHistory[existingIndex].watchedAt = new Date();
    } else {
      user.watchHistory.push({
        video: video._id,
        watchedAt: new Date(),
      });
    }

    // Keep only last 200 entries
    if (user.watchHistory.length > 200) {
      user.watchHistory = user.watchHistory.slice(-200);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Added to watch history',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get videos by user (admin dashboard)
 * @route   GET /api/videos/my-videos
 * @access  Private
 */
exports.getMyVideos = async (req, res, next) => {
  try {
    const videos = await Video.find({ user: req.user.id })
      .sort('-createdAt')
      .lean();

    res.status(200).json({
      success: true,
      count: videos.length,
      data: videos,
    });
  } catch (error) {
    next(error);
  }
};