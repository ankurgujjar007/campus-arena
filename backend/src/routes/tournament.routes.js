const express = require('express');

const {
  createTournament,
  getTournaments,
  getTournamentById,
  searchTournaments,
  updateTournament,
  deleteTournament,
  registerTeam,
  registerPlayer,
  getTournamentTeams
} = require('../controllers/tournament.controller');

const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');

// Search tournaments
router.get('/search', searchTournaments);

// Register team in tournament
router.post(
  '/:id/register',
  authMiddleware,
  authorizeRoles('admin', 'event_manager'),
  registerTeam
);
router.post(
  '/:id/players/register',
  authMiddleware,
  authorizeRoles('player', 'referee'),
  registerPlayer
);

// Get teams in tournament
router.get('/:id/teams', getTournamentTeams);

// Get all tournaments
router.get('/', getTournaments);

// Get tournament by ID
router.get('/:id', getTournamentById);

// Create tournament
router.post('/', authMiddleware, authorizeRoles('admin', 'event_manager'), createTournament);

// Update tournament
router.put('/:id', authMiddleware, authorizeRoles('admin', 'event_manager'), updateTournament);

// Delete tournament
router.delete('/:id', authMiddleware, authorizeRoles('admin', 'event_manager'), deleteTournament);

module.exports = router;
