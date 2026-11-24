const { verifyToken } = require('../utils/jwt');
const { getMatchById, updateLiveMatch, recordLiveFoul } = require('../services/match.service');
const { getUserAuthById } = require('../services/auth.service');

const SCORE_EDITOR_ROLES = new Set(['admin', 'referee', 'event_manager']);

const registerMatchSocket = (io) => {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;

    if (typeof token !== 'string' || !token) {
      return next(new Error('Authentication token is required.'));
    }

    try {
      const decodedUser = verifyToken(token);
      socket.user = await getUserAuthById(decodedUser.id);
      if (!socket.user) return next(new Error('User account no longer exists.'));
      return next();
    } catch (error) {
      return next(new Error('Invalid or expired token.'));
    }
  });

  io.on('connection', (socket) => {
    console.log('Authenticated user connected:', socket.id);

    socket.on('join-match', async (matchId) => {
      if (typeof matchId !== 'string' || !matchId.trim()) {
        socket.emit('match-error', { message: 'A match ID is required.' });
        return;
      }

      try {
        const match = await getMatchById(matchId);
        if (!match) {
          socket.emit('match-error', { message: 'Match not found.' });
          return;
        }

        socket.join(matchId);
        socket.emit('match-update', {
          matchId,
          score: match.score || { teamA: 0, teamB: 0 },
          status: match.status,
          timeline: match.timeline || [],
          updatedAt: match.updatedAt
        });
      } catch (error) {
        console.error('Unable to join match room:', error.message);
        socket.emit('match-error', { message: 'Unable to join this match.' });
      }
    });

    socket.on('match-update', async (update = {}, acknowledge = () => {}) => {
      const reply = (result) => {
        if (typeof acknowledge === 'function') acknowledge(result);
      };
      try {
        socket.user = await getUserAuthById(socket.user?.id);
      } catch (error) {
        socket.emit('match-update-error', { message: 'Unable to verify your account.' });
        reply({ error: 'Unable to verify your account.' });
        return;
      }

      if (!SCORE_EDITOR_ROLES.has(socket.user?.role)) {
        reply({ error: 'You are not allowed to change match scores.' });
        socket.emit('match-update-error', {
          message: 'You are not allowed to change match scores.'
        });
        return;
      }

      const { matchId, score, status = 'live' } = update;
      if (typeof matchId !== 'string' || !matchId.trim()) {
        socket.emit('match-update-error', { message: 'A match ID is required.' });
        reply({ error: 'A match ID is required.' });
        return;
      }

      try {
        const assignedMatch = await getMatchById(matchId);
        if (
          socket.user.role === 'referee' &&
          String(assignedMatch?.refereeId) !== String(socket.user.id || socket.user._id)
        )
          throw new Error('You are not assigned to referee this match.');
        const liveState = await updateLiveMatch(matchId, { score, status });
        io.to(matchId).emit('match-update', {
          matchId,
          score: liveState.score,
          status: liveState.status,
          timeline: liveState.timeline || [],
          updatedAt: liveState.updatedAt
        });
        reply({ success: true, state: liveState });
      } catch (error) {
        socket.emit('match-update-error', { message: error.message });
        reply({ error: error.message });
      }
    });

    socket.on('match-foul', async (payload = {}, acknowledge = () => {}) => {
      const reply = (result) => {
        if (typeof acknowledge === 'function') acknowledge(result);
      };
      try {
        socket.user = await getUserAuthById(socket.user?.id);
        if (!SCORE_EDITOR_ROLES.has(socket.user?.role))
          throw new Error('You are not allowed to record match fouls.');
        const match = await getMatchById(payload.matchId);
        if (!match) throw new Error('Match not found.');
        if (
          socket.user.role === 'referee' &&
          String(match.refereeId) !== String(socket.user.id || socket.user._id)
        )
          throw new Error('You are not assigned to referee this match.');
        const liveState = await recordLiveFoul(payload.matchId, payload);
        io.to(String(payload.matchId)).emit('match-update', {
          matchId: String(payload.matchId),
          score: liveState.score,
          status: liveState.status,
          timeline: liveState.timeline,
          updatedAt: liveState.updatedAt
        });
        reply({ success: true, state: liveState });
      } catch (error) {
        socket.emit('match-update-error', { message: error.message });
        reply({ error: error.message });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};

module.exports = registerMatchSocket;
