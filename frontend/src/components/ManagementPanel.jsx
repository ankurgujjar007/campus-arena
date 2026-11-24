import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';

const emptyData = { teams: [], tournaments: [], players: [], users: [], referees: [], matches: [] };
const idString = (value) => String(value?._id ?? value?.$oid ?? value ?? '');

const ManagementPanel = ({ token, role, onDataChanged }) => {
  const [data, setData] = useState(emptyData);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamSport, setTeamSport] = useState('');
  const [player, setPlayer] = useState({
    name: '',
    email: '',
    jerseyNumber: '',
    sport: '',
    teamId: ''
  });
  const [teamAssignment, setTeamAssignment] = useState({ playerId: '', teamId: '' });
  const [tournament, setTournament] = useState({ name: '', sport: '', venue: '', startDate: '' });
  const [registration, setRegistration] = useState({ tournamentId: '', teamId: '' });
  const [match, setMatch] = useState({
    tournamentId: '',
    teamA: '',
    teamB: '',
    scheduledAt: '',
    refereeId: ''
  });
  const [roleChange, setRoleChange] = useState({ userId: '', role: 'referee' });

  const loadData = useCallback(async () => {
    const [teams, tournaments, players, users, referees, matches] = await Promise.all([
      api.getTeams(token),
      api.getTournaments(token),
      api.getPlayers(token),
      role === 'admin' ? api.getUsers(token) : Promise.resolve([]),
      api.request('/auth/referees', token).then((result) => result.data || []),
      api.getMatches(token)
    ]);
    setData({ teams, tournaments, players, users, referees, matches });
  }, [role, token]);

  useEffect(() => {
    loadData().catch((loadError) => setError(loadError.message));
  }, [loadData]);

  const runAction = async (action, successMessage) => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await action();
      await loadData();
      if (onDataChanged) await onDataChanged();
      setMessage(successMessage);
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy(false);
    }
  };

  const authorizedManager = ['admin', 'event_manager'].includes(role);
  if (!authorizedManager) return null;

  const selectedPlayer = data.players.find((item) => String(item._id) === teamAssignment.playerId);
  const selectedMatchTournament = data.tournaments.find(
    (item) => idString(item._id) === idString(match.tournamentId)
  );
  const registeredMatchTeams = selectedMatchTournament
    ? data.teams.filter((team) =>
        (selectedMatchTournament.teamIds || []).some((id) => idString(id) === idString(team._id))
      )
    : [];
  const teamBOptions = registeredMatchTeams.filter(
    (team) => idString(team._id) !== idString(match.teamA)
  );
  const eligibleTeams = data.teams.filter((team) => {
    if (!selectedPlayer) return true;
    const interests = selectedPlayer.interestedSports || [selectedPlayer.sport];
    return interests.some((sport) => sport?.toLowerCase() === team.sport?.toLowerCase());
  });

  return (
    <section className="panel management-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Staff tools</p>
          <h2>Manage campus sports</h2>
        </div>
      </div>

      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="feedback" role="alert">
          {error}
        </p>
      )}

      <div className="management-grid">
        <form
          className="management-form"
          onSubmit={(event) => {
            event.preventDefault();
            runAction(async () => {
              await api.createTeam(token, { name: teamName, sport: teamSport });
              setTeamName('');
              setTeamSport('');
            }, 'Team created.');
          }}
        >
          <h3>Create team</h3>
          <label>
            Team name
            <input
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              required
            />
          </label>
          <label>
            Sport
            <input
              value={teamSport}
              onChange={(event) => setTeamSport(event.target.value)}
              required
            />
          </label>
          <button className="primary-button" disabled={busy}>
            Create team
          </button>
        </form>

        <form
          className="management-form"
          onSubmit={(event) => {
            event.preventDefault();
            runAction(async () => {
              await api.createTournament(token, {
                ...tournament,
                startDate: new Date(tournament.startDate).toISOString()
              });
              setTournament({ name: '', sport: '', venue: '', startDate: '' });
            }, 'Tournament created.');
          }}
        >
          <h3>Create tournament</h3>
          <label>
            Name
            <input
              value={tournament.name}
              onChange={(event) => setTournament({ ...tournament, name: event.target.value })}
              required
            />
          </label>
          <label>
            Sport
            <input
              value={tournament.sport}
              onChange={(event) => setTournament({ ...tournament, sport: event.target.value })}
              required
            />
          </label>
          <label>
            Venue
            <input
              value={tournament.venue}
              onChange={(event) => setTournament({ ...tournament, venue: event.target.value })}
              required
            />
          </label>
          <label>
            Start date
            <input
              type="datetime-local"
              value={tournament.startDate}
              onChange={(event) => setTournament({ ...tournament, startDate: event.target.value })}
              required
            />
          </label>
          <button className="primary-button" disabled={busy}>
            Create tournament
          </button>
        </form>

        <form
          className="management-form"
          onSubmit={(event) => {
            event.preventDefault();
            runAction(async () => {
              await api.createPlayer(token, {
                ...player,
                jerseyNumber: Number(player.jerseyNumber)
              });
              setPlayer({ name: '', email: '', jerseyNumber: '', sport: '', teamId: '' });
            }, 'Player added.');
          }}
        >
          <h3>Add player</h3>
          <label>
            Name
            <input
              value={player.name}
              onChange={(event) => setPlayer({ ...player, name: event.target.value })}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={player.email}
              onChange={(event) => setPlayer({ ...player, email: event.target.value })}
              required
            />
          </label>
          <label>
            Jersey number
            <input
              type="number"
              min="0"
              step="1"
              value={player.jerseyNumber}
              onChange={(event) => setPlayer({ ...player, jerseyNumber: event.target.value })}
              required
            />
          </label>
          <label>
            Sport
            <input
              value={player.sport}
              onChange={(event) => setPlayer({ ...player, sport: event.target.value })}
              required
            />
          </label>
          <label>
            Team
            <select
              value={player.teamId}
              onChange={(event) => setPlayer({ ...player, teamId: event.target.value })}
              required
            >
              <option value="">Choose a team</option>
              {data.teams.map((item) => (
                <option key={String(item._id)} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" disabled={busy || !data.teams.length}>
            Add player
          </button>
        </form>

        <form
          className="management-form"
          onSubmit={(event) => {
            event.preventDefault();
            const team = data.teams.find((item) => String(item._id) === teamAssignment.teamId);
            runAction(
              () =>
                api.updatePlayer(token, teamAssignment.playerId, {
                  teamId: teamAssignment.teamId,
                  sport: team.sport
                }),
              'Player assigned to team.'
            );
          }}
        >
          <h3>Assign player to team</h3>
          <label>
            Player
            <select
              value={teamAssignment.playerId}
              onChange={(event) => setTeamAssignment({ playerId: event.target.value, teamId: '' })}
              required
            >
              <option value="">Choose a player</option>
              {data.players.map((item) => (
                <option key={String(item._id)} value={item._id}>
                  {item.name} · {item.email}
                </option>
              ))}
            </select>
          </label>
          <label>
            Matching team
            <select
              value={teamAssignment.teamId}
              onChange={(event) =>
                setTeamAssignment({ ...teamAssignment, teamId: event.target.value })
              }
              required
            >
              <option value="">Choose a team</option>
              {eligibleTeams.map((item) => (
                <option key={String(item._id)} value={item._id}>
                  {item.name} · {item.sport}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary-button"
            disabled={busy || !selectedPlayer || !eligibleTeams.length}
          >
            Assign team
          </button>
        </form>

        <form
          className="management-form"
          onSubmit={(event) => {
            event.preventDefault();
            runAction(async () => {
              await api.registerTeam(token, registration.tournamentId, registration.teamId);
              setRegistration({ tournamentId: '', teamId: '' });
            }, 'Team registered in the tournament.');
          }}
        >
          <h3>Register team</h3>
          <label>
            Tournament
            <select
              value={registration.tournamentId}
              onChange={(event) =>
                setRegistration({ ...registration, tournamentId: event.target.value })
              }
              required
            >
              <option value="">Choose a tournament</option>
              {data.tournaments.map((item) => (
                <option key={String(item._id)} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Team
            <select
              value={registration.teamId}
              onChange={(event) => setRegistration({ ...registration, teamId: event.target.value })}
              required
            >
              <option value="">Choose a team</option>
              {data.teams.map((item) => (
                <option key={String(item._id)} value={item._id}>
                  {item.name} · {item.sport}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary-button"
            disabled={busy || !data.teams.length || !data.tournaments.length}
          >
            Register team
          </button>
        </form>

        <form
          className="management-form"
          onSubmit={(event) => {
            event.preventDefault();
            const teamAName =
              registeredMatchTeams.find((item) => idString(item._id) === idString(match.teamA))
                ?.name || 'Team A';
            const teamBName =
              registeredMatchTeams.find((item) => idString(item._id) === idString(match.teamB))
                ?.name || 'Team B';
            runAction(async () => {
              await api.createMatch(token, {
                tournamentId: match.tournamentId,
                teamA: match.teamA,
                teamB: match.teamB,
                ...(match.refereeId ? { refereeId: match.refereeId } : {}),
                ...(match.scheduledAt
                  ? { scheduledAt: new Date(match.scheduledAt).toISOString() }
                  : {})
              });
              setMatch({ tournamentId: '', teamA: '', teamB: '', scheduledAt: '', refereeId: '' });
            }, `Match scheduled successfully: ${teamAName} vs ${teamBName}.`);
          }}
        >
          <h3>Create match</h3>
          <label>
            Tournament
            <select
              value={match.tournamentId}
              onChange={(event) =>
                setMatch({ ...match, tournamentId: event.target.value, teamA: '', teamB: '' })
              }
              required
            >
              <option value="">Choose a tournament</option>
              {data.tournaments.map((item) => (
                <option key={String(item._id)} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Team A
            <select
              value={match.teamA}
              onChange={(event) =>
                setMatch({
                  ...match,
                  teamA: event.target.value,
                  teamB: idString(match.teamB) === event.target.value ? '' : match.teamB
                })
              }
              required
              disabled={!match.tournamentId}
            >
              <option value="">
                {match.tournamentId
                  ? registeredMatchTeams.length
                    ? 'Choose a registered team'
                    : 'No teams registered'
                  : 'Choose a tournament first'}
              </option>
              {registeredMatchTeams.map((item) => (
                <option key={String(item._id)} value={item._id}>
                  {item.name} · {item.sport}
                </option>
              ))}
            </select>
          </label>
          <label>
            Team B
            <select
              value={match.teamB}
              onChange={(event) => setMatch({ ...match, teamB: event.target.value })}
              required
              disabled={!match.tournamentId || !match.teamA}
            >
              <option value="">
                {match.teamA ? 'Choose another registered team' : 'Choose Team A first'}
              </option>
              {teamBOptions.map((item) => (
                <option key={String(item._id)} value={item._id}>
                  {item.name} · {item.sport}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scheduled time
            <input
              type="datetime-local"
              step="60"
              value={match.scheduledAt}
              onChange={(event) => setMatch({ ...match, scheduledAt: event.target.value })}
            />
          </label>
          <label>
            Referee
            <select
              value={match.refereeId}
              onChange={(event) => setMatch({ ...match, refereeId: event.target.value })}
            >
              <option value="">Assign later</option>
              {data.referees.map((referee) => (
                <option key={String(referee._id)} value={String(referee._id)}>
                  {referee.name} · {referee.email}
                </option>
              ))}
            </select>
          </label>
          {match.tournamentId && registeredMatchTeams.length < 2 && (
            <p className="muted">
              Register at least two teams in this tournament before scheduling a match.
            </p>
          )}
          <button
            className="primary-button"
            disabled={
              busy || !match.tournamentId || !match.teamA || !match.teamB || !teamBOptions.length
            }
          >
            Create match
          </button>
        </form>

        <section className="management-form scheduled-match-list">
          <h3>Matches & referee assignments ({data.matches.length})</h3>
          {!data.matches.length ? (
            <p className="muted">No matches scheduled yet.</p>
          ) : (
            <div className="match-list">
              {data.matches.map((item) => {
                const tournamentName =
                  data.tournaments.find(
                    (entry) => idString(entry._id) === idString(item.tournamentId)
                  )?.name || 'Tournament';
                const time = item.scheduledAt
                  ? new Date(item.scheduledAt).toLocaleString()
                  : 'Time to be announced';
                const assignedRefereeId = idString(item.refereeId);
                return (
                  <article className="management-match-row" key={idString(item._id)}>
                    <div className="match-row">
                      <span className="match-row-teams">
                        {item.teamAName} <small>vs</small> {item.teamBName}
                        <span className="muted">
                          {tournamentName} · {time}
                        </span>
                      </span>
                      <span className={`status-label ${item.status === 'live' ? 'live' : ''}`}>
                        {item.status}
                      </span>
                    </div>
                    <label>
                      Referee
                      <select
                        value={assignedRefereeId}
                        disabled={busy}
                        onChange={async (event) => {
                          const refereeId = event.target.value;
                          await runAction(
                            () =>
                              api.request(`/matches/${item._id}/referee`, token, {
                                method: 'PATCH',
                                body: JSON.stringify({ refereeId: refereeId || null })
                              }),
                            refereeId ? 'Referee assigned to match.' : 'Referee assignment removed.'
                          );
                        }}
                      >
                        <option value="">Unassigned</option>
                        {data.referees.map((referee) => (
                          <option key={idString(referee._id)} value={idString(referee._id)}>
                            {referee.name} · {referee.email}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {role === 'admin' && (
          <form
            className="management-form"
            onSubmit={(event) => {
              event.preventDefault();
              runAction(async () => {
                await api.updateUserRole(token, roleChange.userId, roleChange.role);
                setRoleChange({ userId: '', role: 'referee' });
              }, 'User role updated. They need to sign in again to receive the new role in their token.');
            }}
          >
            <h3>Assign trusted role</h3>
            <label>
              User
              <select
                value={roleChange.userId}
                onChange={(event) => setRoleChange({ ...roleChange, userId: event.target.value })}
                required
              >
                <option value="">Choose a user</option>
                {data.users.map((item) => (
                  <option key={String(item._id)} value={item._id}>
                    {item.name} · {item.email} · {item.role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Role
              <select
                value={roleChange.role}
                onChange={(event) => setRoleChange({ ...roleChange, role: event.target.value })}
              >
                <option value="player">Player</option>
                <option value="referee">Referee</option>
                <option value="event_manager">Event manager</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button className="primary-button" disabled={busy || !data.users.length}>
              Update role
            </button>
          </form>
        )}
      </div>

      <p className="management-summary">
        {data.teams.length} teams · {data.players.length} players · {data.tournaments.length}{' '}
        tournaments
      </p>
    </section>
  );
};

export default ManagementPanel;
