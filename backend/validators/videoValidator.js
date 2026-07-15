const { body } = require('express-validator');

exports.uploadVideoValidation = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Video title must be between 3 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Description must be between 1 and 5000 characters'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category cannot exceed 100 characters'),
  body('tags')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Tags cannot exceed 500 characters'),
  body('visibility')
    .optional()
    .isIn(['public', 'private', 'unlisted'])
    .withMessage('Visibility must be public, private, or unlisted'),
];

exports.updateVideoValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Video title must be between 3 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Description must be between 1 and 5000 characters'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category cannot exceed 100 characters'),
  body('visibility')
    .optional()
    .isIn(['public', 'private', 'unlisted'])
    .withMessage('Visibility must be public, private, or unlisted'),
];