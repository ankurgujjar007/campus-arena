const RecentMatches = ({ matches = [], teamId, tournaments = [] }) => {
  const recent = matches
    .filter((match) => match.status === 'completed')
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.scheduledAt || 0) - new Date(a.updatedAt || a.scheduledAt || 0)
    )
    .slice(0, 5);

  return (
    <section className="recent-player-matches" aria-label="Recently played matches">
      <h3>Recently played matches</h3>
      <p className="muted">Your team’s latest results</p>
      {!recent.length ? (
        <p className="muted">No completed team matches yet.</p>
      ) : (
        recent.map((match) => {
          const a = Number(match.score?.teamA ?? 0);
          const b = Number(match.score?.teamB ?? 0);
          const own = String(match.teamA) === String(teamId) ? a : b;
          const opponent = String(match.teamA) === String(teamId) ? b : a;
          const result = own === opponent ? 'Draw' : own > opponent ? 'Win' : 'Loss';
          const tournament = tournaments.find(
            (item) => String(item._id) === String(match.tournamentId || match.tournament)
          );
          const value = match.scheduledAt || match.updatedAt;
          const date = value ? new Date(value) : null;
          return (
            <article className="recent-player-result" key={String(match._id)}>
              <div>
                <strong>
                  {match.teamAName || 'Team A'} vs {match.teamBName || 'Team B'}
                </strong>
                <p className="muted">
                  {tournament?.name || 'Completed match'}
                  {date && !Number.isNaN(date.getTime())
                    ? ` · ${date.toLocaleDateString(undefined, { dateStyle: 'medium' })}`
                    : ''}
                </p>
              </div>
              <strong className="recent-result-score">
                {a} – {b}
              </strong>
              <span className={`result-badge result-${result.toLowerCase()}`}>{result}</span>
            </article>
          );
        })
      )}
    </section>
  );
};

export default RecentMatches;
