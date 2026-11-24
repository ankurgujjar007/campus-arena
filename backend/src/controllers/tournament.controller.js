const tournamentService = require('../services/tournament.service');

// 1. Create Tournament
const createTournament = async (req, res, next) => {
  try {
    const { name, sport, venue, startDate } = req.body;

    if (!name || !sport || !venue || !startDate) {
      return res.status(400).json({
        success: false,
        message: 'All tournament fields are required'
      });
    }

    if (
      typeof name !== 'string' ||
      typeof sport !== 'string' ||
      typeof venue !== 'string' ||
      Number.isNaN(new Date(startDate).getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament details'
      });
    }

    const tournament = await tournamentService.createTournament(req.body);

    res.status(201).json({
      success: true,
      message: 'Tournament created successfully',
      data: tournament
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get All Tournaments
const getTournaments = async (req, res, next) => {
  try {
    const tournaments = await tournamentService.getAllTournaments();

    res.status(200).json({
      success: true,
      count: tournaments.length,
      data: tournaments
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get Tournament By ID
const getTournamentById = async (req, res, next) => {
  try {
    const tournament = await tournamentService.getTournamentById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    res.status(200).json({
      success: true,
      data: tournament
    });
  } catch (error) {
    next(error);
  }
};

// 4. Search Tournaments
const searchTournaments = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a search keyword'
      });
    }

    const tournaments = await tournamentService.searchTournaments(q.trim());

    res.status(200).json({
      success: true,
      count: tournaments.length,
      data: tournaments
    });
  } catch (error) {
    next(error);
  }
};

// 5. Update Tournament
const updateTournament = async (req, res, next) => {
  try {
    const tournament = await tournamentService.updateTournament(req.params.id, req.body);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found or invalid update data'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Tournament updated successfully',
      data: tournament
    });
  } catch (error) {
    next(error);
  }
};

// 6. Delete Tournament
const deleteTournament = async (req, res, next) => {
  try {
    const tournament = await tournamentService.deleteTournament(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Tournament deleted successfully',
      data: tournament
    });
  } catch (error) {
    next(error);
  }
};

// 7. Register Team
const registerTeam = async (req, res, next) => {
  try {
    const { teamId } = req.body;

    if (!teamId) {
      return res.status(400).json({
        success: false,
        message: 'Team ID is required'
      });
    }

    const result = await tournamentService.registerTeam(req.params.id, teamId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Tournament or team not found, or invalid ID'
      });
    }

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.status(200).json({
      success: true,
      message: 'Team registered successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const registerPlayer = async (req, res, next) => {
  try {
    const result = await tournamentService.registerPlayer(
      req.params.id,
      req.user,
      req.body?.allowDifferentSport === true,
      req.body?.teamId,
      req.body?.lineup
    );
    if (!result) {
      return res
        .status(404)
        .json({ success: false, message: 'Tournament not found or invalid ID' });
    }
    if (result.error) {
      return res.status(400).json({ success: false, message: result.error, code: result.code });
    }
    return res
      .status(200)
      .json({ success: true, message: 'You joined the tournament', data: result });
  } catch (error) {
    return next(error);
  }
};

// 8. Get Teams in Tournament
const getTournamentTeams = async (req, res, next) => {
  try {
    const teams = await tournamentService.getTournamentTeams(req.params.id);

    if (!teams) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    res.status(200).json({
      success: true,
      count: teams.length,
      data: teams
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTournament,
  getTournaments,
  getTournamentById,
  searchTournaments,
  updateTournament,
  deleteTournament,
  registerTeam,
  registerPlayer,
  getTournamentTeams
};
