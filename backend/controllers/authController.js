const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const { validationResult } = require('express-validator');
const { publishCreatorUpgrade } = require('../utils/notificationService');

/**
 * Generate JWT token and set cookie
 * @param {Object} user - User document
 * @param {Object} res - Express response
 */
const sendTokenResponse = (user, res, statusCode = 200) => {
  const token = user.generateAuthToken();

  const options = {
    expires: new Date(
      Date.now() +
        parseInt(process.env.JWT_COOKIE_EXPIRE) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true, // Cannot be accessed by client-side JS (XSS protection)
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  };

  res.status(statusCode).cookie('token', token, options).json({
    success: true,
    token,
    user: user.toPublicProfile(),
  });
};

/**
 * @desc    Register user
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res, next) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(
        new ErrorResponse(
          errors.array().map((e) => e.msg).join(', '),
          400
        )
      );
    }

    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      return next(
        new ErrorResponse(`User with this ${field} already exists`, 400)
      );
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
    });

    sendTokenResponse(user, res, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(
        new ErrorResponse(
          errors.array().map((e) => e.msg).join(', '),
          400
        )
      );
    }

    const { email, password } = req.body;

    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    sendTokenResponse(user, res);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user / Clear cookie
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = async (req, res, next) => {
  try {
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current logged-in user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate({
        path: 'watchHistory.video',
        select: 'title thumbnailUrl views likes duration category',
      })
      .populate({
        path: 'likedVideos',
        select: 'title thumbnailUrl views likes duration category',
      });

    res.status(200).json({
      success: true,
      user: user.toPublicProfile(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/updatedetails
 * @access  Private
 */
exports.updateDetails = async (req, res, next) => {
  try {
    const fieldsToUpdate = {
      username: req.body.username,
      email: req.body.email,
      avatar: req.body.avatar,
    };

    // Remove undefined fields
    Object.keys(fieldsToUpdate).forEach(
      (key) => fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
    );

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      user: user.toPublicProfile(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update password
 * @route   PUT /api/auth/updatepassword
 * @access  Private
 */
exports.updatePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(req.body.currentPassword);
    if (!isMatch) {
      return next(new ErrorResponse('Current password is incorrect', 401));
    }

    user.password = req.body.newPassword;
    await user.save();

    sendTokenResponse(user, res);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upgrade viewer role to creator
 * @route   PUT /api/auth/become-creator
 * @access  Private (viewer only)
 *
 * Allows a viewer to upgrade their account to creator status.
 * This is a one-way upgrade.
 */
exports.upgradeToCreator = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    if (user.role !== 'viewer') {
      return next(
        new ErrorResponse(
          `Cannot upgrade. Current role is '${user.role}'. Only viewers can become creators.`,
          400
        )
      );
    }

    user.role = 'creator';
    await user.save();

    // Non-blocking notification
    publishCreatorUpgrade(user);

    sendTokenResponse(user, res);
  } catch (error) {
    next(error);
  }
};
