const Comment = require('../models/Comment');
const Video = require('../models/Video');
const ErrorResponse = require('../utils/errorResponse');
const { validationResult } = require('express-validator');

/**
 * @desc    Add comment to video
 * @route   POST /api/videos/:videoId/comments
 * @access  Private
 */
exports.addComment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(
        new ErrorResponse(errors.array().map((e) => e.msg).join(', '), 400)
      );
    }

    const { text, parentComment } = req.body;
    const { videoId } = req.params;

    // Check video exists
    const video = await Video.findById(videoId);
    if (!video) {
      return next(new ErrorResponse('Video not found', 404));
    }

    // If replying to a comment, verify parent exists
    if (parentComment) {
      const parent = await Comment.findById(parentComment);
      if (!parent) {
        return next(new ErrorResponse('Parent comment not found', 404));
      }
    }

    const comment = await Comment.create({
      text,
      user: req.user.id,
      video: videoId,
      parentComment: parentComment || null,
    });

    // Populate user data
    await comment.populate('user', 'username avatar');

    res.status(201).json({
      success: true,
      data: comment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get comments for a video
 * @route   GET /api/videos/:videoId/comments
 * @access  Public
 */
exports.getComments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { videoId } = req.params;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Get top-level comments (not replies)
    const comments = await Comment.find({
      video: videoId,
      parentComment: null,
    })
      .populate('user', 'username avatar')
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNumber)
      .lean();

    // Get replies for each comment
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replies = await Comment.find({
          parentComment: comment._id,
        })
          .populate('user', 'username avatar')
          .sort('createdAt')
          .lean();

        return {
          ...comment,
          replies,
        };
      })
    );

    const total = await Comment.countDocuments({
      video: videoId,
      parentComment: null,
    });

    res.status(200).json({
      success: true,
      count: comments.length,
      total,
      totalPages: Math.ceil(total / limitNumber),
      currentPage: pageNumber,
      data: commentsWithReplies,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete comment
 * @route   DELETE /api/comments/:id
 * @access  Private
 */
exports.deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return next(new ErrorResponse('Comment not found', 404));
    }

    // Check ownership or admin
    if (
      comment.user.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return next(
        new ErrorResponse('Not authorized to delete this comment', 403)
      );
    }

    // Delete all replies to this comment
    await Comment.deleteMany({ parentComment: comment._id });

    // Delete the comment
    await Comment.findByIdAndDelete(comment._id);

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update comment
 * @route   PUT /api/comments/:id
 * @access  Private
 */
exports.updateComment = async (req, res, next) => {
  try {
    const { text } = req.body;

    if (!text) {
      return next(new ErrorResponse('Please provide comment text', 400));
    }

    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return next(new ErrorResponse('Comment not found', 404));
    }

    // Only the comment author can update
    if (comment.user.toString() !== req.user.id) {
      return next(
        new ErrorResponse('Not authorized to update this comment', 403)
      );
    }

    comment.text = text;
    await comment.save();

    await comment.populate('user', 'username avatar');

    res.status(200).json({
      success: true,
      data: comment,
    });
  } catch (error) {
    next(error);
  }
};