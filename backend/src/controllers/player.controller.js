const playerService = require('../services/player.service');

// 1. Create Player
const createPlayer = async (req, res, next) => {
  try {
    const { name, email, jerseyNumber, sport, teamId } = req.body;

    if (!name || !email || jerseyNumber === undefined || !sport || !teamId) {
      return res.status(400).json({
        success: false,
        message: 'All player fields are required'
      });
    }

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof sport !== 'string' ||
      !Number.isInteger(Number(jerseyNumber)) ||
      Number(jerseyNumber) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid player details'
      });
    }

    const player = await playerService.createPlayer(req.body);

    if (!player) {
      return res.status(400).json({
        success: false,
        message: 'Invalid team ID or team does not exist'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Player created successfully',
      data: player
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get All Players
const getPlayers = async (req, res, next) => {
  try {
    const players = await playerService.getAllPlayers();

    res.status(200).json({
      success: true,
      count: players.length,
      data: players
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get Player By ID
const getPlayerById = async (req, res, next) => {
  try {
    const player = await playerService.getPlayerById(req.params.id);

    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    res.status(200).json({
      success: true,
      data: player
    });
  } catch (error) {
    next(error);
  }
};

// 4. Search Players
const searchPlayers = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a search keyword'
      });
    }

    const players = await playerService.searchPlayers(q.trim());

    res.status(200).json({
      success: true,
      count: players.length,
      data: players
    });
  } catch (error) {
    next(error);
  }
};

// 5. Update Player
const updatePlayer = async (req, res, next) => {
  try {
    const player = await playerService.updatePlayer(req.params.id, req.body);

    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found or invalid update data'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Player updated successfully',
      data: player
    });
  } catch (error) {
    next(error);
  }
};

// 6. Delete Player
const deletePlayer = async (req, res, next) => {
  try {
    const player = await playerService.deletePlayer(req.params.id);

    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Player deleted successfully',
      data: player
    });
  } catch (error) {
    next(error);
  }
};

// 7. Get Players By Team
const getPlayersByTeam = async (req, res, next) => {
  try {
    const players = await playerService.getPlayersByTeam(req.params.teamId);

    if (!players) {
      return res.status(404).json({
        success: false,
        message: 'Team not found or invalid team ID'
      });
    }

    res.status(200).json({
      success: true,
      count: players.length,
      data: players
    });
  } catch (error) {
    next(error);
  }
};

const getMyPlayerProfile = async (req, res, next) => {
  try {
    const profile = await playerService.getMyPlayerProfile(req.user);
    return res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    return next(error);
  }
};

const saveMyPlayerProfile = async (req, res, next) => {
  try {
    const profile = await playerService.saveMyPlayerProfile(req.user, req.body || {});
    return res.status(200).json({
      success: true,
      message: 'Player profile saved successfully.',
      data: profile
    });
  } catch (error) {
    return next(error);
  }
};

const checkUsernameAvailability = async (req, res, next) => {
  try {
    const result = await playerService.checkUsernameAvailability(req.user, req.query.username);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
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
};
