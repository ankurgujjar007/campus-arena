const { sendResponse } = require('../utils/response');
const { createMatch, getMatches, assignMatchReferee } = require('../services/match.service');

const createMatchHandler = async (req, res, next) => {
  try {
    const match = await createMatch(req.body);
    return sendResponse(res, 201, true, 'Match created successfully', match);
  } catch (error) {
    return next(error);
  }
};

const getMatchesHandler = async (req, res, next) => {
  try {
    const { tournamentId, status } = req.query;
    const allowedStatuses = ['scheduled', 'live', 'completed', 'cancelled'];

    if (status && !allowedStatuses.includes(status)) {
      return sendResponse(res, 400, false, 'Invalid match status');
    }

    const matches = await getMatches({ tournamentId, status });
    return sendResponse(res, 200, true, 'Matches fetched successfully', matches);
  } catch (error) {
    return next(error);
  }
};

const assignMatchRefereeHandler = async (req, res, next) => {
  try {
    const match = await assignMatchReferee(req.params.id, req.body?.refereeId || null);
    return sendResponse(res, 200, true, 'Match referee assignment updated.', match);
  } catch (error) {
    return next(error);
  }
};

module.exports = { createMatchHandler, getMatchesHandler, assignMatchRefereeHandler };
