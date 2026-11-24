import Icon from './Icon';
import { useState, useMemo } from 'react';

const formatDate = (value) => {
  if (!value) return 'Date to be announced';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date to be announced'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const TournamentDetailsModal = ({
  tournament,
  teams = [],
  players = [],
  matches = [],
  user,
  onClose,
  onJoinTournament,
  onSelectTeam
}) => {
  const [entryTeam, setEntryTeam] = useState('');
  const [entryError, setEntryError] = useState('');
  const ownPlayer = players.find((p) => String(p.userId) === String(user?.id || user?._id));
  const ownTeamIds = [...(ownPlayer?.teamIds || []), ownPlayer?.teamId].filter(Boolean).map(String);
  const eligibleEntryTeams = teams.filter(
    (team) =>
      ownTeamIds.includes(String(team._id)) &&
      (team.sport.toLowerCase() === 'all sports' ||
        team.sport.toLowerCase() === tournament.sport.toLowerCase())
  );
  const [activeTab, setActiveTab] = useState('standings');

  // Lookup map for teams
  const teamsById = useMemo(() => {
    const map = new Map();
    teams.forEach((team) => map.set(String(team._id), team));
    return map;
  }, [teams]);

  // Registered teams for this tournament
  const tournamentTeams = useMemo(() => {
    const teamIds = (tournament.teamIds || []).map(String);
    return teams.filter((t) => teamIds.includes(String(t._id)));
  }, [tournament, teams]);

  // Matches for this tournament
  const tournamentMatches = useMemo(() => {
    return matches.filter((m) => String(m.tournamentId) === String(tournament._id));
  }, [tournament, matches]);

  // Standings table calculation
  const standings = useMemo(() => {
    const table = new Map();

    tournamentTeams.forEach((team) => {
      table.set(String(team._id), {
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        scoreFor: 0,
        scoreAgainst: 0,
        pointsDiff: 0,
        points: 0
      });
    });

    const completedMatches = tournamentMatches.filter((m) => m.status === 'completed');

    completedMatches.forEach((match) => {
      const teamAId = String(match.teamA);
      const teamBId = String(match.teamB);
      const scoreA = Number(match.score?.teamA ?? 0);
      const scoreB = Number(match.score?.teamB ?? 0);

      const entryA = table.get(teamAId);
      const entryB = table.get(teamBId);

      if (entryA) {
        entryA.played += 1;
        entryA.scoreFor += scoreA;
        entryA.scoreAgainst += scoreB;
        if (scoreA > scoreB) {
          entryA.won += 1;
          entryA.points += 3;
        } else if (scoreA === scoreB) {
          entryA.drawn += 1;
          entryA.points += 1;
        } else {
          entryA.lost += 1;
        }
        entryA.pointsDiff = entryA.scoreFor - entryA.scoreAgainst;
      }

      if (entryB) {
        entryB.played += 1;
        entryB.scoreFor += scoreB;
        entryB.scoreAgainst += scoreA;
        if (scoreB > scoreA) {
          entryB.won += 1;
          entryB.points += 3;
        } else if (scoreA === scoreB) {
          entryB.drawn += 1;
          entryB.points += 1;
        } else {
          entryB.lost += 1;
        }
        entryB.pointsDiff = entryB.scoreFor - entryB.scoreAgainst;
      }
    });

    return Array.from(table.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
      return b.scoreFor - a.scoreFor;
    });
  }, [tournamentTeams, tournamentMatches]);

  // Registered individual players
  const registeredPlayers = useMemo(() => {
    const playerIds = (tournament.playerIds || []).map(String);
    return players.filter((p) => playerIds.includes(String(p.userId || p._id)));
  }, [tournament, players]);

  const hasJoined =
    ['player', 'referee'].includes(user?.role) &&
    (tournament.playerIds || []).map(String).includes(String(user.id || user._id));

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card panel tournament-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tournament-details-title"
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
              <span className={`status-label ${tournament.status === 'ongoing' ? 'live' : ''}`}>
                {tournament.status}
              </span>
              <span className="sport-badge">{tournament.sport}</span>
            </div>
            <h2 id="tournament-details-title">{tournament.name}</h2>
            <p className="muted">
              <Icon name="location" /> {tournament.venue} · {formatDate(tournament.startDate)}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab ${activeTab === 'standings' ? 'active' : ''}`}
            onClick={() => setActiveTab('standings')}
          >
            Standings ({tournamentTeams.length})
          </button>
          <button
            type="button"
            className={`modal-tab ${activeTab === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveTab('matches')}
          >
            Matches ({tournamentMatches.length})
          </button>
          <button
            type="button"
            className={`modal-tab ${activeTab === 'teams' ? 'active' : ''}`}
            onClick={() => setActiveTab('teams')}
          >
            Teams & Rosters
          </button>
          {registeredPlayers.length > 0 && (
            <button
              type="button"
              className={`modal-tab ${activeTab === 'players' ? 'active' : ''}`}
              onClick={() => setActiveTab('players')}
            >
              Players ({registeredPlayers.length})
            </button>
          )}
        </div>

        <div className="modal-tab-content">
          {/* TAB 1: STANDINGS TABLE */}
          {activeTab === 'standings' && (
            <div className="standings-view">
              {standings.length === 0 ? (
                <div className="empty-state">
                  <p className="muted">No teams have registered for this tournament yet.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <p className="table-scroll-hint">Scroll sideways to see all standings columns.</p>
                  <table className="standings-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Team</th>
                        <th>MP</th>
                        <th>W</th>
                        <th>D</th>
                        <th>L</th>
                        <th>GF</th>
                        <th>GA</th>
                        <th>GD</th>
                        <th>PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((entry, index) => (
                        <tr key={String(entry.team._id)}>
                          <td className="standings-rank">{index + 1}</td>
                          <td>
                            <button
                              type="button"
                              className="table-team-link"
                              onClick={() => {
                                onClose();
                                onSelectTeam?.(entry.team);
                              }}
                            >
                              {entry.team.name}
                            </button>
                          </td>
                          <td>{entry.played}</td>
                          <td>{entry.won}</td>
                          <td>{entry.drawn}</td>
                          <td>{entry.lost}</td>
                          <td>{entry.scoreFor}</td>
                          <td>{entry.scoreAgainst}</td>
                          <td>
                            {entry.pointsDiff > 0 ? `+${entry.pointsDiff}` : entry.pointsDiff}
                          </td>
                          <td className="standings-pts">{entry.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MATCHES & SCHEDULE */}
          {activeTab === 'matches' && (
            <div className="tournament-matches-view">
              {tournamentMatches.length === 0 ? (
                <div className="empty-state">
                  <p className="muted">No matches scheduled for this tournament yet.</p>
                </div>
              ) : (
                <div className="match-list">
                  {tournamentMatches.map((m) => {
                    const teamA = teamsById.get(String(m.teamA));
                    const teamB = teamsById.get(String(m.teamB));
                    return (
                      <div className="match-row" key={String(m._id)}>
                        <div className="match-row-teams">
                          <span>{teamA?.name || m.teamAName || 'Team A'}</span>
                          <small>vs</small>
                          <span>{teamB?.name || m.teamBName || 'Team B'}</span>
                        </div>
                        <div className="match-row-meta">
                          <span>
                            {m.score?.teamA ?? 0} : {m.score?.teamB ?? 0}
                          </span>
                          <span className={`status-label ${m.status === 'live' ? 'live' : ''}`}>
                            {m.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TEAMS & ROSTERS */}
          {activeTab === 'teams' && (
            <div className="tournament-teams-view">
              {tournamentTeams.length === 0 ? (
                <div className="empty-state">
                  <p className="muted">No teams are registered in this tournament yet.</p>
                </div>
              ) : (
                <div className="tournament-teams-grid">
                  {tournamentTeams.map((team) => {
                    const teamRoster = players.filter((p) => String(p.teamId) === String(team._id));
                    return (
                      <article className="team-summary-card panel" key={String(team._id)}>
                        <div className="team-summary-header">
                          <div>
                            <h3>{team.name}</h3>
                            <span className="muted">
                              {team.sport} · {teamRoster.length} players
                            </span>
                          </div>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                              onClose();
                              onSelectTeam?.(team);
                            }}
                          >
                            View team
                          </button>
                        </div>
                        {teamRoster.length > 0 && (
                          <div className="team-roster-preview">
                            {teamRoster.map((player) => (
                              <span className="roster-player-chip" key={String(player._id)}>
                                {player.name}
                                {player.jerseyNumber !== null &&
                                  player.jerseyNumber !== undefined && (
                                    <small> #{player.jerseyNumber}</small>
                                  )}
                              </span>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: REGISTERED PLAYERS */}
          {activeTab === 'players' && (
            <div className="tournament-players-view">
              <div className="players-grid mini-grid">
                {registeredPlayers.map((player) => (
                  <div className="player-directory-card panel" key={String(player._id)}>
                    <div className="card-top">
                      <span className="player-avatar">
                        {player.name?.slice(0, 1)?.toUpperCase() || 'P'}
                      </span>
                      <div>
                        <strong>{player.name}</strong>
                        {player.username && (
                          <span className="player-handle">@{player.username}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {['player', 'referee'].includes(user?.role) && !hasJoined && (
          <label className="tournament-team-picker">
            Enter with team
            <select
              value={entryTeam}
              onChange={(event) => {
                setEntryTeam(event.target.value);
                setEntryError('');
              }}
            >
              <option value="">Choose your team</option>
              {eligibleEntryTeams.map((team) => (
                <option value={String(team._id)} key={String(team._id)}>
                  {team.name}
                </option>
              ))}
            </select>
            {!eligibleEntryTeams.length && (
              <span className="join-reason" role="status">
                You need to join a {tournament.sport} team before entering.
              </span>
            )}
            {entryError && (
              <span className="join-reason" role="alert">
                {entryError}
              </span>
            )}
          </label>
        )}
        <div className="modal-actions">
          {['player', 'referee'].includes(user?.role) &&
            tournament.status !== 'completed' &&
            (hasJoined ? (
              <span className="joined-label">
                <Icon name="check" /> You have joined this tournament
              </span>
            ) : (
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  if (!entryTeam) {
                    setEntryError(
                      eligibleEntryTeams.length
                        ? 'First select a team.'
                        : `Join a ${tournament.sport} team before entering.`
                    );
                    return;
                  }
                  onJoinTournament?.(String(tournament._id), entryTeam);
                }}
              >
                Join tournament
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};

export default TournamentDetailsModal;
