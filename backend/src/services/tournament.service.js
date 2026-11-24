const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');

// 1. Create Tournament
const createTournament = async (tournamentData) => {
  const db = getDB();

  const tournament = {
    name: tournamentData.name.trim(),
    sport: tournamentData.sport.trim(),
    venue: tournamentData.venue.trim(),
    startDate: new Date(tournamentData.startDate),
    status: 'upcoming',
    teamIds: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection('tournaments').insertOne(tournament);

  return {
    ...tournament,
    _id: result.insertedId
  };
};

// 2. Get All Tournaments
const getAllTournaments = async () => {
  const db = getDB();

  return await db.collection('tournaments').find({}).sort({ createdAt: -1 }).toArray();
};

// 3. Get Tournament By ID
const getTournamentById = async (tournamentId) => {
  if (!ObjectId.isValid(tournamentId)) {
    return null;
  }

  const db = getDB();

  return await db.collection('tournaments').findOne({
    _id: new ObjectId(tournamentId)
  });
};

// 4. Search Tournaments
const searchTournaments = async (query) => {
  const db = getDB();

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const regex = new RegExp(escapedQuery, 'i');

  return await db
    .collection('tournaments')
    .find({
      $or: [{ name: regex }, { sport: regex }, { venue: regex }, { status: regex }]
    })
    .toArray();
};

// 5. Update Tournament
const updateTournament = async (tournamentId, updateData) => {
  if (!ObjectId.isValid(tournamentId)) {
    return null;
  }

  const db = getDB();

  const allowedFields = ['name', 'sport', 'venue', 'startDate', 'status'];

  const updateFields = {};

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      updateFields[field] = updateData[field];
    }
  });

  if (Object.keys(updateFields).length === 0) {
    return null;
  }

  if (updateFields.name !== undefined) {
    if (typeof updateFields.name !== 'string' || !updateFields.name.trim()) {
      return null;
    }
    updateFields.name = updateFields.name.trim();
  }

  if (updateFields.sport !== undefined) {
    if (typeof updateFields.sport !== 'string' || !updateFields.sport.trim()) {
      return null;
    }
    updateFields.sport = updateFields.sport.trim();
  }

  if (updateFields.venue !== undefined) {
    if (typeof updateFields.venue !== 'string' || !updateFields.venue.trim()) {
      return null;
    }
    updateFields.venue = updateFields.venue.trim();
  }

  if (updateFields.startDate !== undefined) {
    const date = new Date(updateFields.startDate);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    updateFields.startDate = date;
  }

  if (updateFields.status !== undefined) {
    const allowedStatuses = ['upcoming', 'ongoing', 'completed'];

    if (!allowedStatuses.includes(updateFields.status)) {
      return null;
    }
  }

  updateFields.updatedAt = new Date();

  return await db
    .collection('tournaments')
    .findOneAndUpdate(
      { _id: new ObjectId(tournamentId) },
      { $set: updateFields },
      { returnDocument: 'after' }
    );
};

// 6. Delete Tournament
const deleteTournament = async (tournamentId) => {
  if (!ObjectId.isValid(tournamentId)) {
    return null;
  }

  const db = getDB();

  return await db.collection('tournaments').findOneAndDelete({
    _id: new ObjectId(tournamentId)
  });
};

// 7. Register Team in Tournament
const registerTeam = async (tournamentId, teamId) => {
  if (!ObjectId.isValid(tournamentId) || !ObjectId.isValid(teamId)) {
    return null;
  }

  const db = getDB();

  // Find tournament
  const tournament = await db.collection('tournaments').findOne({
    _id: new ObjectId(tournamentId)
  });

  if (!tournament) {
    return null;
  }

  // Find team
  const team = await db.collection('teams').findOne({
    _id: new ObjectId(teamId)
  });

  if (!team) {
    return { error: 'Team not found.' };
  }

  // Check whether both sports match
  if (
    team.sport.toLowerCase() !== 'all sports' &&
    tournament.sport.toLowerCase() !== team.sport.toLowerCase()
  ) {
    return {
      error: 'Team sport does not match tournament sport'
    };
  }

  // Prevent registration in completed tournaments
  if (tournament.status === 'completed') {
    return {
      error: 'Cannot register team in a completed tournament'
    };
  }

  if ((tournament.teamIds || []).some((id) => String(id) === String(team._id))) {
    return { error: 'Team is already registered in this tournament.' };
  }

  // Add team ID to tournament
  const result = await db.collection('tournaments').findOneAndUpdate(
    {
      _id: new ObjectId(tournamentId),
      teamIds: { $ne: new ObjectId(teamId) }
    },
    {
      $addToSet: {
        teamIds: new ObjectId(teamId)
      },
      $set: {
        updatedAt: new Date()
      }
    },
    {
      returnDocument: 'after'
    }
  );

  if (!result) {
    return {
      error: 'Team could not be registered. It may already be registered; refresh and try again.'
    };
  }
  return result;
};

// Register the signed-in player. The username must be set on their profile first.
const registerPlayer = async (
  tournamentId,
  user,
  allowDifferentSport = false,
  selectedTeamId = null,
  lineup = {}
) => {
  if (!ObjectId.isValid(tournamentId) || !ObjectId.isValid(user.id)) return null;
  const db = getDB();
  const tournament = await db
    .collection('tournaments')
    .findOne({ _id: new ObjectId(tournamentId) });
  if (!tournament) return null;
  if (tournament.status === 'completed') return { error: 'Cannot join a completed tournament' };

  const player = await db.collection('players').findOne({ userId: new ObjectId(user.id) });
  if (!player?.username)
    return {
      error: 'Create your player profile and choose a username before joining a tournament'
    };
  if (
    !allowDifferentSport &&
    !(player.interestedSports || []).some(
      (sport) => sport.trim().toLowerCase() === tournament.sport.trim().toLowerCase()
    )
  ) {
    return {
      error: `This tournament is for ${tournament.sport}, which is not listed in your interested sports. Would you like to join anyway?`,
      code: 'SPORT_MISMATCH'
    };
  }

  if (!ObjectId.isValid(selectedTeamId))
    return { error: 'Choose a team to enter this tournament.' };
  const entryTeam = await db.collection('teams').findOne({ _id: new ObjectId(selectedTeamId) });
  const memberships = [...(player.teamIds || []), player.teamId].filter(Boolean).map(String);
  if (!entryTeam || !memberships.includes(String(entryTeam._id)))
    return { error: 'Join the selected team first.' };
  if (
    entryTeam.sport.toLowerCase() !== 'all sports' &&
    entryTeam.sport.toLowerCase() !== tournament.sport.toLowerCase()
  )
    return { error: 'Choose a team that plays the tournament sport.' };
  const defaults = require('../../../shared/sportLineups.json');
  const key =
    /3\s*(v|vs|x)\s*3/i.test(tournament.name) && tournament.sport.toLowerCase() === 'basketball'
      ? 'basketball 3v3'
      : tournament.sport.toLowerCase();
  const rules = tournament.lineupRules || defaults[key];
  if (!rules) return { error: 'An event manager must configure lineupRules for this sport.' };
  const starters = Array.isArray(lineup.starters) ? lineup.starters : [];
  const substitutes = Array.isArray(lineup.substitutes) ? lineup.substitutes : [];
  const ids = [...starters, ...substitutes];
  if (
    starters.length !== rules.starters ||
    substitutes.length > rules.substitutes ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !ObjectId.isValid(id))
  )
    return {
      error: `Select ${rules.starters} starting players and up to ${rules.substitutes} substitutes, without duplicates.`
    };
  if (!starters.includes(lineup.captainId))
    return { error: 'Choose a captain from the starting lineup.' };
  const roster = await db
    .collection('players')
    .find({
      _id: { $in: ids.map((id) => new ObjectId(id)) },
      $or: [{ teamId: entryTeam._id }, { teamIds: entryTeam._id }]
    })
    .toArray();
  if (roster.length !== ids.length)
    return { error: 'Every selected player must belong to this team.' };
  if (String(entryTeam.captainId) !== String(player._id))
    return { error: 'Only the team leader can submit its tournament lineup.' };
  const entryKey = `teamEntries.${entryTeam._id}`;
  const lockedPlayers = [...new Set(roster.map((p) => String(p.userId || p._id)))];
  const result = await db.collection('tournaments').updateOne(
    {
      _id: tournament._id,
      [entryKey]: { $exists: false },
      enteredPlayerIds: { $nin: lockedPlayers }
    },
    {
      $addToSet: {
        playerIds: { $each: roster.filter((p) => p.userId).map((p) => p.userId) },
        teamIds: entryTeam._id,
        enteredPlayerIds: { $each: lockedPlayers }
      },
      $set: {
        [entryKey]: { starters, substitutes, captainId: lineup.captainId },
        ...Object.fromEntries(
          roster.filter((p) => p.userId).map((p) => [`playerTeams.${p.userId}`, entryTeam._id])
        ),
        updatedAt: new Date()
      }
    }
  );
  if (!result.modifiedCount)
    return { error: 'Team already entered, or a selected player has entered with another team.' };
  return await db.collection('tournaments').findOne({ _id: tournament._id });
};

// 8. Get Teams in Tournament
const getTournamentTeams = async (tournamentId) => {
  if (!ObjectId.isValid(tournamentId)) {
    return null;
  }

  const db = getDB();

  const tournament = await db.collection('tournaments').findOne({
    _id: new ObjectId(tournamentId)
  });

  if (!tournament) {
    return null;
  }

  return await db
    .collection('teams')
    .find({
      _id: { $in: tournament.teamIds || [] }
    })
    .toArray();
};

module.exports = {
  createTournament,
  getAllTournaments,
  getTournamentById,
  searchTournaments,
  updateTournament,
  deleteTournament,
  registerTeam,
  registerPlayer,
  getTournamentTeams
};
