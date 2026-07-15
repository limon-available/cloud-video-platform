const User = require('../models/User');
const Video = require('../models/Video');
const Comment = require('../models/Comment');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Get all users (admin)
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const users = await User.find()
      .select('-password')
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNumber)
      .lean();

    const total = await User.countDocuments();

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      totalPages: Math.ceil(total / limitNumber),
      currentPage: pageNumber,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single user (admin)
 * @route   GET /api/admin/users/:id
 * @access  Private/Admin
 */
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate({
        path: 'watchHistory.video',
        select: 'title thumbnailUrl views',
      })
      .populate({
        path: 'likedVideos',
        select: 'title thumbnailUrl views',
      })
      .lean();

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user role (admin)
 * @route   PUT /api/admin/users/:id/role
 * @access  Private/Admin
 */
exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;

    if (!role || !['user', 'admin'].includes(role)) {
      return next(new ErrorResponse('Invalid role. Must be user or admin', 400));
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete user (admin)
 * @route   DELETE /api/admin/users/:id
 * @access  Private/Admin
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Delete all user's videos and their S3 objects
    const userVideos = await Video.find({ user: user._id });
    for (const video of userVideos) {
      // Import S3 delete functions
      const { deleteFromS3 } = require('../config/aws');
      if (video.s3VideoKey) await deleteFromS3(video.s3VideoKey);
      if (video.s3ThumbnailKey) await deleteFromS3(video.s3ThumbnailKey);
    }

    // Delete all videos by this user
    await Video.deleteMany({ user: user._id });

    // Delete all comments by this user
    await Comment.deleteMany({ user: user._id });

    // Remove this user from other users' liked videos and watch history
    await User.updateMany(
      { likedVideos: { $in: userVideos.map((v) => v._id) } },
      { $pull: { likedVideos: { $in: userVideos.map((v) => v._id) } } }
    );

    // Delete the user
    await user.remove();

    res.status(200).json({
      success: true,
      message: 'User and all associated data deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get dashboard statistics (admin)
 * @route   GET /api/admin/stats
 * @access  Private/Admin
 */
exports.getStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalVideos = await Video.countDocuments();
    const totalComments = await Comment.countDocuments();
    const totalViews = await Video.aggregate([
      { $group: { _id: null, totalViews: { $sum: '$views' } } },
    ]);

    // Get videos by category
    const videosByCategory = await Video.aggregate([
      { $match: { visibility: 'public' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Get recent users
    const recentUsers = await User.find()
      .select('username email createdAt role')
      .sort('-createdAt')
      .limit(10)
      .lean();

    // Get recent videos
    const recentVideos = await Video.find()
      .populate('user', 'username')
      .sort('-createdAt')
      .limit(10)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalVideos,
        totalComments,
        totalViews: totalViews[0]?.totalViews || 0,
        videosByCategory,
        recentUsers,
        recentVideos,
      },
    });
  } catch (error) {
    next(error);
  }
};