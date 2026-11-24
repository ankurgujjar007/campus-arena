const express = require('express');

const {
  createPlayer,
  getPlayers,
  getPlayerById,
  searchPlayers,
  updatePlayer,
  deletePlayer,
  getPlayersByTeam,
  getMyPlayerProfile,
  saveMyPlayerProfile,
  checkUsernameAvailability
} = require('../controllers/player.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();
const authorizeRoles = require('../middleware/role.middleware');

// Search players
router.get('/search', searchPlayers);
router.get('/username-availability', authMiddleware, checkUsernameAvailability);
router.get('/me', authMiddleware, getMyPlayerProfile);
router.put('/me', authMiddleware, saveMyPlayerProfile);

// Get players belonging to a team
router.get('/team/:teamId', getPlayersByTeam);

// Get all players
router.get('/', getPlayers);

// Get player by ID
router.get('/:id', getPlayerById);

// Create player
router.post('/', authMiddleware, authorizeRoles('admin', 'event_manager'), createPlayer);

// Update player
router.put('/:id', authMiddleware, authorizeRoles('admin', 'event_manager'), updatePlayer);

// Delete player
router.delete('/:id', authMiddleware, authorizeRoles('admin', 'event_manager'), deletePlayer);

module.exports = router;
