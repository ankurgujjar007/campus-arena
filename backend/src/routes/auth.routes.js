const express = require('express');
const {
  register,
  login,
  updateUserRoleHandler,
  getUsersHandler
} = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware, (req, res) => {
  res.json({ success: true, data: req.user });
});
router.get('/users', authMiddleware, authorizeRoles('admin'), getUsersHandler);
router.get(
  '/referees',
  authMiddleware,
  authorizeRoles('admin', 'event_manager'),
  async (req, res, next) => {
    try {
      const { getDB } = require('../config/db');
      const referees = await getDB()
        .collection('users')
        .find({ role: 'referee' })
        .project({ passwordHash: 0 })
        .toArray();
      res.json({ success: true, data: referees });
    } catch (error) {
      next(error);
    }
  }
);
router.patch('/users/:id/role', authMiddleware, authorizeRoles('admin'), updateUserRoleHandler);

module.exports = router;
