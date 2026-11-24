const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');

// Create a new team
const createTeam = async (teamData) => {
  const db = getDB();

  const team = {
    name: teamData.name,
    sport: teamData.sport,
    captainId: teamData.captainId || null,
    players: teamData.players || [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection('teams').insertOne(team);

  return {
    ...team,
    _id: result.insertedId
  };
};

// Get all teams
const getAllTeams = async () => {
  const db = getDB();

  return await db.collection('teams').find({}).sort({ createdAt: -1 }).toArray();
};

// Get a team by ID
const getTeamById = async (teamId) => {
  // Check whether the provided ID is a valid MongoDB ObjectId
  if (!ObjectId.isValid(teamId)) {
    return null;
  }

  const db = getDB();

  return await db.collection('teams').findOne({
    _id: new ObjectId(teamId)
  });
};
// Overall search across team fields
const searchTeams = async (query) => {
  const db = getDB();

  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  return await db
    .collection('teams')
    .find({
      $or: [{ name: regex }, { sport: regex }, { captainId: regex }, { players: regex }]
    })
    .toArray();
};
// Update team by ID
const updateTeam = async (teamId, updateData) => {
  if (!ObjectId.isValid(teamId)) {
    return null;
  }

  const db = getDB();

  const allowedFields = ['name', 'sport', 'captainId', 'players'];

  const updateFields = {};

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      updateFields[field] = updateData[field];
    }
  });

  if (Object.keys(updateFields).length === 0) {
    return null;
  }

  updateFields.updatedAt = new Date();

  const result = await db
    .collection('teams')
    .findOneAndUpdate(
      { _id: new ObjectId(teamId) },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

  return result;
};
// Delete team by ID
const deleteTeam = async (teamId) => {
  if (!ObjectId.isValid(teamId)) {
    return null;
  }

  const db = getDB();

  const result = await db.collection('teams').findOneAndDelete({
    _id: new ObjectId(teamId)
  });

  return result;
};

// Export all team services
module.exports = {
  createTeam,
  getAllTeams,
  getTeamById,
  searchTeams,
  updateTeam,
  deleteTeam
};
