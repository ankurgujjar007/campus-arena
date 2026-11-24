const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_]{2,19}$/;

// 1. Create Player
const createPlayer = async (playerData) => {
  const db = getDB();

  const { name, email, jerseyNumber, sport, teamId } = playerData;

  // Validate team ID
  if (!ObjectId.isValid(teamId)) {
    return null;
  }

  // Check whether team exists
  const team = await db.collection('teams').findOne({
    _id: new ObjectId(teamId)
  });

  if (!team) {
    return null;
  }

  const player = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    jerseyNumber: Number(jerseyNumber),
    sport: sport.trim(),
    teamId: new ObjectId(teamId),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection('players').insertOne(player);

  return {
    ...player,
    _id: result.insertedId
  };
};

// 2. Get All Players
const getAllPlayers = async () => {
  const db = getDB();

  return await db.collection('players').find({}).sort({ createdAt: -1 }).toArray();
};

// 3. Get Player By ID
const getPlayerById = async (playerId) => {
  if (!ObjectId.isValid(playerId)) {
    return null;
  }

  const db = getDB();

  return await db.collection('players').findOne({
    _id: new ObjectId(playerId)
  });
};

// 4. Search Players
const searchPlayers = async (query) => {
  const db = getDB();

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const regex = new RegExp(escapedQuery, 'i');

  return await db
    .collection('players')
    .find({
      $or: [{ name: regex }, { email: regex }, { sport: regex }]
    })
    .toArray();
};

// 5. Update Player
const updatePlayer = async (playerId, updateData) => {
  if (!ObjectId.isValid(playerId)) {
    return null;
  }

  const db = getDB();

  const allowedFields = ['name', 'email', 'jerseyNumber', 'sport', 'teamId', 'bio'];

  const updateFields = {};

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      updateFields[field] = updateData[field];
    }
  });

  if (Object.keys(updateFields).length === 0) {
    return null;
  }

  // Validate name
  if (updateFields.name !== undefined) {
    if (typeof updateFields.name !== 'string' || !updateFields.name.trim()) {
      return null;
    }
    updateFields.name = updateFields.name.trim();
  }

  // Validate email
  if (updateFields.email !== undefined) {
    if (typeof updateFields.email !== 'string' || !updateFields.email.trim()) {
      return null;
    }
    updateFields.email = updateFields.email.trim().toLowerCase();
  }

  // Validate sport
  if (updateFields.sport !== undefined) {
    if (typeof updateFields.sport !== 'string' || !updateFields.sport.trim()) {
      return null;
    }
    updateFields.sport = updateFields.sport.trim();
  }

  // Validate bio
  if (updateFields.bio !== undefined) {
    if (typeof updateFields.bio !== 'string') {
      return null;
    }
    updateFields.bio = updateFields.bio.trim().slice(0, 250);
  }

  // Validate jersey number
  if (updateFields.jerseyNumber !== undefined) {
    const number = Number(updateFields.jerseyNumber);

    if (!Number.isInteger(number) || number < 0) {
      return null;
    }

    updateFields.jerseyNumber = number;
  }

  // Validate new team assignment
  if (updateFields.teamId !== undefined) {
    if (!ObjectId.isValid(updateFields.teamId)) {
      return null;
    }

    const team = await db.collection('teams').findOne({
      _id: new ObjectId(updateFields.teamId)
    });

    if (!team) {
      return null;
    }

    const currentPlayer = await db.collection('players').findOne({ _id: new ObjectId(playerId) });
    const interests = currentPlayer?.interestedSports || [];
    if (
      interests.length &&
      !interests.some((sport) => sport.toLowerCase() === team.sport.toLowerCase())
    ) {
      return null;
    }
    if (
      updateFields.sport !== undefined &&
      updateFields.sport.toLowerCase() !== team.sport.toLowerCase()
    ) {
      return null;
    }

    updateFields.teamId = new ObjectId(updateFields.teamId);
    updateFields.sport = team.sport;
  }

  updateFields.updatedAt = new Date();

  return await db
    .collection('players')
    .findOneAndUpdate(
      { _id: new ObjectId(playerId) },
      { $set: updateFields },
      { returnDocument: 'after' }
    );
};

// 6. Delete Player
const deletePlayer = async (playerId) => {
  if (!ObjectId.isValid(playerId)) {
    return null;
  }

  const db = getDB();

  return await db.collection('players').findOneAndDelete({
    _id: new ObjectId(playerId)
  });
};

// 7. Get Players By Team
const getPlayersByTeam = async (teamId) => {
  if (!ObjectId.isValid(teamId)) {
    return null;
  }

  const db = getDB();

  const team = await db.collection('teams').findOne({
    _id: new ObjectId(teamId)
  });

  if (!team) {
    return null;
  }

  return await db
    .collection('players')
    .find({
      $or: [{ teamId: new ObjectId(teamId) }, { teamIds: new ObjectId(teamId) }]
    })
    .toArray();
};

const getMyPlayerProfile = async (user) => {
  const db = getDB();
  const userObjectId = ObjectId.isValid(user.id) ? new ObjectId(user.id) : null;
  const email = user.email.trim().toLowerCase();

  let profile = userObjectId
    ? await db.collection('players').findOne({ userId: userObjectId })
    : null;

  if (!profile) {
    profile = await db.collection('players').findOne({ email });
  }

  if (!profile) return null;

  if (profile.userId && String(profile.userId) !== String(user.id)) {
    const error = new Error('This player profile is linked to a different account.');
    error.statusCode = 409;
    throw error;
  }

  if (userObjectId && !profile.userId) {
    await db
      .collection('players')
      .updateOne(
        { _id: profile._id, $or: [{ userId: { $exists: false } }, { userId: null }] },
        { $set: { userId: userObjectId, updatedAt: new Date() } }
      );
    profile.userId = userObjectId;
  }

  return profile;
};

const checkUsernameAvailability = async (user, usernameInput) => {
  const username = typeof usernameInput === 'string' ? usernameInput.trim().toLowerCase() : '';
  if (!USERNAME_PATTERN.test(username)) {
    return {
      available: false,
      username,
      reason: 'Use 3–20 letters, numbers, or underscores; start with a letter or number.'
    };
  }

  const profile = await getMyPlayerProfile(user);
  const query = { username };
  if (profile) query._id = { $ne: profile._id };
  const existing = await getDB()
    .collection('players')
    .findOne(query, { projection: { _id: 1 } });

  return {
    available: !existing,
    username,
    reason: existing ? 'That username is already taken.' : ''
  };
};

const saveMyPlayerProfile = async (user, profileData = {}) => {
  if (typeof profileData.name !== 'string' || !profileData.name.trim()) {
    const error = new Error('Full name is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(profileData.interestedSports)) {
    const error = new Error('Choose at least one sport you are interested in.');
    error.statusCode = 400;
    throw error;
  }

  const interestedSports = [
    ...new Set(
      profileData.interestedSports
        .filter((sport) => typeof sport === 'string')
        .map((sport) => sport.trim())
        .filter(Boolean)
    )
  ];

  if (!interestedSports.length || interestedSports.length > 8) {
    const error = new Error('Choose between one and eight sports.');
    error.statusCode = 400;
    throw error;
  }

  const username =
    typeof profileData.username === 'string' ? profileData.username.trim().toLowerCase() : '';
  if (!USERNAME_PATTERN.test(username)) {
    const error = new Error(
      'Username must be 3–20 characters using letters, numbers, or underscores.'
    );
    error.statusCode = 400;
    throw error;
  }

  let jerseyNumber = null;
  if (
    profileData.jerseyNumber !== undefined &&
    profileData.jerseyNumber !== null &&
    profileData.jerseyNumber !== ''
  ) {
    jerseyNumber = Number(profileData.jerseyNumber);
    if (!Number.isInteger(jerseyNumber) || jerseyNumber < 0 || jerseyNumber > 999) {
      const error = new Error('Jersey number must be a whole number from 0 to 999.');
      error.statusCode = 400;
      throw error;
    }
  }

  const existingProfile = await getMyPlayerProfile(user);

  let bio = '';
  if (profileData.bio !== undefined && profileData.bio !== null) {
    if (typeof profileData.bio !== 'string') {
      const error = new Error('Bio must be text.');
      error.statusCode = 400;
      throw error;
    }
    bio = profileData.bio.trim().slice(0, 250);
  } else if (existingProfile?.bio) {
    bio = existingProfile.bio;
  }

  const userObjectId = new ObjectId(user.id);
  const profile = {
    userId: userObjectId,
    username,
    name: profileData.name.trim(),
    email: user.email.trim().toLowerCase(),
    bio,
    interestedSports,
    sport: existingProfile?.teamId ? existingProfile.sport : interestedSports[0],
    jerseyNumber,
    teamId: existingProfile?.teamId || null,
    updatedAt: new Date()
  };

  if (existingProfile) {
    try {
      await getDB()
        .collection('players')
        .updateOne({ _id: existingProfile._id }, { $set: profile });
      return { ...existingProfile, ...profile };
    } catch (error) {
      if (error.code === 11000) {
        const conflict = new Error('That username is already taken. Choose another one.');
        conflict.statusCode = 409;
        throw conflict;
      }
      throw error;
    }
  }

  try {
    const createdAt = new Date();
    const result = await getDB()
      .collection('players')
      .insertOne({
        ...profile,
        createdAt
      });
    return { ...profile, _id: result.insertedId, createdAt };
  } catch (error) {
    if (error.code === 11000) {
      const conflict = new Error('That username is already taken. Choose another one.');
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
  }
};

// Export all functions
module.exports = {
  createPlayer,
  getAllPlayers,
  getPlayerById,
  searchPlayers,
  updatePlayer,
  deletePlayer,
  getPlayersByTeam,
  getMyPlayerProfile,
  saveMyPlayerProfile,
  checkUsernameAvailability
};
