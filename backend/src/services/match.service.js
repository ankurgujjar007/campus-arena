const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');
const { getRedisClient } = require('../config/redis');

const LIVE_MATCH_KEY = (matchId) => `match:${matchId}:live`;

const makeError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const readLiveState = async (match) => {
  const liveState = await getRedisClient().get(LIVE_MATCH_KEY(String(match._id)));
  if (!liveState) return match;

  try {
    const parsed = JSON.parse(liveState);
    return {
      ...match,
      score: parsed.score,
      status: parsed.status,
      timeline: parsed.timeline || match.timeline || [],
      updatedAt: parsed.updatedAt
    };
  } catch (error) {
    console.error(`Invalid cached live state for match ${match._id}:`, error.message);
    return match;
  }
};

const addTeamNames = async (matches) => {
  if (!matches.length) return matches;

  const teamIds = [
    ...new Set(
      matches
        .flatMap((match) => [match.teamA, match.teamB])
        .filter((id) => id && ObjectId.isValid(String(id)))
        .map((id) => String(id))
    )
  ].map((id) => new ObjectId(id));

  const teams = await getDB()
    .collection('teams')
    .find({ _id: { $in: teamIds } })
    .project({ name: 1 })
    .toArray();
  const namesById = new Map(teams.map((team) => [String(team._id), team.name]));

  return matches.map((match) => ({
    ...match,
    teamAName: namesById.get(String(match.teamA)) || 'Team A',
    teamBName: namesById.get(String(match.teamB)) || 'Team B'
  }));
};

const createMatch = async (payload = {}) => {
  const { tournamentId, teamA, teamB, scheduledAt, refereeId } = payload;

  if (![tournamentId, teamA, teamB].every(ObjectId.isValid)) {
    const error = new Error('Valid tournament and team IDs are required.');
    error.statusCode = 400;
    throw error;
  }

  if (String(teamA).toLowerCase() === String(teamB).toLowerCase()) {
    const error = new Error('A match must have two different teams.');
    error.statusCode = 400;
    throw error;
  }

  let scheduleDate;
  if (scheduledAt !== undefined) {
    scheduleDate = new Date(scheduledAt);
    if (Number.isNaN(scheduleDate.getTime())) {
      const error = new Error('Scheduled date is invalid.');
      error.statusCode = 400;
      throw error;
    }
  }

  const db = getDB();
  const tournamentObjectId = new ObjectId(tournamentId);
  const teamAObjectId = new ObjectId(teamA);
  const teamBObjectId = new ObjectId(teamB);
  const tournament = await db.collection('tournaments').findOne({ _id: tournamentObjectId });

  if (!tournament) {
    const error = new Error('Tournament not found.');
    error.statusCode = 404;
    throw error;
  }

  const registeredTeamIds = (tournament.teamIds || []).map((id) => String(id).toLowerCase());
  if (
    !registeredTeamIds.includes(String(teamA).toLowerCase()) ||
    !registeredTeamIds.includes(String(teamB).toLowerCase())
  ) {
    const error = new Error('Both teams must be registered in the tournament.');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  let refereeObjectId = null;
  if (refereeId) {
    if (!ObjectId.isValid(refereeId)) throw makeError(400, 'Select a valid referee.');
    const referee = await db
      .collection('users')
      .findOne({ _id: new ObjectId(refereeId), role: 'referee' });
    if (!referee) throw makeError(400, 'The selected account is not a referee.');
    refereeObjectId = referee._id;
  }
  const match = {
    tournamentId: tournamentObjectId,
    teamA: teamAObjectId,
    teamB: teamBObjectId,
    status: 'scheduled',
    score: { teamA: 0, teamB: 0 },
    timeline: [
      {
        type: 'scheduled',
        message: 'Match scheduled',
        timestamp: now.toISOString()
      }
    ],
    scheduledAt: scheduleDate || null,
    refereeId: refereeObjectId,
    createdAt: now,
    updatedAt: now
  };

  const result = await db.collection('matches').insertOne(match);
  return { ...match, _id: result.insertedId };
};

const getMatches = async (filters = {}) => {
  const db = getDB();
  const query = {};

  if (filters.tournamentId) {
    if (!ObjectId.isValid(filters.tournamentId)) return [];
    query.tournamentId = new ObjectId(filters.tournamentId);
  }

  const matches = await db
    .collection('matches')
    .find(query)
    .sort({ scheduledAt: 1, createdAt: -1 })
    .toArray();

  const matchesWithLiveState = await Promise.all(matches.map(readLiveState));
  const filteredMatches = filters.status
    ? matchesWithLiveState.filter((match) => match.status === filters.status)
    : matchesWithLiveState;
  return addTeamNames(filteredMatches);
};

const getMatchById = async (matchId) => {
  if (!ObjectId.isValid(matchId)) return null;

  const db = getDB();
  const match = await db.collection('matches').findOne({ _id: new ObjectId(matchId) });
  if (!match) return null;
  const [matchWithLiveState] = await addTeamNames([await readLiveState(match)]);
  return matchWithLiveState;
};

const assignMatchReferee = async (matchId, refereeId) => {
  if (!ObjectId.isValid(matchId)) throw makeError(400, 'Valid match ID is required.');
  const db = getDB(),
    matchObjectId = new ObjectId(matchId);
  const match = await db.collection('matches').findOne({ _id: matchObjectId });
  if (!match) throw makeError(404, 'Match not found.');
  if (refereeId && !ObjectId.isValid(refereeId)) throw makeError(400, 'Select a valid referee.');
  if (refereeId) {
    const referee = await db
      .collection('users')
      .findOne({ _id: new ObjectId(refereeId), role: 'referee' });
    if (!referee) throw makeError(400, 'The selected account is not a referee.');
  }
  await db
    .collection('matches')
    .updateOne(
      { _id: matchObjectId },
      { $set: { refereeId: refereeId ? new ObjectId(refereeId) : null, updatedAt: new Date() } }
    );
  return getMatchById(matchId);
};

const updateLiveMatch = async (matchId, update = {}) => {
  if (!ObjectId.isValid(matchId)) {
    throw makeError(400, 'Valid match ID is required.');
  }

  const { score, status } = update;
  if (
    !score ||
    !Number.isInteger(score.teamA) ||
    score.teamA < 0 ||
    !Number.isInteger(score.teamB) ||
    score.teamB < 0
  ) {
    throw makeError(400, 'Score must contain non-negative integer teamA and teamB values.');
  }

  if (!['live', 'completed', 'cancelled'].includes(status)) {
    throw makeError(400, 'Invalid match status.');
  }

  const db = getDB();
  const objectId = new ObjectId(matchId);
  const match = await db.collection('matches').findOne({ _id: objectId });
  if (!match) throw makeError(404, 'Match not found.');
  const currentState = await readLiveState(match);
  if (currentState.status === 'completed' || currentState.status === 'cancelled') {
    throw makeError(409, 'A completed or cancelled match cannot be updated.');
  }

  const existingTimeline = currentState.timeline || match.timeline || [];
  const now = new Date().toISOString();
  const timelineItem = {
    type: status,
    score: { teamA: score.teamA, teamB: score.teamB },
    message:
      status === 'completed'
        ? `Match finalized: ${score.teamA} - ${score.teamB}`
        : status === 'cancelled'
          ? 'Match cancelled'
          : `Live score update: ${score.teamA} - ${score.teamB}`,
    timestamp: now
  };
  const updatedTimeline = [...existingTimeline, timelineItem];

  const liveState = {
    score: { teamA: score.teamA, teamB: score.teamB },
    status,
    timeline: updatedTimeline,
    updatedAt: now
  };

  await db.collection('matches').updateOne(
    { _id: objectId },
    {
      $set: {
        score: liveState.score,
        status,
        timeline: updatedTimeline,
        updatedAt: new Date(now)
      }
    }
  );

  await getRedisClient().set(LIVE_MATCH_KEY(matchId), JSON.stringify(liveState));

  return { _id: objectId, ...liveState };
};

const recordLiveFoul = async (matchId, foul = {}) => {
  if (!ObjectId.isValid(matchId)) throw makeError(400, 'Valid match ID is required.');
  const db = getDB(),
    objectId = new ObjectId(matchId);
  const match = await db.collection('matches').findOne({ _id: objectId });
  if (!match) throw makeError(404, 'Match not found.');
  const current = await readLiveState(match);
  if (current.status !== 'live')
    throw makeError(409, 'Fouls can only be recorded during a live match.');
  const { teamId, playerId, foulType } = foul;
  if (
    ![String(match.teamA), String(match.teamB)].includes(String(teamId)) ||
    !['Foul', 'Yellow card', 'Red card', 'Penalty'].includes(foulType)
  )
    throw makeError(400, 'Select a valid team and foul type.');
  if (playerId && !ObjectId.isValid(playerId)) throw makeError(400, 'Enter a valid player code.');
  const player = playerId
    ? await db.collection('players').findOne({
        _id: new ObjectId(playerId),
        $or: [{ teamId: new ObjectId(teamId) }, { teamIds: new ObjectId(teamId) }]
      })
    : null;
  if (playerId && !player) throw makeError(400, 'Selected player is not on that team.');
  const team = await db.collection('teams').findOne({ _id: new ObjectId(teamId) });
  const now = new Date().toISOString();
  const timeline = [
    ...(current.timeline || []),
    {
      type: 'foul',
      teamId: String(teamId),
      teamName: team?.name || 'Team',
      playerId: player ? String(player._id) : null,
      playerName: player?.name || null,
      foulType,
      message: `${foulType}${player ? `: ${player.name}` : ''} · ${team?.name || 'Team'}`,
      timestamp: now
    }
  ];
  const state = {
    score: current.score || { teamA: 0, teamB: 0 },
    status: current.status,
    timeline,
    updatedAt: now
  };
  await db
    .collection('matches')
    .updateOne(
      { _id: objectId },
      { $set: { score: state.score, status: state.status, timeline, updatedAt: new Date(now) } }
    );
  await getRedisClient().set(LIVE_MATCH_KEY(matchId), JSON.stringify(state));
  return { _id: objectId, ...state };
};

module.exports = {
  createMatch,
  getMatches,
  getMatchById,
  assignMatchReferee,
  updateLiveMatch,
  recordLiveFoul
};
