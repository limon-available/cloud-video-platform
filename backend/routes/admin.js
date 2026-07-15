const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUser,
  updateUserRole,
  deleteUser,
  getStats,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(protect, authorize('admin'));

router.get('/stats', getStats);
router.get('/users', getUsers);
router.get('/users/:id', getUser);
router.put('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

module.exports = router;