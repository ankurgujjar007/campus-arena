import Icon from './Icon';
import ThemeToggle from './ThemeToggle';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import sportLineups from '../../../shared/sportLineups.json';

const emptyData = { teams: [], tournaments: [], players: [], users: [], matches: [] };

const AdminConsole = ({ token, user, onDataChanged, onLogout, theme, onToggleTheme }) => {
  const [data, setData] = useState(emptyData);
  const [activeTab, setActiveTab] = useState('tournaments');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(''), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  // Tournament creation form state
  const [tournament, setTournament] = useState({ name: '', sport: '', venue: '', startDate: '' });

  const [isScheduling, setIsScheduling] = useState(false);

  // Match creation form state
  const [newMatch, setNewMatch] = useState({
    tournamentId: '',
    teamA: '',
    teamB: '',
    scheduledAt: ''
  });

  // Staff role filter
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchUserQuery, setSearchUserQuery] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [teams, tournaments, players, users, matches] = await Promise.all([
        api.getTeams(token),
        api.getTournaments(token),
        api.getPlayers(token),
        user?.role === 'admin' ? api.getUsers(token) : Promise.resolve([]),
        api.getMatches(token)
      ]);
      setData({ teams, tournaments, players, users, matches });
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [token, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runAction = async (action, successMsg) => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await action();
      await loadData();
      if (onDataChanged) await onDataChanged();
      setMessage(successMsg);
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (userId, targetRole) => {
    await runAction(
      () => api.updateUserRole(token, userId, targetRole),
      `User role updated to ${targetRole}. If they are currently signed in, they will receive the new permissions on their next login.`
    );
  };

  // Filtered users for Referee & Staff tab
  const filteredUsers = useMemo(() => {
    return (data.users || []).filter((u) => {
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const query = searchUserQuery.trim().toLowerCase();
      const matchesSearch =
        !query || u.name?.toLowerCase().includes(query) || u.email?.toLowerCase().includes(query);
      return matchesRole && matchesSearch;
    });
  }, [data.users, roleFilter, searchUserQuery]);

  const refereesCount = useMemo(() => {
    return (data.users || []).filter((u) => u.role === 'referee').length;
  }, [data.users]);

  const selectedTournament = data.tournaments.find(
    (item) => String(item._id) === String(newMatch.tournamentId)
  );
  const registeredMatchTeams = selectedTournament
    ? data.teams.filter((team) =>
        (selectedTournament.teamIds || []).some((id) => String(id?._id || id) === String(team._id))
      )
    : [];
  const teamBOptions = registeredMatchTeams.filter(
    (team) => String(team._id) !== String(newMatch.teamA)
  );
  const tournamentSports = [
    ...new Map(
      [
        ...Object.keys(sportLineups).filter((sport) => sport !== 'basketball 3v3'),
        ...data.teams
          .map((team) => team.sport)
          .filter((sport) => sport && sport.toLowerCase() !== 'all sports')
      ].map((sport) => [
        sport.trim().toLowerCase(),
        sport.trim().charAt(0).toUpperCase() + sport.trim().slice(1)
      ])
    ).values()
  ].sort();

  return (
    <section className="admin-console-shell">
      {/* Admin Header */}
      <div className="panel admin-console-header">
        <div>
          <div className="admin-badge-row">
            <span className="admin-status-pill">Administrator Workspace</span>
          </div>
          <h2>The competition desk.</h2>
          <p className="muted">Admin</p>
        </div>

        <div className="admin-header-actions">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          {onLogout && (
            <button type="button" className="secondary-button admin-logout-btn" onClick={onLogout}>
              Log out
            </button>
          )}
        </div>
      </div>

      <div className="admin-metrics-row">
        <div className="admin-metric">
          <span>Tournaments</span>
          <strong>{data.tournaments.length}</strong>
        </div>
        <div className="admin-metric">
          <span>Teams</span>
          <strong>{data.teams.length}</strong>
        </div>
        <div className="admin-metric">
          <span>Referees</span>
          <strong className="stat-referee">{refereesCount}</strong>
        </div>
        <div className="admin-metric">
          <span>Players</span>
          <strong>{data.players.length}</strong>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <nav className="admin-tabs" aria-label="Admin console navigation">
        <div className="rail-brand">
          <span className="rail-monogram">
            CA<span>↗</span>
          </span>
          <strong>CampusArena</strong>
          <small>THE CAMPUS SPORTS NETWORK</small>
        </div>
        <span className="rail-label">COMPETITION MANAGEMENT</span>
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'tournaments' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('tournaments');
            setMessage('');
            setError('');
          }}
        >
          <Icon name="trophy" /> Tournaments ({data.tournaments.length})
        </button>
        {user?.role === 'admin' && (
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'referees' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('referees');
              setMessage('');
              setError('');
            }}
          >
            <Icon name="users" /> Referees & Staff ({refereesCount} referees)
          </button>
        )}
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('matches');
            setMessage('');
            setError('');
          }}
        >
          <Icon name="calendar" /> Matches ({data.matches.length})
        </button>
      </nav>

      {(message || error) && (
        <div className={`admin-notification ${error ? 'is-error' : 'is-success'}`}>
          <span className="admin-notification-icon" aria-hidden="true">
            <Icon name={error ? 'alert' : 'check'} />
          </span>
          <p role={error ? 'alert' : 'status'}>{error || message}</p>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => {
              setMessage('');
              setError('');
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* TAB 1: TOURNAMENTS */}
      {activeTab === 'tournaments' && (
        <div className="admin-tab-pane">
          <div className="admin-grid-two-col">
            {/* Create Tournament Form */}
            <form
              className="panel admin-card-form"
              onSubmit={(e) => {
                e.preventDefault();
                runAction(async () => {
                  await api.createTournament(token, {
                    ...tournament,
                    startDate: new Date(tournament.startDate).toISOString()
                  });
                  setTournament({ name: '', sport: '', venue: '', startDate: '' });
                }, `Tournament "${tournament.name}" created successfully.`);
              }}
            >
              <div className="form-heading">
                <p className="eyebrow">New Event</p>
                <h3>Create Tournament</h3>
              </div>

              <label>
                Tournament Name
                <input
                  type="text"
                  value={tournament.name}
                  onChange={(e) => setTournament({ ...tournament, name: e.target.value })}
                  placeholder="e.g. Inter-Department Football Championship"
                  required
                />
              </label>

              <label>
                Sport
                <select
                  value={tournament.sport}
                  onChange={(e) => setTournament({ ...tournament, sport: e.target.value })}
                  required
                >
                  <option value="">Choose a sport</option>
                  {tournamentSports.map((sport) => (
                    <option key={sport} value={sport}>
                      {sport}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Venue / Location
                <input
                  type="text"
                  value={tournament.venue}
                  onChange={(e) => setTournament({ ...tournament, venue: e.target.value })}
                  placeholder="e.g. Main Campus Stadium, Court 2"
                  required
                />
              </label>

              <label>
                Start Date & Time
                <input
                  type="datetime-local"
                  value={tournament.startDate}
                  onChange={(e) => setTournament({ ...tournament, startDate: e.target.value })}
                  required
                />
              </label>

              <button className="primary-button" type="submit" disabled={busy}>
                {busy ? 'Creating tournament…' : 'Create Tournament'}
              </button>
            </form>

            {/* Existing Tournaments Overview */}
            <div className="panel admin-list-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Active & Upcoming</p>
                  <h3>Existing Tournaments ({data.tournaments.length})</h3>
                </div>
              </div>

              {data.tournaments.length === 0 ? (
                <p className="muted empty-state">
                  No tournaments created yet. Use the form to launch the first tournament.
                </p>
              ) : (
                <div className="admin-items-list">
                  {data.tournaments.map((t) => (
                    <article className="admin-item-card" key={String(t._id)}>
                      <div className="item-header">
                        <div>
                          <strong>{t.name}</strong>
                          <p className="muted">
                            {t.sport} · <Icon name="location" /> {t.venue}
                          </p>
                        </div>
                        <span className={`status-label ${t.status === 'ongoing' ? 'live' : ''}`}>
                          {t.status}
                        </span>
                      </div>
                      <div className="item-meta">
                        <span>
                          {new Date(t.startDate).toLocaleDateString([], { dateStyle: 'medium' })}
                        </span>
                        <span>{t.teamIds?.length || 0} teams registered</span>
                        <span>
                          <Icon name="users" /> {t.playerIds?.length || 0} players joined
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REFEREES & STAFF MANAGEMENT */}
      {activeTab === 'referees' && user?.role === 'admin' && (
        <div className="admin-tab-pane">
          <div className="panel admin-staff-panel">
            <div className="staff-header-controls">
              <div>
                <p className="eyebrow">Staff Authority & Roles</p>
                <h3>Assign Referees & Staff Permissions</h3>
                <p className="muted">
                  Referees receive real-time match score update permissions. Assign trusted roles to
                  campus users.
                </p>
              </div>

              <div className="staff-filter-row">
                <input
                  type="search"
                  className="staff-search-input"
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  placeholder="Search user by name or email…"
                  aria-label="Search users"
                />

                <div className="role-filter-pills">
                  {['all', 'referee', 'event_manager', 'player', 'admin'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`filter-pill ${roleFilter === r ? 'active' : ''}`}
                      onClick={() => setRoleFilter(r)}
                    >
                      {r === 'all' ? 'All accounts' : r.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Users Table */}
            {filteredUsers.length === 0 ? (
              <p className="muted empty-state">No users match the selected role or search query.</p>
            ) : (
              <div className="table-responsive">
                <table className="admin-users-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Current Role</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const isCurrentUser = String(u._id) === String(user.id || user._id);
                      return (
                        <tr key={String(u._id)}>
                          <td>
                            <strong>{u.name}</strong>
                            {isCurrentUser && <span className="self-tag">You</span>}
                          </td>
                          <td className="muted">{u.email}</td>
                          <td>
                            <span className={`role-pill role-${u.role}`}>
                              {u.role.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="actions-cell">
                            {/* Make Referee */}
                            {u.role !== 'referee' && (
                              <button
                                type="button"
                                className="action-btn-referee"
                                onClick={() => handleRoleChange(u._id, 'referee')}
                                disabled={busy}
                                title="Grant live match score update permissions"
                              >
                                Make Referee
                              </button>
                            )}

                            {/* Make Event Manager */}
                            {u.role !== 'event_manager' && (
                              <button
                                type="button"
                                className="action-btn-manager"
                                onClick={() => handleRoleChange(u._id, 'event_manager')}
                                disabled={busy}
                                title="Grant tournament and team management permissions"
                              >
                                <Icon name="settings" /> Event Manager
                              </button>
                            )}

                            {/* Make Admin */}
                            {u.role !== 'admin' && (
                              <button
                                type="button"
                                className="action-btn-admin"
                                onClick={() => handleRoleChange(u._id, 'admin')}
                                disabled={busy}
                                title="Grant full administrative permissions"
                              >
                                Make Admin
                              </button>
                            )}

                            {/* Demote to Player */}
                            {u.role !== 'player' && !isCurrentUser && (
                              <button
                                type="button"
                                className="action-btn-player"
                                onClick={() => handleRoleChange(u._id, 'player')}
                                disabled={busy}
                                title="Reset to standard player account"
                              >
                                Reset to Player
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'matches' && (
        <section className="panel admin-list-panel" aria-label="All matches">
          <div className="admin-fixtures-heading">
            <h3>All matches ({data.matches.length})</h3>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setNewMatch({ tournamentId: '', teamA: '', teamB: '', scheduledAt: '' });
                setIsScheduling(true);
              }}
            >
              Schedule match
            </button>
          </div>
          {!data.matches.length && <p className="muted">No matches scheduled yet.</p>}
          {data.matches.map((match) => {
            const event = data.tournaments.find(
              (item) => String(item._id) === String(match.tournamentId)
            );
            return (
              <article className="admin-tournament-fixture" key={String(match._id)}>
                <div>
                  <strong>
                    {match.teamAName} vs {match.teamBName}
                  </strong>
                  <p className="muted">
                    {event?.name || 'Tournament unavailable'} ·{' '}
                    {match.scheduledAt
                      ? new Date(match.scheduledAt).toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })
                      : 'Time to be announced'}
                  </p>
                </div>
                <span className={`status-label ${match.status === 'live' ? 'live' : ''}`}>
                  {match.status}
                </span>
                <label>
                  Referee
                  <select
                    aria-label={`Referee for ${match.teamAName} vs ${match.teamBName}`}
                    value={String(match.refereeId || '')}
                    disabled={busy || ['completed', 'cancelled'].includes(match.status)}
                    onChange={(event) => {
                      const refereeId = event.target.value;
                      runAction(
                        () =>
                          api.request(`/matches/${match._id}/referee`, token, {
                            method: 'PATCH',
                            body: JSON.stringify({ refereeId: refereeId || null })
                          }),
                        'Referee assignment updated.'
                      );
                    }}
                  >
                    <option value="">Unassigned</option>
                    {data.users
                      .filter((account) => account.role === 'referee')
                      .map((account) => (
                        <option key={String(account._id)} value={String(account._id)}>
                          {account.name}
                        </option>
                      ))}
                  </select>
                </label>
              </article>
            );
          })}
        </section>
      )}

      {isScheduling && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!busy) setIsScheduling(false);
          }}
        >
          <section
            className="modal-card panel admin-schedule-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-match-title"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !busy) setIsScheduling(false);
            }}
          >
            {/* Create / Schedule Match */}
            <form
              className="management-form"
              onSubmit={(e) => {
                e.preventDefault();
                runAction(async () => {
                  await api.createMatch(token, {
                    tournamentId: newMatch.tournamentId,
                    teamA: newMatch.teamA,
                    teamB: newMatch.teamB,
                    scheduledAt: new Date(newMatch.scheduledAt).toISOString()
                  });
                  setNewMatch({ tournamentId: '', teamA: '', teamB: '', scheduledAt: '' });
                  setIsScheduling(false);
                }, 'Match scheduled successfully.');
              }}
            >
              <div className="admin-fixtures-heading">
                <h3 id="schedule-match-title">Schedule match</h3>
                <button
                  type="button"
                  className="secondary-button"
                  aria-label="Close scheduling dialog"
                  disabled={busy}
                  onClick={() => setIsScheduling(false)}
                >
                  Close
                </button>
              </div>
              <p className="muted">All fields are required (*).</p>
              <label>
                Tournament *
                <select
                  value={newMatch.tournamentId}
                  onChange={(e) =>
                    setNewMatch({ ...newMatch, tournamentId: e.target.value, teamA: '', teamB: '' })
                  }
                  required
                >
                  <option value="">Choose a tournament</option>
                  {data.tournaments.map((item) => (
                    <option key={String(item._id)} value={item._id}>
                      {item.name} ({item.sport})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Team A *
                <select
                  value={newMatch.teamA}
                  onChange={(e) =>
                    setNewMatch({
                      ...newMatch,
                      teamA: e.target.value,
                      teamB: String(newMatch.teamB) === e.target.value ? '' : newMatch.teamB
                    })
                  }
                  required
                  disabled={!newMatch.tournamentId}
                >
                  <option value="">
                    {newMatch.tournamentId
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
                Team B *
                <select
                  value={newMatch.teamB}
                  onChange={(e) => setNewMatch({ ...newMatch, teamB: e.target.value })}
                  required
                  disabled={!newMatch.teamA}
                >
                  <option value="">
                    {newMatch.teamA ? 'Choose another registered team' : 'Choose Team A first'}
                  </option>
                  {teamBOptions.map((item) => (
                    <option key={String(item._id)} value={item._id}>
                      {item.name} · {item.sport}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Scheduled Time *
                <input
                  type="datetime-local"
                  step="60"
                  value={newMatch.scheduledAt}
                  onChange={(e) => setNewMatch({ ...newMatch, scheduledAt: e.target.value })}
                  required
                />
              </label>
              {newMatch.tournamentId && registeredMatchTeams.length < 2 && (
                <p className="muted">
                  Register at least two teams in this tournament before scheduling a match.
                </p>
              )}
              <button
                className="primary-button"
                disabled={busy || !newMatch.tournamentId || !newMatch.teamA || !newMatch.teamB}
              >
                Schedule Match
              </button>
            </form>
          </section>
        </div>
      )}
    </section>
  );
};

export default AdminConsole;
