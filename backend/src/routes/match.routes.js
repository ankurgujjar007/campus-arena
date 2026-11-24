const express = require('express');
const {
  createMatchHandler,
  getMatchesHandler,
  assignMatchRefereeHandler
} = require('../controllers/match.controller');
const authMiddleware = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');

const router = express.Router();

router.use(authMiddleware);
router.get('/', getMatchesHandler);
router.post('/', authorizeRoles('admin', 'event_manager'), createMatchHandler);
router.patch('/:id/referee', authorizeRoles('admin', 'event_manager'), assignMatchRefereeHandler);

module.exports = router;
