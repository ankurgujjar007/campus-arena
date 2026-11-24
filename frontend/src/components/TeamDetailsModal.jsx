import { api } from '../services/api';
import { useEffect, useMemo, useState } from 'react';

const TeamDetailsModal = ({
  team,
  token,
  currentPlayer,
  onLeft,
  onRosterChanged,
  players = [],
  tournaments = [],
  matches = [],
  onClose,
  onSelectPlayer,
  onSelectTournament
}) => {
  const [selectingMembers, setSelectingMembers] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [removing, setRemoving] = useState(false);
  const [updatingLeader, setUpdatingLeader] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [joinRequests, setJoinRequests] = useState([]);
  const [requestAction, setRequestAction] = useState('');
  const isLeader = currentPlayer && String(team.captainId) === String(currentPlayer._id);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const member =
    currentPlayer &&
    [...(currentPlayer.teamIds || []), currentPlayer.teamId]
      .filter(Boolean)
      .some((id) => String(id) === String(team._id));
  useEffect(() => {
    if (!isLeader) return;
    api
      .request(`/teams/${team._id}/join-requests`, token)
      .then((result) => setJoinRequests(result.data || []))
      .catch(() => setJoinRequests([]));
  }, [isLeader, team._id, token]);
  // Roster of players belonging to this team
  const roster = useMemo(() => {
    return players.filter((p) =>
      [...(p.teamIds || []), p.teamId].filter(Boolean).some((id) => String(id) === String(team._id))
    );
  }, [team, players]);
  const visibleRoster = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return roster;
    return roster.filter((player) =>
      [player.name, player.username, player._id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [roster, memberSearch]);

  // Find captain
  const captain = useMemo(() => {
    if (!team.captainId) return null;
    return players.find((p) => String(p._id) === String(team.captainId));
  }, [team, players]);

  // Tournaments this team is registered in
  const teamTournaments = useMemo(() => {
    return tournaments.filter((t) => (t.teamIds || []).map(String).includes(String(team._id)));
  }, [team, tournaments]);

  // Matches for this team
  const teamMatches = useMemo(() => {
    const teamIdStr = String(team._id);
    return matches.filter((m) => String(m.teamA) === teamIdStr || String(m.teamB) === teamIdStr);
  }, [team, matches]);

  // Season record calculation
  const record = useMemo(() => {
    const teamIdStr = String(team._id);
    const completed = teamMatches.filter((m) => m.status === 'completed');

    return completed.reduce(
      (acc, m) => {
        const isTeamA = String(m.teamA) === teamIdStr;
        const myScore = Number(m.score?.[isTeamA ? 'teamA' : 'teamB'] ?? 0);
        const oppScore = Number(m.score?.[isTeamA ? 'teamB' : 'teamA'] ?? 0);
        acc.pointsFor += myScore;
        acc.pointsAgainst += oppScore;
        if (myScore > oppScore) acc.wins += 1;
        else if (myScore === oppScore) acc.draws += 1;
        else acc.losses += 1;
        return acc;
      },
      { played: completed.length, wins: 0, draws: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }
    );
  }, [team, teamMatches]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card panel team-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-details-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
        <div className="modal-header">
          <div>
            <div className="tournament-badge-row">
              <span className="sport-badge">{team.sport}</span>
              <span className="count-badge">{roster.length} players</span>
            </div>
            <h2 id="team-details-title">{team.name}</h2>
            {captain && (
              <p className="muted">
                Captain: <strong>{captain.name}</strong>
              </p>
            )}
          </div>
        </div>

        {isLeader && (
          <div className="stats-modal-section">
            <h3>Join requests ({joinRequests.length})</h3>
            {joinRequests.length === 0 ? (
              <p className="muted">No pending join requests.</p>
            ) : (
              <ul className="team-member-list">
                {joinRequests.map((applicant) => (
                  <li className="team-member-row" key={String(applicant._id)}>
                    <div className="team-member-name">
                      <strong>{applicant.name}</strong>
                      {applicant.username && <span className="muted">@{applicant.username}</span>}
                      <span className="muted">{applicant.sport}</span>
                    </div>
                    <div className="team-request-actions">
                      <button
                        className="secondary-button"
                        disabled={Boolean(requestAction)}
                        onClick={async () => {
                          const key = `${applicant._id}:accept`;
                          setRequestAction(key);
                          try {
                            await api.request(
                              `/teams/${team._id}/join-requests/${applicant._id}/accept`,
                              token,
                              { method: 'POST' }
                            );
                            setJoinRequests((current) =>
                              current.filter((p) => String(p._id) !== String(applicant._id))
                            );
                            await onRosterChanged();
                          } catch (error) {
                            setRemoveError(error.message);
                          } finally {
                            setRequestAction('');
                          }
                        }}
                      >
                        {requestAction === `${applicant._id}:accept` ? 'Accepting…' : 'Accept'}
                      </button>
                      <button
                        className="secondary-button"
                        disabled={Boolean(requestAction)}
                        onClick={async () => {
                          const key = `${applicant._id}:deny`;
                          setRequestAction(key);
                          try {
                            await api.request(
                              `/teams/${team._id}/join-requests/${applicant._id}/deny`,
                              token,
                              { method: 'POST' }
                            );
                            setJoinRequests((current) =>
                              current.filter((p) => String(p._id) !== String(applicant._id))
                            );
                          } catch (error) {
                            setRemoveError(error.message);
                          } finally {
                            setRequestAction('');
                          }
                        }}
                      >
                        {requestAction === `${applicant._id}:deny` ? 'Denying…' : 'Deny'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Team Season Record */}
        <div className="stats-modal-section">
          <h3>Season Match Record</h3>
          <div className="stats-grid team-modal-stats-grid">
            <article className="stat-card panel">
              <span>Played</span>
              <strong>{record.played}</strong>
            </article>
            <article className="stat-card panel">
              <span>Wins</span>
              <strong className="stat-win">{record.wins}</strong>
            </article>
            <article className="stat-card panel">
              <span>Draws</span>
              <strong>{record.draws}</strong>
            </article>
            <article className="stat-card panel">
              <span>Losses</span>
              <strong className="stat-loss">{record.losses}</strong>
            </article>
            <article className="stat-card panel">
              <span>Score for</span>
              <strong>{record.pointsFor}</strong>
            </article>
            <article className="stat-card panel">
              <span>Score against</span>
              <strong>{record.pointsAgainst}</strong>
            </article>
          </div>
        </div>

        {/* Player Roster */}
        <div className="stats-modal-section">
          <h3>Team Roster ({roster.length})</h3>
          {roster.length === 0 ? (
            <p className="muted">No players have been assigned to this team yet.</p>
          ) : (
            <>
              {isLeader && selectingMembers && (
                <label className="member-search">
                  Search players by name or ID
                  <input
                    type="search"
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder="Name or player ID"
                  />
                </label>
              )}
              <ul className="team-member-list">
                {visibleRoster.map((player) => (
                  <li className="team-member-row" key={String(player._id)}>
                    {isLeader &&
                      selectingMembers &&
                      String(player._id) !== String(team.captainId) && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${player.name} for team action`}
                          disabled={removing || updatingLeader}
                          checked={selectedMembers.includes(String(player._id))}
                          onChange={(event) =>
                            setSelectedMembers((current) =>
                              event.target.checked
                                ? [...current, String(player._id)]
                                : current.filter((id) => id !== String(player._id))
                            )
                          }
                        />
                      )}
                    <div className="team-member-name">
                      <strong>{player.name}</strong>
                      {String(player._id) === String(team.captainId) && (
                        <span className="captain-label">Leader</span>
                      )}
                      {player.username && <span className="muted">@{player.username}</span>}
                    </div>
                    <button
                      className="secondary-button member-profile-button"
                      aria-label={`View ${player.name}'s profile`}
                      onClick={() => {
                        onClose();
                        onSelectPlayer?.(player);
                      }}
                    >
                      →
                    </button>
                  </li>
                ))}
              </ul>
              {visibleRoster.length === 0 && (
                <p className="muted">No team members match that search.</p>
              )}
            </>
          )}
        </div>

        {isLeader && (
          <div className="team-remove-actions">
            {!selectingMembers ? (
              <button
                className="secondary-button"
                onClick={() => {
                  setSelectingMembers(true);
                  setMemberSearch('');
                  setRemoveError('');
                }}
              >
                Select players
              </button>
            ) : (
              <>
                <button
                  className="secondary-button"
                  disabled={removing}
                  onClick={() => {
                    setSelectingMembers(false);
                    setSelectedMembers([]);
                    setMemberSearch('');
                    setRemoveError('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className="secondary-button make-leader-button"
                  disabled={removing || updatingLeader || selectedMembers.length !== 1}
                  onClick={async () => {
                    if (
                      selectedMembers.length !== 1 ||
                      !window.confirm(
                        `Make ${roster.find((player) => String(player._id) === selectedMembers[0])?.name || 'this player'} the leader of ${team.name}?`
                      )
                    )
                      return;
                    setUpdatingLeader(true);
                    setRemoveError('');
                    try {
                      await api.request(`/teams/${team._id}/make-leader`, token, {
                        method: 'POST',
                        body: JSON.stringify({ playerId: selectedMembers[0] })
                      });
                      await onRosterChanged();
                      setSelectedMembers([]);
                      setSelectingMembers(false);
                    } catch (error) {
                      setRemoveError(error.message);
                    } finally {
                      setUpdatingLeader(false);
                    }
                  }}
                >
                  {updatingLeader ? 'Updating…' : 'Make leader'}
                </button>
                <button
                  className="secondary-button"
                  disabled={removing || !selectedMembers.length}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        `Remove ${selectedMembers.length} selected player(s) from ${team.name}?`
                      )
                    )
                      return;
                    setRemoving(true);
                    setRemoveError('');
                    try {
                      await api.request(`/teams/${team._id}/remove-players`, token, {
                        method: 'POST',
                        body: JSON.stringify({ playerIds: selectedMembers })
                      });
                      await onRosterChanged();
                      setSelectedMembers([]);
                      setSelectingMembers(false);
                    } catch (error) {
                      setRemoveError(error.message);
                    } finally {
                      setRemoving(false);
                    }
                  }}
                >
                  {removing
                    ? 'Removing…'
                    : `Remove selected${selectedMembers.length ? ` (${selectedMembers.length})` : ''}`}
                </button>
              </>
            )}
            {removeError && (
              <p className="feedback" role="alert">
                {removeError}
              </p>
            )}
          </div>
        )}

        {/* Tournaments Entered */}
        {teamTournaments.length > 0 && (
          <div className="stats-modal-section">
            <h3>Tournaments ({teamTournaments.length})</h3>
            <div className="tournaments-mini-list">
              {teamTournaments.map((t) => (
                <div
                  className="mini-item panel clickable"
                  key={String(t._id)}
                  onClick={() => {
                    onClose();
                    onSelectTournament?.(t);
                  }}
                >
                  <div>
                    <strong>{t.name}</strong>
                    <p className="muted">
                      {t.venue} · {t.sport}
                    </p>
                  </div>
                  <span className={`status-label ${t.status === 'ongoing' ? 'live' : ''}`}>
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Matches */}
        {teamMatches.length > 0 && (
          <div className="stats-modal-section">
            <h3>Match History & Schedule ({teamMatches.length})</h3>
            <div className="match-list">
              {teamMatches.map((m) => (
                <div className="match-row" key={String(m._id)}>
                  <span className="match-row-teams">
                    {m.teamAName || 'Team A'} <small>vs</small> {m.teamBName || 'Team B'}
                  </span>
                  <span className="match-row-meta">
                    <span>
                      {m.score?.teamA ?? 0} : {m.score?.teamB ?? 0}
                    </span>
                    <span className={`status-label ${m.status === 'live' ? 'live' : ''}`}>
                      {m.status}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {member && (
          <div className="team-leave-section">
            <button
              className="secondary-button"
              disabled={leaving}
              onClick={async () => {
                if (!window.confirm(`Leave ${team.name}?`)) return;
                setLeaving(true);
                setLeaveError('');
                try {
                  await api.request(`/teams/${team._id}/leave`, token, { method: 'POST' });
                  await onLeft();
                } catch (error) {
                  setLeaveError(error.message);
                } finally {
                  setLeaving(false);
                }
              }}
            >
              {leaving ? 'Leaving…' : 'Leave team'}
            </button>
            {leaveError && (
              <p className="feedback" role="alert">
                {leaveError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamDetailsModal;
