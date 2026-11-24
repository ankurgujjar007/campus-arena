import { useEffect, useState } from 'react';
import { socket } from '../services/socket';

const TeamEventPanel = ({ match, side, players, disabled, onPublish }) => {
  const [playerCode, setPlayerCode] = useState('');
  const [foulType, setFoulType] = useState('Foul');
  const [error, setError] = useState('');
  const teamId = String(match[side]);
  const roster = players.filter((player) =>
    [...(player.teamIds || []), player.teamId].filter(Boolean).map(String).includes(teamId)
  );
  const code = playerCode.trim();
  const selectedPlayer = roster.find(
    (player) =>
      String(player._id).toLowerCase() === code.toLowerCase() ||
      player.username?.toLowerCase() === code.replace(/^@/, '').toLowerCase()
  );
  return (
    <section className="referee-team-events" aria-label={`${match[`${side}Name`]} player events`}>
      <h3>{match[`${side}Name`]}</h3>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          if (code && !selectedPlayer) {
            setError('Enter a player code from this team’s roster.');
            return;
          }
          onPublish('match-foul', {
            matchId: String(match._id),
            teamId,
            playerId: selectedPlayer ? String(selectedPlayer._id) : null,
            foulType
          });
        }}
      >
        <fieldset disabled={disabled}>
          <legend>Player event</legend>
          <label>
            Player code (optional)
            <input
              value={playerCode}
              onChange={(event) => {
                setPlayerCode(event.target.value);
                setError('');
              }}
              placeholder="@username or player ID"
            />
          </label>
          <p className="muted">
            {selectedPlayer
              ? `${selectedPlayer.name} · Jersey ${selectedPlayer.jerseyNumber ?? 'unassigned'}`
              : code
                ? 'No matching player on this team.'
                : 'Leave blank to record a team foul.'}
          </p>
          <label>
            Event *
            <select value={foulType} onChange={(event) => setFoulType(event.target.value)}>
              {['Foul', 'Yellow card', 'Red card', 'Penalty'].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          {error && (
            <p className="feedback" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button">Publish event</button>
        </fieldset>
      </form>
      <details className="referee-roster">
        <summary>Player codes · {roster.length} players</summary>
        {roster.map((player) => (
          <div key={String(player._id)}>
            <strong>{player.name}</strong>
            <span>
              {player.username ? `@${player.username}` : 'No username'} · #
              {player.jerseyNumber ?? '—'}
            </span>
            <code>{String(player._id)}</code>
            <button
              type="button"
              className="secondary-button"
              disabled={disabled}
              onClick={() => {
                setPlayerCode(String(player._id));
                setError('');
              }}
            >
              Select player
            </button>
          </div>
        ))}
      </details>
    </section>
  );
};

const RefereeDesk = ({ user, matches, players, tournaments, onBack }) => {
  const assigned = matches.filter(
    (match) => String(match.refereeId) === String(user._id || user.id)
  );
  const [matchId, setMatchId] = useState('');
  const [scores, setScores] = useState({ teamA: 0, teamB: 0 });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(socket.connected);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const match = assigned.find((item) => String(item._id) === matchId);
  const final = ['completed', 'cancelled'].includes(match?.status);

  useEffect(() => {
    const connect = () => setConnected(true),
      disconnect = () => setConnected(false);
    socket.on('connect', connect);
    socket.on('disconnect', disconnect);
    return () => {
      socket.off('connect', connect);
      socket.off('disconnect', disconnect);
    };
  }, []);
  useEffect(() => {
    if (!matchId || !connected) return;
    socket.emit('join-match', matchId);
  }, [matchId, connected]);
  useEffect(() => {
    if (match) setScores(match.score || { teamA: 0, teamB: 0 });
  }, [matchId, match?.score?.teamA, match?.score?.teamB]);

  const publish = (event, payload) => {
    setError('');
    setFeedback('');
    if (!socket.connected) {
      setError('Live connection is offline. Reconnect before publishing.');
      return;
    }
    setBusy(true);
    socket.timeout(8000).emit(event, payload, (timeoutError, result) => {
      setBusy(false);
      if (timeoutError) {
        setError('No confirmation received. Check the timeline before retrying.');
        return;
      }
      if (result?.error) {
        setError(result.error);
        return;
      }
      setFeedback(
        event === 'match-foul'
          ? 'Match event published live.'
          : payload.status === 'completed'
            ? 'Final score saved.'
            : 'Score published live.'
      );
      setConfirmFinish(false);
    });
  };
  const publishScore = (status) => {
    if (
      Object.values(scores).some(
        (value) => value === '' || !Number.isInteger(Number(value)) || Number(value) < 0
      )
    ) {
      setError('Enter whole, non-negative scores for both teams.');
      return;
    }
    publish('match-update', {
      matchId,
      score: { teamA: Number(scores.teamA), teamB: Number(scores.teamB) },
      status
    });
  };
  return (
    <section className="referee-desk">
      <div className="admin-fixtures-heading">
        <div>
          <p className="eyebrow">Match operations</p>
          <h2>Assigned match controls</h2>
        </div>
        <button type="button" className="secondary-button" onClick={onBack}>
          Back to Home
        </button>
      </div>
      <div className="referee-desk-grid">
        <aside className="panel referee-assigned">
          <h3>Assigned matches ({assigned.length})</h3>
          {!assigned.length && (
            <p className="muted">
              No matches assigned. Ask an administrator or event manager to assign you to a fixture.
            </p>
          )}
          {assigned.map((item) => (
            <button
              type="button"
              disabled={busy}
              className={`match-row ${String(item._id) === matchId ? 'selected' : ''}`}
              key={String(item._id)}
              onClick={() => {
                setMatchId(String(item._id));
                setFeedback('');
                setError('');
                setConfirmFinish(false);
              }}
            >
              <span>
                {item.teamAName} vs {item.teamBName}
                <small className="referee-fixture-time">
                  {tournaments.find((t) => String(t._id) === String(item.tournamentId))?.name}
                  {item.scheduledAt ? ` · ${new Date(item.scheduledAt).toLocaleString()}` : ''}
                </small>
              </span>
              <span className="status-label">{item.status}</span>
            </button>
          ))}
        </aside>
        <section className="panel referee-controls">
          {!match ? (
            <div className="empty-state">
              <h3>Select an assigned match</h3>
              <p className="muted">
                Manage scores, record fouls, and identify players by username or player ID.
              </p>
            </div>
          ) : (
            <>
              <div className="admin-fixtures-heading">
                <h3>
                  {match.teamAName} vs {match.teamBName}
                </h3>
                <span className="status-label">{match.status}</span>
              </div>
              {!connected && (
                <p className="feedback" role="alert">
                  Live connection lost. Publishing is unavailable until it reconnects.
                </p>
              )}
              {error && (
                <p className="feedback" role="alert">
                  {error}
                </p>
              )}
              {feedback && <p role="status">{feedback}</p>}
              {final && (
                <p className="muted">This match is {match.status}. The result is locked.</p>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  publishScore('live');
                }}
              >
                <fieldset disabled={busy || final || !connected}>
                  <legend>Live score</legend>
                  <div className="score-inputs">
                    {['teamA', 'teamB'].map((side) => (
                      <label key={side}>
                        {match[`${side}Name`]}
                        <input
                          required
                          type="number"
                          min="0"
                          step="1"
                          value={scores[side]}
                          onChange={(event) => setScores({ ...scores, [side]: event.target.value })}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="score-actions">
                    <button className="primary-button">
                      {busy
                        ? 'Publishing…'
                        : match.status === 'scheduled'
                          ? 'Start match & publish score'
                          : 'Publish live score'}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setConfirmFinish(true)}
                    >
                      Finish match
                    </button>
                  </div>
                  {confirmFinish && (
                    <div className="referee-finish-confirm">
                      <p>
                        Save {scores.teamA} – {scores.teamB} as the final result? This locks further
                        updates.
                      </p>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => publishScore('completed')}
                      >
                        Confirm final score
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setConfirmFinish(false)}
                      >
                        Keep playing
                      </button>
                    </div>
                  )}
                </fieldset>
              </form>
              <h3>Fouls & player events</h3>
              {match.status === 'scheduled' && (
                <p className="muted">Start the match before recording player events.</p>
              )}
              <div className="referee-team-event-grid">
                {['teamA', 'teamB'].map((side) => (
                  <TeamEventPanel
                    key={`${matchId}-${side}`}
                    match={match}
                    side={side}
                    players={players}
                    disabled={busy || final || !connected || match.status !== 'live'}
                    onPublish={publish}
                  />
                ))}
              </div>
              <section className="referee-timeline">
                <h3>Live timeline</h3>
                {!(match.timeline || []).length && <p className="muted">No events yet.</p>}
                {(match.timeline || [])
                  .slice()
                  .reverse()
                  .map((item, index) => (
                    <article key={`${item.timestamp}-${index}`}>
                      <strong>{item.message}</strong>
                      <small>{new Date(item.timestamp).toLocaleTimeString()}</small>
                    </article>
                  ))}
              </section>
            </>
          )}
        </section>
      </div>
    </section>
  );
};
export default RefereeDesk;
