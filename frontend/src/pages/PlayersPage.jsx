import TeamJoinAction from '../components/TeamJoinAction';
import Icon from '../components/Icon';
import RecentMatches from '../components/RecentMatches';
import { useState, useMemo, useEffect } from 'react';
import { api } from '../services/api';

const PlayersPage = ({
  players = [],
  teams = [],
  matches = [],
  tournaments = [],
  user,
  playerProfile,
  token,
  onViewTeam,
  initialSelectedPlayer = null
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState(initialSelectedPlayer);
  const [joinRequestState, setJoinRequestState] = useState({});
  useEffect(() => {
    if (!token || !playerProfile) return;
    let cancelled = false;
    api
      .request('/teams/my-join-requests', token)
      .then((result) => {
        if (!cancelled)
          setJoinRequestState(
            Object.fromEntries(
              (result.data || []).map((request) => [
                String(request.teamId),
                { state: request.status }
              ])
            )
          );
      })
      .catch((error) => {
        if (!cancelled) setRequestLoadError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token, playerProfile]);
  const [requestLoadError, setRequestLoadError] = useState('');

  // Build a lookup map of teamId -> team object
  const teamsById = useMemo(() => {
    const map = new Map();
    teams.forEach((team) => {
      map.set(String(team._id), team);
    });
    return map;
  }, [teams]);

  // Compute stats helper for any player
  const computePlayerStats = (player) => {
    if (!player) return null;
    const playerTeamId = player.teamId ? String(player.teamId) : '';
    const team = playerTeamId ? teamsById.get(playerTeamId) : null;

    const completedTeamMatches = playerTeamId
      ? matches.filter(
          (m) =>
            m.status === 'completed' && [String(m.teamA), String(m.teamB)].includes(playerTeamId)
        )
      : [];

    const record = completedTeamMatches.reduce(
      (acc, m) => {
        const isTeamA = String(m.teamA) === playerTeamId;
        const myScore = Number(m.score?.[isTeamA ? 'teamA' : 'teamB'] ?? 0);
        const oppScore = Number(m.score?.[isTeamA ? 'teamB' : 'teamA'] ?? 0);
        acc.pointsFor += myScore;
        acc.pointsAgainst += oppScore;
        if (myScore > oppScore) acc.wins += 1;
        else if (myScore === oppScore) acc.draws += 1;
        else acc.losses += 1;
        return acc;
      },
      { wins: 0, draws: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }
    );

    const matchesPlayed = completedTeamMatches.length;
    const winRate = matchesPlayed > 0 ? Math.round((record.wins / matchesPlayed) * 100) : 0;
    const goalDiff = record.pointsFor - record.pointsAgainst;

    // Tournaments entered either directly or through team
    const enteredTournaments = tournaments.filter((t) => {
      const byPlayer = (t.playerIds || [])
        .map(String)
        .includes(String(player.userId || player._id));
      const byTeam = playerTeamId && (t.teamIds || []).map(String).includes(playerTeamId);
      return byPlayer || byTeam;
    });

    return {
      team,
      completedMatches: completedTeamMatches,
      record,
      matchesPlayed,
      winRate,
      goalDiff,
      tournaments: enteredTournaments
    };
  };

  // Only filter when search query is non-empty
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return players.filter((player) => {
      const team = player.teamId ? teamsById.get(String(player.teamId)) : null;
      const teamName = (team?.name || '').toLowerCase();
      const playerName = (player.name || '').toLowerCase();
      const username = (player.username || '').toLowerCase();
      const playerId = String(player._id || '').toLowerCase();
      const userId = String(player.userId || '').toLowerCase();
      const primarySport = (player.sport || '').toLowerCase();
      const bio = (player.bio || '').toLowerCase();

      return (
        playerName.includes(query) ||
        username.includes(query) ||
        playerId.includes(query) ||
        userId.includes(query) ||
        teamName.includes(query) ||
        primarySport.includes(query) ||
        bio.includes(query)
      );
    });
  }, [players, searchQuery, teamsById]);

  const teamSearchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return teams.filter((team) =>
      [team.name, team.sport, team._id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [teams, searchQuery]);

  const activeStats = selectedPlayerForStats ? computePlayerStats(selectedPlayerForStats) : null;

  return (
    <section className="players-directory">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Campus community</p>
          <h2>Community athletes & teams</h2>
          <p className="muted">
            Search players by name, @username, or player ID, and teams by name or sport.
          </p>
        </div>
      </div>

      <div className="directory-controls">
        <div className="search-bar search-bar-hero">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players or teams by name, username, ID, or sport…"
            aria-label="Search players and teams"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {requestLoadError && (
        <p className="feedback" role="alert">
          Unable to load join requests: {requestLoadError}
        </p>
      )}
      {searchQuery.trim() && teamSearchResults.length > 0 && (
        <section className="community-team-results">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Campus teams</p>
              <h2>Teams ({teamSearchResults.length})</h2>
            </div>
          </div>
          <div className="all-teams-grid">
            {teamSearchResults.map((team) => {
              const isMember = [...(playerProfile?.teamIds || []), playerProfile?.teamId]
                .filter(Boolean)
                .some((id) => String(id) === String(team._id));
              const status = joinRequestState[String(team._id)];
              return (
                <article
                  className="your-team-card panel community-team-card"
                  key={String(team._id)}
                >
                  <button
                    type="button"
                    className="community-team-open"
                    onClick={() => onViewTeam?.(team)}
                  >
                    <span className="eyebrow">{team.sport}</span>
                    <strong>{team.name}</strong>
                    <span className="muted">
                      {team.players?.length || 0}{' '}
                      {(team.players?.length || 0) === 1 ? 'member' : 'members'}
                    </span>
                  </button>
                  {playerProfile && (
                    <TeamJoinAction
                      isMember={isMember}
                      isCaptain={String(team.captainId) === String(playerProfile._id)}
                      status={status?.state}
                      busy={Boolean(status?.busy)}
                      onView={() => onViewTeam?.(team)}
                      onRequest={async () => {
                        setJoinRequestState((current) => ({
                          ...current,
                          [String(team._id)]: { ...current[String(team._id)], busy: true }
                        }));
                        try {
                          await api.request(`/teams/${team._id}/join-request`, token, {
                            method: 'POST'
                          });
                          setJoinRequestState((current) => ({
                            ...current,
                            [String(team._id)]: { state: 'pending', busy: false }
                          }));
                        } catch (error) {
                          setJoinRequestState((current) => ({
                            ...current,
                            [String(team._id)]: {
                              state: status?.state,
                              busy: false,
                              message: error.message
                            }
                          }));
                        }
                      }}
                    />
                  )}
                  {status?.message && (
                    <span className="feedback" role="alert">
                      {status.message}
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {!searchQuery.trim() ? (
        <div className="panel search-prompt-panel">
          <div className="search-prompt-icon">
            <Icon name="search" size={28} />
          </div>
          <h3>Search for a player</h3>
          <p className="muted">
            Enter a student’s name, unique username (e.g. <code>@player</code>), or database player
            ID to pull up their profile, team affiliation, and performance statistics.
          </p>
          <div className="search-tip-tags">
            <span className="tip-tag">Search by Name</span>
            <span className="tip-tag">Search by @username</span>
            <span className="tip-tag">Search by Player ID</span>
          </div>
        </div>
      ) : searchResults.length === 0 ? (
        teamSearchResults.length > 0 ? null : (
          <div className="panel empty-state">
            <h3>No players or teams matching “{searchQuery}”</h3>
            <p className="muted">Check the name, username, ID, or sport and try again.</p>
          </div>
        )
      ) : (
        <div className="players-grid">
          {searchResults.map((player) => {
            const team = player.teamId ? teamsById.get(String(player.teamId)) : null;
            const isSelf =
              (user?.email && player.email?.toLowerCase() === user.email.toLowerCase()) ||
              (playerProfile?.username && player.username === playerProfile.username);
            const stats = computePlayerStats(player);

            return (
              <article
                className={`player-directory-card panel ${isSelf ? 'highlight-self' : ''}`}
                key={String(player._id || player.username)}
              >
                <div className="card-top">
                  <span className="player-avatar">
                    {player.name?.slice(0, 1)?.toUpperCase() || 'P'}
                  </span>
                  <div className="player-meta-top">
                    <div className="player-names">
                      <strong className="player-display-name">
                        {player.name}
                        {isSelf && <span className="self-tag">You</span>}
                      </strong>
                      {player.username && <span className="player-handle">@{player.username}</span>}
                    </div>
                    {player.jerseyNumber !== null && player.jerseyNumber !== undefined && (
                      <span className="jersey-pill">#{player.jerseyNumber}</span>
                    )}
                  </div>
                </div>

                {player.bio && <p className="player-bio">{player.bio}</p>}

                <div className="player-team-info">
                  <span className="team-indicator">
                    {team ? (
                      <>
                        <span className="team-dot" />
                        <strong>{team.name}</strong>
                      </>
                    ) : (
                      <span className="muted">Independent athlete</span>
                    )}
                  </span>
                  {player.sport && <span className="sport-badge">{player.sport}</span>}
                </div>

                {/* Quick stats mini-row */}
                <div className="card-quick-stats">
                  <div>
                    <span className="quick-label">Matches</span>
                    <strong>{stats.matchesPlayed}</strong>
                  </div>
                  <div>
                    <span className="quick-label">W - D - L</span>
                    <strong>
                      {stats.record.wins}-{stats.record.draws}-{stats.record.losses}
                    </strong>
                  </div>
                  <div>
                    <span className="quick-label">Win Rate</span>
                    <strong>{stats.winRate}%</strong>
                  </div>
                </div>

                <div className="card-actions">
                  <button
                    type="button"
                    className="primary-button card-stats-btn"
                    onClick={() => setSelectedPlayerForStats(player)}
                  >
                    View statistics & profile
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Detailed Player Statistics Modal */}
      {selectedPlayerForStats && activeStats && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedPlayerForStats(null)}
          role="presentation"
        >
          <div
            className="modal-card panel player-stats-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="player-stats-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close-button"
              onClick={() => setSelectedPlayerForStats(null)}
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
              <div className="player-modal-profile">
                <span className="player-avatar large">
                  {selectedPlayerForStats.name?.slice(0, 1)?.toUpperCase() || 'P'}
                </span>
                <div>
                  <p className="eyebrow">Player profile & statistics</p>
                  <h2 id="player-stats-title">{selectedPlayerForStats.name}</h2>
                  {selectedPlayerForStats.username && (
                    <span className="player-handle">@{selectedPlayerForStats.username}</span>
                  )}
                </div>
              </div>
            </div>

            {selectedPlayerForStats.bio && (
              <p className="modal-bio">{selectedPlayerForStats.bio}</p>
            )}

            <div className="stats-modal-section">
              <h3>Affiliation & Sport</h3>
              <div className="meta-pills">
                <span className="meta-pill">
                  <strong>Team:</strong>{' '}
                  {activeStats.team ? (
                    <button
                      type="button"
                      className="inline-team-link"
                      onClick={() => {
                        setSelectedPlayerForStats(null);
                        onViewTeam?.(activeStats.team);
                      }}
                    >
                      {activeStats.team.name}
                    </button>
                  ) : (
                    'No team assigned'
                  )}
                </span>
                <span className="meta-pill">
                  <strong>Sport:</strong> {selectedPlayerForStats.sport || 'Unspecified'}
                </span>
                {selectedPlayerForStats.jerseyNumber !== null &&
                  selectedPlayerForStats.jerseyNumber !== undefined && (
                    <span className="meta-pill">
                      <strong>Jersey:</strong> #{selectedPlayerForStats.jerseyNumber}
                    </span>
                  )}
              </div>
            </div>

            <div className="stats-modal-section">
              <h3>Season Performance Record</h3>
              <div className="stats-grid player-modal-stats-grid">
                <article className="stat-card panel">
                  <span>Matches played</span>
                  <strong>{activeStats.matchesPlayed}</strong>
                </article>
                <article className="stat-card panel">
                  <span>Wins</span>
                  <strong className="stat-win">{activeStats.record.wins}</strong>
                </article>
                <article className="stat-card panel">
                  <span>Draws</span>
                  <strong>{activeStats.record.draws}</strong>
                </article>
                <article className="stat-card panel">
                  <span>Losses</span>
                  <strong className="stat-loss">{activeStats.record.losses}</strong>
                </article>
                <article className="stat-card panel">
                  <span>Win rate</span>
                  <strong>{activeStats.winRate}%</strong>
                </article>
                <article className="stat-card panel">
                  <span>Goal/Point diff</span>
                  <strong>
                    {activeStats.goalDiff > 0 ? `+${activeStats.goalDiff}` : activeStats.goalDiff}
                  </strong>
                </article>
                <article className="stat-card panel">
                  <span>Score for</span>
                  <strong>{activeStats.record.pointsFor}</strong>
                </article>
                <article className="stat-card panel">
                  <span>Score against</span>
                  <strong>{activeStats.record.pointsAgainst}</strong>
                </article>
              </div>
            </div>

            {selectedPlayerForStats.interestedSports?.length > 0 && (
              <div className="stats-modal-section">
                <h3>Interested Sports</h3>
                <div className="interested-chips">
                  {selectedPlayerForStats.interestedSports.map((sport) => (
                    <span className="sport-chip" key={sport}>
                      {sport}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="stats-modal-section">
              <RecentMatches
                matches={activeStats.completedMatches}
                teamId={selectedPlayerForStats.teamId}
                tournaments={tournaments}
              />
            </div>

            {activeStats.tournaments.length > 0 && (
              <div className="stats-modal-section">
                <h3>Tournaments ({activeStats.tournaments.length})</h3>
                <div className="tournaments-mini-list">
                  {activeStats.tournaments.map((t) => (
                    <div className="mini-item panel" key={String(t._id)}>
                      <div>
                        <strong>{t.name}</strong>
                        <p className="muted">
                          {t.sport} · {t.venue}
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
          </div>
        </div>
      )}
    </section>
  );
};

export default PlayersPage;
