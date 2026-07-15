const express = require('express');
const router = express.Router();
const {
  deleteComment,
  updateComment,
} = require('../controllers/commentController');
const { protect } = require('../middleware/auth');

// Protected routes
router.delete('/:id', protect, deleteComment);
router.put('/:id', protect, updateComment);

module.exports = router;