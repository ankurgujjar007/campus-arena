const teamService = require('../services/team.service');

const getTeams = async (req, res, next) => {
  try {
    const teams = await teamService.getAllTeams();

    res.status(200).json({
      success: true,
      data: teams
    });
  } catch (error) {
    next(error);
  }
};

const createTeam = async (req, res, next) => {
  try {
    const { name, sport, captainId, players } = req.body;

    if (!name || !sport) {
      return res.status(400).json({
        success: false,
        message: 'Team name and sport are required'
      });
    }

    const team = await teamService.createTeam({
      name,
      sport,
      captainId,
      players
    });

    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: team
    });
  } catch (error) {
    next(error);
  }
};
const getTeamById = async (req, res, next) => {
  try {
    const team = await teamService.getTeamById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    res.status(200).json({
      success: true,
      data: team
    });
  } catch (error) {
    next(error);
  }
};
const searchTeams = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a search keyword'
      });
    }

    const teams = await teamService.searchTeams(q.trim());

    res.status(200).json({
      success: true,
      count: teams.length,
      data: teams
    });
  } catch (error) {
    next(error);
  }
};
// Update team controller
const updateTeam = async (req, res, next) => {
  try {
    const { id } = req.params;

    const team = await teamService.updateTeam(id, req.body);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found or no valid fields provided'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Team updated successfully',
      data: team
    });
  } catch (error) {
    next(error);
  }
};
// Delete team controller
const deleteTeam = async (req, res, next) => {
  try {
    const { id } = req.params;

    const team = await teamService.deleteTeam(id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Team deleted successfully',
      data: team
    });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  getTeams,
  getTeamById,
  createTeam,
  searchTeams,
  updateTeam,
  deleteTeam
};
