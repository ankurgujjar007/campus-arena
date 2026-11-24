const express = require('express');

const {
  getTeams,
  getTeamById,
  createTeam,
  searchTeams,
  updateTeam,
  deleteTeam
} = require('../controllers/team.controller');

const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');

const sportKey = (sport) => sport.trim().toLowerCase();
const claimSportMembership = async (db, player, teamId, sport) => {
  const { ObjectId } = require('mongodb');
  if (sportKey(sport) === 'all sports') {
    await db.collection('players').updateOne(
      { _id: player._id },
      {
        $addToSet: { teamIds: teamId },
        $set: { updatedAt: new Date(), ...(!player.teamId ? { teamId, sport } : {}) }
      }
    );
    return true;
  }
  const ids = [...(player.teamIds || []), player.teamId]
    .filter(Boolean)
    .map((id) => new ObjectId(id));
  const existing = await db
    .collection('teams')
    .find({ _id: { $in: ids } })
    .toArray();
  if (
    existing.some(
      (team) => String(team._id) !== String(teamId) && sportKey(team.sport) === sportKey(sport)
    )
  )
    return false;
  const result = await db.collection('players').updateOne(
    { _id: player._id, teamSportKeys: { $ne: sportKey(sport) } },
    {
      $addToSet: { teamIds: teamId, teamSportKeys: sportKey(sport) },
      $set: { updatedAt: new Date(), ...(!player.teamId ? { teamId, sport } : {}) }
    }
  );
  return result.modifiedCount > 0;
};

router.get('/search', searchTeams);
router.get('/my-join-requests', authMiddleware, async (req, res, next) => {
  try {
    const { getDB } = require('../config/db');
    const player = await require('../services/player.service').getMyPlayerProfile(req.user);
    if (!player) return res.status(404).json({ message: 'Player profile not found.' });
    const teams = await getDB()
      .collection('teams')
      .find({ 'joinRequests.playerId': player._id })
      .project({ name: 1, sport: 1, joinRequests: 1 })
      .toArray();
    const requests = teams.flatMap((team) =>
      (team.joinRequests || [])
        .filter((request) => String(request.playerId) === String(player._id))
        .map((request) => ({
          teamId: String(team._id),
          teamName: team.name,
          sport: team.sport,
          status: request.status,
          updatedAt: request.updatedAt || request.requestedAt
        }))
    );
    res.json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
});
router.get('/leader-pending-counts', authMiddleware, async (req, res, next) => {
  try {
    const { getDB } = require('../config/db');
    const player = await require('../services/player.service').getMyPlayerProfile(req.user);
    if (!player) return res.status(404).json({ message: 'Player profile not found.' });
    const teams = await getDB()
      .collection('teams')
      .find({ captainId: player._id })
      .project({ name: 1, joinRequests: 1 })
      .toArray();
    res.json({
      success: true,
      data: teams.map((team) => ({
        teamId: String(team._id),
        pendingCount: (team.joinRequests || []).filter(
          (request) => request.status === 'pending' && !request.seenByLeaderAt
        ).length
      }))
    });
  } catch (error) {
    next(error);
  }
});
router.post(
  '/:id/join-request',
  authMiddleware,
  authorizeRoles('player', 'referee'),
  async (req, res, next) => {
    try {
      const { ObjectId } = require('mongodb');
      const { getDB } = require('../config/db');
      const player = await require('../services/player.service').getMyPlayerProfile(req.user);
      if (!player?.username || !ObjectId.isValid(req.params.id))
        return res
          .status(400)
          .json({ message: 'Complete your player profile and select a valid team.' });
      const db = getDB(),
        teamId = new ObjectId(req.params.id);
      const team = await db.collection('teams').findOne({ _id: teamId });
      if (!team) return res.status(404).json({ message: 'Team not found.' });
      if (
        [...(player.teamIds || []), player.teamId]
          .filter(Boolean)
          .some((id) => String(id) === String(teamId))
      )
        return res.status(409).json({ message: 'You already belong to this team.' });
      const existingRequest = (team.joinRequests || []).find(
        (item) => String(item.playerId) === String(player._id)
      );
      if (existingRequest?.status === 'pending')
        return res.status(409).json({ message: 'Your join request is already pending.' });
      if (sportKey(team.sport) !== 'all sports') {
        const memberships = [...(player.teamIds || []), player.teamId]
          .filter(Boolean)
          .map((id) => new ObjectId(id));
        const currentTeams = memberships.length
          ? await db
              .collection('teams')
              .find({ _id: { $in: memberships } })
              .toArray()
          : [];
        if (
          currentTeams.some(
            (currentTeam) =>
              String(currentTeam._id) !== String(teamId) &&
              sportKey(currentTeam.sport) === sportKey(team.sport)
          )
        )
          return res.status(409).json({
            message: `You already belong to a ${team.sport} team. Leave it before requesting to join another.`
          });
      }
      const request = { playerId: player._id, status: 'pending', requestedAt: new Date() };
      await db
        .collection('teams')
        .updateOne({ _id: teamId }, { $pull: { joinRequests: { playerId: player._id } } });
      await db
        .collection('teams')
        .updateOne(
          { _id: teamId },
          { $push: { joinRequests: request }, $set: { updatedAt: new Date() } }
        );
      res.status(201).json({ success: true, message: 'Join request sent.' });
    } catch (error) {
      next(error);
    }
  }
);
router.get('/:id/join-requests', authMiddleware, async (req, res, next) => {
  try {
    const { ObjectId } = require('mongodb');
    const { getDB } = require('../config/db');
    const player = await require('../services/player.service').getMyPlayerProfile(req.user);
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid team.' });
    const team = await getDB()
      .collection('teams')
      .findOne({ _id: new ObjectId(req.params.id) });
    if (!team) return res.status(404).json({ message: 'Team not found.' });
    if (!player || String(team.captainId) !== String(player._id))
      return res.status(403).json({ message: 'Only the team leader can review join requests.' });
    await getDB()
      .collection('teams')
      .updateOne(
        { _id: team._id },
        { $set: { 'joinRequests.$[request].seenByLeaderAt': new Date() } },
        {
          arrayFilters: [
            { 'request.status': 'pending', 'request.seenByLeaderAt': { $exists: false } }
          ]
        }
      );
    const requests = await getDB()
      .collection('players')
      .find(
        {
          _id: {
            $in: (team.joinRequests || [])
              .filter((r) => r.status === 'pending')
              .map((r) => r.playerId)
          }
        },
        { projection: { name: 1, username: 1, sport: 1 } }
      )
      .toArray();
    res.json({
      success: true,
      data: requests.map((p) => ({
        ...p,
        requestedAt: team.joinRequests.find((r) => String(r.playerId) === String(p._id))
          ?.requestedAt
      }))
    });
  } catch (error) {
    next(error);
  }
});
router.post('/:id/join-requests/:playerId/:decision', authMiddleware, async (req, res, next) => {
  try {
    const { ObjectId } = require('mongodb');
    const { getDB } = require('../config/db');
    const leader = await require('../services/player.service').getMyPlayerProfile(req.user);
    if (
      !ObjectId.isValid(req.params.id) ||
      !ObjectId.isValid(req.params.playerId) ||
      !['accept', 'deny'].includes(req.params.decision)
    )
      return res.status(400).json({ message: 'Invalid join request action.' });
    const db = getDB(),
      teamId = new ObjectId(req.params.id),
      playerId = new ObjectId(req.params.playerId);
    const team = await db.collection('teams').findOne({ _id: teamId });
    if (!team || !leader || String(team.captainId) !== String(leader._id))
      return res.status(403).json({ message: 'Only the team leader can review join requests.' });
    const request = (team.joinRequests || []).find(
      (r) => String(r.playerId) === String(playerId) && r.status === 'pending'
    );
    if (!request) return res.status(404).json({ message: 'Pending join request not found.' });
    if (req.params.decision === 'accept') {
      const applicant = await db.collection('players').findOne({ _id: playerId });
      if (
        !applicant ||
        (sportKey(team.sport) !== 'all sports' &&
          !(await claimSportMembership(db, applicant, teamId, team.sport)))
      )
        return res
          .status(409)
          .json({ message: `This player already belongs to a ${team.sport} team.` });
      if (sportKey(team.sport) === 'all sports')
        await claimSportMembership(db, applicant, teamId, team.sport);
      await db.collection('teams').updateOne({ _id: teamId }, { $addToSet: { players: playerId } });
    }
    await db.collection('teams').updateOne(
      { _id: teamId },
      {
        $set: {
          'joinRequests.$[request].status':
            req.params.decision === 'accept' ? 'accepted' : 'denied',
          'joinRequests.$[request].updatedAt': new Date(),
          updatedAt: new Date()
        }
      },
      { arrayFilters: [{ 'request.playerId': playerId, 'request.status': 'pending' }] }
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
router.get('/', getTeams);
router.get('/:id', getTeamById);
router.delete('/:id', authMiddleware, authorizeRoles('admin', 'event_manager'), deleteTeam);
router.post(
  '/mine',
  authMiddleware,
  authorizeRoles('player', 'referee', 'event_manager'),
  async (req, res, next) => {
    try {
      const { ObjectId } = require('mongodb');
      const { getDB } = require('../config/db');
      const { getMyPlayerProfile } = require('../services/player.service');
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      const sport = typeof req.body.sport === 'string' ? req.body.sport.trim() : '';
      if (name.length < 2 || name.length > 80 || !sport || sport.length > 60)
        return res
          .status(400)
          .json({ message: 'Enter a team name (2–80 characters) and a valid sport.' });
      const player = await getMyPlayerProfile(req.user);
      if (!player?.username)
        return res.status(400).json({ message: 'Complete your player profile first.' });
      const db = getDB(),
        teamId = new ObjectId(),
        now = new Date();
      const team = {
        _id: teamId,
        name,
        sport,
        captainId: player._id,
        players: [player._id],
        createdBy: new ObjectId(req.user.id),
        createdAt: now,
        updatedAt: now
      };
      const claimed = await claimSportMembership(db, player, teamId, sport);
      if (!claimed)
        return res.status(409).json({
          message: `You already belong to a ${sport} team. Leave it before creating another.`
        });
      try {
        await db.collection('teams').insertOne(team);
      } catch (error) {
        await db.collection('players').updateOne(
          { _id: player._id },
          {
            $pull: { teamIds: teamId, teamSportKeys: sportKey(sport) },
            $set: { teamId: player.teamId || null, sport: player.sport }
          }
        );
        throw error;
      }
      res.status(201).json({ success: true, message: 'Your team is ready.', data: team });
    } catch (error) {
      next(error);
    }
  }
);
router.post('/:id/remove-players', authMiddleware, async (req, res, next) => {
  try {
    const { ObjectId } = require('mongodb');
    const { getDB } = require('../config/db');
    const leader = await require('../services/player.service').getMyPlayerProfile(req.user);
    const ids = req.body.playerIds;
    if (
      !ObjectId.isValid(req.params.id) ||
      !Array.isArray(ids) ||
      !ids.length ||
      ids.some((id) => typeof id !== 'string' || !ObjectId.isValid(id))
    )
      return res.status(400).json({ message: 'Select valid players to remove.' });
    const db = getDB(),
      teamId = new ObjectId(req.params.id);
    const team = await db.collection('teams').findOne({ _id: teamId });
    if (!team || !leader || String(team.captainId) !== String(leader._id))
      return res.status(403).json({ message: 'Only the team leader can remove players.' });
    if (ids.includes(String(team.captainId)))
      return res.status(400).json({ message: 'The team leader cannot be removed.' });
    const objectIds = [...new Set(ids)].map((id) => new ObjectId(id));
    const selected = await db
      .collection('players')
      .find({ _id: { $in: objectIds }, $or: [{ teamId }, { teamIds: teamId }] })
      .toArray();
    if (selected.length !== objectIds.length)
      return res
        .status(400)
        .json({ message: 'Some selected players no longer belong to this team.' });
    const tournaments = await db
      .collection('tournaments')
      .find({ status: { $in: ['upcoming', 'ongoing'] }, teamIds: teamId })
      .toArray();
    const locked = selected.some((p) =>
      tournaments.some(
        (t) =>
          String(t.playerTeams?.[p.userId]) === String(teamId) ||
          [
            ...(t.teamEntries?.[String(teamId)]?.starters || []),
            ...(t.teamEntries?.[String(teamId)]?.substitutes || [])
          ].includes(String(p._id))
      )
    );
    if (locked)
      return res.status(409).json({
        message: 'Players entered in an active tournament cannot be removed until it finishes.'
      });
    for (const player of selected) {
      const remaining = (player.teamIds || []).filter((id) => String(id) !== String(teamId));
      if (
        player.teamId &&
        String(player.teamId) !== String(teamId) &&
        !remaining.some((id) => String(id) === String(player.teamId))
      )
        remaining.push(player.teamId);
      await db.collection('players').updateOne(
        { _id: player._id },
        {
          $set: {
            teamSportKeys: (
              await db
                .collection('teams')
                .find({ _id: { $in: remaining } })
                .toArray()
            ).map((team) => sportKey(team.sport)),
            teamIds: remaining,
            teamId:
              String(player.teamId) === String(teamId)
                ? remaining[0] || null
                : player.teamId || null,
            updatedAt: new Date()
          }
        }
      );
    }
    await db
      .collection('teams')
      .updateOne(
        { _id: teamId },
        { $pull: { players: { $in: objectIds } }, $set: { updatedAt: new Date() } }
      );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
router.post('/:id/make-leader', authMiddleware, async (req, res, next) => {
  try {
    const { ObjectId } = require('mongodb');
    const { getDB } = require('../config/db');
    const currentLeader = await require('../services/player.service').getMyPlayerProfile(req.user);
    const { playerId } = req.body || {};
    if (!ObjectId.isValid(req.params.id) || !ObjectId.isValid(playerId))
      return res.status(400).json({ message: 'Select a valid team member.' });
    const db = getDB(),
      teamId = new ObjectId(req.params.id),
      nextLeaderId = new ObjectId(playerId);
    const team = await db.collection('teams').findOne({ _id: teamId });
    if (!team || !currentLeader || String(team.captainId) !== String(currentLeader._id))
      return res.status(403).json({ message: 'Only the team leader can transfer leadership.' });
    if (String(team.captainId) === String(nextLeaderId))
      return res.status(400).json({ message: 'This player is already the team leader.' });
    const nextLeader = await db
      .collection('players')
      .findOne({ _id: nextLeaderId, $or: [{ teamId }, { teamIds: teamId }] });
    if (!nextLeader)
      return res.status(400).json({ message: 'The selected player is not on this team.' });
    await db
      .collection('teams')
      .updateOne(
        { _id: teamId, captainId: currentLeader._id },
        { $set: { captainId: nextLeaderId, updatedAt: new Date() } }
      );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
router.post('/:id/leave', authMiddleware, async (req, res, next) => {
  try {
    const { ObjectId } = require('mongodb');
    const { getDB } = require('../config/db');
    const player = await require('../services/player.service').getMyPlayerProfile(req.user);
    if (!player || !ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid team membership.' });
    const db = getDB(),
      id = new ObjectId(req.params.id);
    const team = await db.collection('teams').findOne({ _id: id });
    if (!team) return res.status(404).json({ message: 'Team not found.' });
    if (String(team.captainId) === String(player._id))
      return res.status(409).json({
        message: 'Captains must transfer leadership through an event manager before leaving.'
      });
    const active = await db
      .collection('tournaments')
      .findOne({ status: { $in: ['upcoming', 'ongoing'] }, [`playerTeams.${req.user.id}`]: id });
    if (active)
      return res
        .status(409)
        .json({ message: 'Finish your active tournament with this team before leaving.' });
    const remaining = (player.teamIds || []).filter((value) => String(value) !== String(id));
    if (
      player.teamId &&
      String(player.teamId) !== String(id) &&
      !remaining.some((value) => String(value) === String(player.teamId))
    )
      remaining.push(player.teamId);
    await db.collection('players').updateOne(
      { _id: player._id },
      {
        $set: {
          teamSportKeys: (
            await db
              .collection('teams')
              .find({ _id: { $in: remaining } })
              .toArray()
          ).map((team) => sportKey(team.sport)),
          teamIds: remaining,
          teamId:
            String(player.teamId) === String(id) ? remaining[0] || null : player.teamId || null,
          updatedAt: new Date()
        }
      }
    );
    await db.collection('teams').updateOne({ _id: id }, { $pull: { players: player._id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
router.post('/:id/join', authMiddleware, async (req, res, next) => {
  try {
    const { ObjectId } = require('mongodb');
    const { getDB } = require('../config/db');
    const player = await require('../services/player.service').getMyPlayerProfile(req.user);
    if (!player?.username)
      return res.status(400).json({ message: 'Complete your player profile first.' });
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid team.' });
    const db = getDB();
    const team = await db.collection('teams').findOne({ _id: new ObjectId(req.params.id) });
    if (!team) return res.status(404).json({ message: 'Team not found.' });
    const memberships = [...(player.teamIds || []), player.teamId].filter(Boolean).map(String);
    if (memberships.includes(String(team._id))) return res.json({ success: true, data: team });
    if (!(await claimSportMembership(db, player, team._id, team.sport)))
      return res.status(409).json({
        message: `You already belong to a ${team.sport} team. Leave it before joining another.`
      });
    await db
      .collection('teams')
      .updateOne({ _id: team._id }, { $addToSet: { players: player._id } });
    res.json({ success: true, data: team });
  } catch (error) {
    next(error);
  }
});
router.post('/', authMiddleware, authorizeRoles('admin', 'event_manager'), createTeam);
router.put('/:id', authMiddleware, authorizeRoles('admin', 'event_manager'), updateTeam);

module.exports = router;
