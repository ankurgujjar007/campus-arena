import { useState } from 'react';
import RecentMatches from '../components/RecentMatches';

const formatDate = (value) => {
  if (!value) return 'Date to be announced';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date to be announced'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
};

const HomePage = ({
  user,
  playerProfile,
  players,
  teams,
  tournaments,
  matches,
  onOpenRefereeDesk,
  onJoinTournament,
  onSelectTournament
}) => {
  const [entryTeams, setEntryTeams] = useState({});
  const [recentOpen, setRecentOpen] = useState(false);
  const assignedMatches = matches.filter(
    (match) => String(match.refereeId) === String(user?.id || user?._id)
  );
  const player =
    playerProfile ||
    players.find((item) => item.email?.toLowerCase() === user.email?.toLowerCase());

  const playerTeamId = player ? String(player.teamId) : '';
  const playerTeam = teams.find((team) => String(team._id) === playerTeamId);

  const completedTeamMatches = playerTeamId
    ? matches.filter(
        (match) =>
          match.status === 'completed' &&
          [String(match.teamA), String(match.teamB)].includes(playerTeamId)
      )
    : [];

  const record = completedTeamMatches.reduce(
    (summary, match) => {
      const isTeamA = String(match.teamA) === playerTeamId;
      const teamScore = Number(match.score?.[isTeamA ? 'teamA' : 'teamB'] ?? 0);
      const opponentScore = Number(match.score?.[isTeamA ? 'teamB' : 'teamA'] ?? 0);

      summary.pointsFor += teamScore;
      summary.pointsAgainst += opponentScore;
      if (teamScore > opponentScore) summary.wins += 1;
      else if (teamScore === opponentScore) summary.draws += 1;
      else summary.losses += 1;
      return summary;
    },
    { wins: 0, draws: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }
  );

  const activeTournaments = tournaments
    .filter((tournament) => ['upcoming', 'ongoing'].includes(tournament.status))
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  return (
    <section className="home-dashboard">
      <section className="matchday-cover">
        <div>
          <p className="eyebrow">CAMPUSARENA / MATCHDAY</p>
          <h2>
            A place on the team.
            <br />A moment in the game.
          </h2>
          <p>Your campus competitions, from the first fixture to the final whistle.</p>
          <button
            type="button"
            className="primary-button"
            onClick={() =>
              document.getElementById('campus-competitions')?.scrollIntoView({ behavior: 'smooth' })
            }
          >
            Explore competitions <span aria-hidden="true">↗</span>
          </button>
        </div>
        <div className="matchday-cover-aside">
          <span className="cover-score">
            {activeTournaments.length.toString().padStart(2, '0')}
          </span>
          <span>
            COMPETITIONS
            <br />
            IN PLAY
          </span>
        </div>
      </section>
      {user?.role === 'referee' && (
        <section className="panel referee-home-panel">
          <button type="button" className="referee-home-toggle" onClick={onOpenRefereeDesk}>
            <span>
              <span className="eyebrow">Referee desk</span>
              <strong>Assigned matches</strong>
            </span>
            <span className="count-badge">{assignedMatches.length}</span>
          </button>
        </section>
      )}
      <section className="home-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Season stats</p>
            <h2>{playerTeam ? `${playerTeam.name} team record` : 'Player stats'}</h2>
          </div>
          <span className="muted">Completed matches</span>
        </div>
        <div className="stats-grid home-stats-grid">
          <article className="stat-card panel">
            <span>Matches played</span>
            <strong>{completedTeamMatches.length}</strong>
          </article>
          <article className="stat-card panel">
            <span>Wins</span>
            <strong>{record.wins}</strong>
          </article>
          <article className="stat-card panel">
            <span>Draws</span>
            <strong>{record.draws}</strong>
          </article>
          <article className="stat-card panel">
            <span>Losses</span>
            <strong>{record.losses}</strong>
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
        {player && (
          <p className="stats-footnote">
            These are your team’s match totals; individual goals or assists are not recorded yet.
          </p>
        )}
      </section>

      <section
        className={`panel recent-matches home-recent-dropdown ${recentOpen ? 'is-open' : ''}`}
      >
        <button
          type="button"
          className="recent-toggle"
          aria-expanded={recentOpen}
          aria-controls="home-recent-results"
          onClick={() => setRecentOpen((open) => !open)}
        >
          <span>Recently played matches</span>
          <span className="recent-chevron" aria-hidden="true">
            ⌄
          </span>
        </button>
        <div className="recent-slide" id="home-recent-results" aria-hidden={!recentOpen}>
          <div className="recent-slide-inner">
            <div className="recent-matches-content">
              <RecentMatches
                matches={completedTeamMatches}
                teamId={playerTeamId}
                tournaments={tournaments}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">On campus</p>
            <h2 id="campus-competitions">Active tournaments</h2>
          </div>
          <span className="count-badge">{activeTournaments.length}</span>
        </div>

        {activeTournaments.length === 0 ? (
          <div className="panel empty-state">
            <h3>No active tournaments yet</h3>
            <p className="muted">Upcoming and ongoing tournaments will appear here.</p>
          </div>
        ) : (
          <div className="tournament-grid">
            {activeTournaments.map((tournament) => (
              <article
                className="tournament-card panel clickable-card"
                key={String(tournament._id)}
              >
                <div className="tournament-card-top">
                  <span className={`status-label ${tournament.status === 'ongoing' ? 'live' : ''}`}>
                    {tournament.status}
                  </span>
                  <span className="muted">{tournament.sport}</span>
                </div>
                <h3>{tournament.name}</h3>
                <p className="muted">{tournament.venue}</p>
                <div className="tournament-card-footer">
                  <span>{formatDate(tournament.startDate)}</span>
                  <span>{tournament.teamIds?.length || 0} teams</span>
                </div>
                {['player', 'referee'].includes(user.role) && (
                  <label className="tournament-team-picker">
                    Enter with team
                    <select
                      value={entryTeams[String(tournament._id)] || ''}
                      onChange={(event) =>
                        setEntryTeams((current) => ({
                          ...current,
                          [String(tournament._id)]: event.target.value
                        }))
                      }
                    >
                      <option value="">Choose your team</option>
                      {teams
                        .filter(
                          (team) =>
                            [...(player?.teamIds || []), player?.teamId]
                              .filter(Boolean)
                              .some((id) => String(id) === String(team._id)) &&
                            (team.sport.toLowerCase() === 'all sports' ||
                              team.sport.toLowerCase() === tournament.sport.toLowerCase())
                        )
                        .map((team) => (
                          <option key={String(team._id)} value={String(team._id)}>
                            {team.name}
                          </option>
                        ))}
                    </select>
                    {!teams.some(
                      (team) =>
                        [...(player?.teamIds || []), player?.teamId]
                          .filter(Boolean)
                          .some((id) => String(id) === String(team._id)) &&
                        (team.sport.toLowerCase() === 'all sports' ||
                          team.sport.toLowerCase() === tournament.sport.toLowerCase())
                    ) && (
                      <span className="join-reason" role="status">
                        You cannot join yet: join a {tournament.sport} team first.
                      </span>
                    )}
                  </label>
                )}
                <div className="tournament-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="secondary-button tournament-details-btn"
                    onClick={() => onSelectTournament?.(tournament)}
                  >
                    Details & standings
                  </button>
                  {['player', 'referee'].includes(user.role) &&
                    (tournament.playerIds?.map(String).includes(String(user.id || user._id)) ? (
                      <span className="joined-label">Joined</span>
                    ) : (
                      <button
                        className="primary-button tournament-join-button"
                        onClick={() =>
                          onJoinTournament?.(
                            String(tournament._id),
                            entryTeams[String(tournament._id)]
                          )
                        }
                      >
                        Join tournament
                      </button>
                    ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
};

export default HomePage;
