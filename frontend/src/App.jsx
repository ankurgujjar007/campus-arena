import Icon from './components/Icon';
import ThemeToggle from './components/ThemeToggle';
import RefereeDesk from './components/RefereeDesk';
import TournamentEntry from './components/TournamentEntry';
import CreateTeam from './components/CreateTeam';
import { useEffect, useState, useRef } from 'react';
import { api } from './services/api';
import { connectSocket, disconnectSocket, socket } from './services/socket';
import ManagementPanel from './components/ManagementPanel';
import AdminConsole from './components/AdminConsole';
import HomePage from './pages/HomePage';
import PlayerOnboarding from './components/PlayerOnboarding';
import EditProfileModal from './components/EditProfileModal';
import PlayersPage from './pages/PlayersPage';
import TournamentDetailsModal from './components/TournamentDetailsModal';
import TeamDetailsModal from './components/TeamDetailsModal';

const SCORE_EDITOR_ROLES = ['admin', 'referee', 'event_manager'];
const SESSION_KEY = 'campusarena-session-token';
const readSavedToken = () => {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
};

const App = () => {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('campusarena-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('campusarena-theme', theme);
    } catch {
      /* Storage may be unavailable. */
    }
  }, [theme]);
  const toggleTheme = () => setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [playerProfile, setPlayerProfile] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const [token, setToken] = useState(null);
  const [matches, setMatches] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [liveStates, setLiveStates] = useState({});
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [foulTeamId, setFoulTeamId] = useState('');
  const [foulPlayerId, setFoulPlayerId] = useState('');
  const [foulType, setFoulType] = useState('Foul');
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState('');
  const [teamSelectionToast, setTeamSelectionToast] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socketStatus, setSocketStatus] = useState('Not connected');
  const [activePage, setActivePage] = useState('home');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [entryRequest, setEntryRequest] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const restoringStarted = useRef(false);
  const [restoringSession, setRestoringSession] = useState(Boolean(readSavedToken()));
  const [restoreError, setRestoreError] = useState('');

  useEffect(() => {
    if (!teamSelectionToast) return undefined;
    const timer = window.setTimeout(() => setTeamSelectionToast(false), 3200);
    return () => window.clearTimeout(timer);
  }, [teamSelectionToast]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  useEffect(() => {
    const onConnect = () => setSocketStatus('Connected');
    const onConnectError = (error) => setSocketStatus(`Connection failed: ${error.message}`);
    const onDisconnect = () => setSocketStatus('Disconnected');
    const onMatchUpdate = (update) => {
      if (!update?.matchId) return;
      setLiveStates((current) => ({ ...current, [update.matchId]: update }));
      setMatches((current) =>
        current.map((match) =>
          String(match._id) === String(update.matchId)
            ? {
                ...match,
                score: update.score,
                status: update.status,
                timeline: update.timeline || match.timeline,
                updatedAt: update.updatedAt
              }
            : match
        )
      );
    };
    const onMatchError = (error) => setMessage(error?.message || 'Match room error.');
    const onScoreError = (error) => setMessage(error?.message || 'Score update failed.');

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);
    socket.on('match-update', onMatchUpdate);
    socket.on('match-error', onMatchError);
    socket.on('match-update-error', onScoreError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('disconnect', onDisconnect);
      socket.off('match-update', onMatchUpdate);
      socket.off('match-error', onMatchError);
      socket.off('match-update-error', onScoreError);
    };
  }, []);

  useEffect(() => {
    const selectedLiveState = liveStates[selectedMatchId];
    if (selectedLiveState?.score) {
      setScoreA(selectedLiveState.score.teamA ?? 0);
      setScoreB(selectedLiveState.score.teamB ?? 0);
    }
  }, [liveStates, selectedMatchId]);

  const refreshMatches = async (sessionToken = token) => {
    if (!sessionToken) return;
    const matchList = await api.getMatches(sessionToken);
    setMatches(matchList);

    const initialStates = Object.fromEntries(
      matchList.map((match) => [
        String(match._id),
        {
          matchId: String(match._id),
          score: match.score || { teamA: 0, teamB: 0 },
          status: match.status,
          timeline: match.timeline || [],
          updatedAt: match.updatedAt
        }
      ])
    );
    setLiveStates((current) => ({ ...initialStates, ...current }));

    if (matchList.length) {
      const currentSelectionExists = matchList.some(
        (match) => String(match._id) === selectedMatchId
      );
      const matchToSelect = currentSelectionExists
        ? matchList.find((match) => String(match._id) === selectedMatchId)
        : matchList[0];
      const matchId = String(matchToSelect._id);
      setSelectedMatchId(matchId);
      socket.emit('join-match', matchId);
    } else {
      setSelectedMatchId('');
    }
  };

  const refreshHomeData = async (sessionToken = token) => {
    if (!sessionToken) return;
    const [tournamentList, teamList, playerList] = await Promise.all([
      api.getTournaments(sessionToken),
      api.getTeams(sessionToken),
      api.getPlayers(sessionToken)
    ]);
    setTournaments(tournamentList);
    setTeams(teamList);
    setPlayers(playerList);
  };

  const establishSession = async ({ user: signedInUser, token: sessionToken }) => {
    try {
      localStorage.setItem(SESSION_KEY, sessionToken);
    } catch {
      /* Storage may be unavailable. */
    }
    setUser(signedInUser);
    setToken(sessionToken);
    setActivePage('home');
    setPlayerProfile(null);
    setProfileReady(signedInUser.role !== 'player');
    connectSocket(sessionToken);
    setMessage('');

    try {
      const profile = await api.getMyPlayerProfile(sessionToken);
      setPlayerProfile(profile);
      setProfileReady(true);
      if (signedInUser.role === 'player') {
        const profileIsComplete = Boolean(
          profile?.username &&
          profile?.name &&
          Array.isArray(profile.interestedSports) &&
          profile.interestedSports.length
        );
        if (!profileIsComplete) {
          setActivePage('onboarding');
          return;
        }
      }

      await Promise.all([refreshMatches(sessionToken), refreshHomeData(sessionToken)]);
    } catch (error) {
      if (error.status === 401) {
        handleLogout();
        setMessage('Your session has expired. Please sign in again.');
        return;
      }
      setProfileReady(true);
      setMessage(`Signed in, but matches could not be loaded: ${error.message}`);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      const session = isRegistering
        ? await api.register({ name, email, password })
        : await api.login({ email, password });
      await establishSession(session);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* Storage may be unavailable. */
    }
    disconnectSocket();
    setUser(null);
    setPlayerProfile(null);
    setProfileReady(false);
    setToken(null);
    setMatches([]);
    setTournaments([]);
    setTeams([]);
    setPlayers([]);
    setLiveStates({});
    setSelectedMatchId('');
    setActivePage('home');
    setPassword('');
    setMessage('You have been logged out.');
  };

  useEffect(() => {
    if (restoringStarted.current) return;
    restoringStarted.current = true;
    const savedToken = readSavedToken();
    if (!savedToken) {
      setRestoringSession(false);
      return;
    }
    (async () => {
      try {
        const result = await api.request('/auth/me', savedToken);
        await establishSession({ user: result.data, token: savedToken });
      } catch (error) {
        if (error.status === 401) {
          handleLogout();
          setMessage('Your session has expired. Please sign in again.');
        } else {
          setRestoreError(
            'Unable to restore your session. Check that the backend is running and retry.'
          );
        }
      } finally {
        setRestoringSession(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let expiresAt;
    try {
      expiresAt =
        JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000;
    } catch {
      handleLogout();
      return undefined;
    }
    const expireSession = () => {
      handleLogout();
      setMessage('Your session has expired. Please sign in again.');
    };
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      expireSession();
      return undefined;
    }
    const timer = window.setTimeout(expireSession, expiresAt - Date.now());
    return () => window.clearTimeout(timer);
  }, [token]);

  const joinMatch = (match) => {
    const matchId = String(match._id);
    setSelectedMatchId(matchId);
    setScoreA(match.score?.teamA ?? 0);
    setScoreB(match.score?.teamB ?? 0);
    socket.emit('join-match', matchId);
  };

  const sendScoreUpdate = (status) => {
    if (!selectedMatchId || !token) return;
    if (
      !Number.isInteger(Number(scoreA)) ||
      Number(scoreA) < 0 ||
      !Number.isInteger(Number(scoreB)) ||
      Number(scoreB) < 0
    ) {
      setMessage('Enter whole, non-negative scores for both teams.');
      return;
    }
    socket.emit('match-update', {
      matchId: selectedMatchId,
      score: { teamA: Number(scoreA), teamB: Number(scoreB) },
      status
    });
    setMessage('Score update sent.');
  };

  const sendFoulUpdate = (event) => {
    event.preventDefault();
    if (!selectedMatchId || !foulTeamId) {
      setMessage('Select a team before recording a match event.');
      return;
    }
    socket.emit('match-foul', {
      matchId: selectedMatchId,
      teamId: foulTeamId,
      playerId: foulPlayerId || null,
      foulType
    });
    setFoulPlayerId('');
  };

  const completePlayerProfile = async (profile) => {
    setPlayerProfile(profile);
    setActivePage('home');
    setMessage('Player profile saved successfully.');
    try {
      await Promise.all([refreshMatches(token), refreshHomeData(token)]);
    } catch (error) {
      setMessage(`Profile saved, but dashboard data could not be refreshed: ${error.message}`);
    }
  };

  const selectedMatch = matches.find((match) => String(match._id) === selectedMatchId);
  const selectedState = liveStates[selectedMatchId];
  const canEditScores = SCORE_EDITOR_ROLES.includes(user?.role);
  const matchIsFinal = ['completed', 'cancelled'].includes(
    selectedState?.status || selectedMatch?.status
  );
  const selectedTournamentObj = selectedMatch?.tournamentId
    ? tournaments.find((t) => String(t._id) === String(selectedMatch.tournamentId))
    : null;
  const selectedTeamAObj = selectedMatch?.teamA
    ? teams.find((t) => String(t._id) === String(selectedMatch.teamA))
    : null;
  const selectedTeamBObj = selectedMatch?.teamB
    ? teams.find((t) => String(t._id) === String(selectedMatch.teamB))
    : null;
  const matchTimeline = selectedState?.timeline || selectedMatch?.timeline || [];

  if (restoringSession || restoreError) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>{restoringSession ? 'Restoring your session…' : 'Unable to connect'}</h1>
          {restoreError && (
            <>
              <p role="alert">{restoreError}</p>
              <button
                type="button"
                className="primary-button"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setRestoreError('');
                  handleLogout();
                }}
              >
                Sign out
              </button>
            </>
          )}
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-shell auth-entry">
        <aside className="athletics-cover" aria-label="CampusArena athletics">
          <div className="brand-lockup">
            <img
              className="brand-logo"
              src="/images/campusarena-logo-v2.png"
              alt=""
              width="48"
              height="48"
            />{' '}
            CampusArena
          </div>
          <div className="cover-copy">
            <p className="eyebrow">Campus sport. All together.</p>
            <h2>
              Your campus.
              <br />
              Your team.
              <br />
              <em>Your game.</em>
            </h2>
            <p>
              Find your next tournament. Follow every score.
              <br />
              Be part of the season.
            </p>
          </div>

          <footer className="cover-footer">
            <span>Made for the campus community</span>
            <span>Play. Compete. Belong.</span>
          </footer>
        </aside>
        <section className="auth-card">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <p className="eyebrow">CampusArena / Account</p>
          <h1>{isRegistering ? 'Join the roster.' : 'Back in the game.'}</h1>
          <p className="muted">Your teams, tournaments, and matchday updates.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegistering && (
              <label>
                Name
                <input value={name} onChange={(event) => setName(event.target.value)} required />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
                required
              />
            </label>
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : isRegistering ? 'Create account' : 'Log in'}
            </button>
          </form>

          <button
            className="text-button"
            onClick={() => {
              setIsRegistering((current) => !current);
              setMessage('');
            }}
          >
            {isRegistering ? 'Already registered? Log in' : 'New to CampusArena? Create an account'}
          </button>
          {message && (
            <p className="feedback" role="status">
              {message}
            </p>
          )}
        </section>
      </main>
    );
  }

  if (user.role === 'player' && !profileReady) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand-lockup dashboard-brand">
            <img
              className="brand-logo"
              src="/images/campusarena-logo-v2.png"
              alt=""
              width="40"
              height="40"
            />
            <span>CampusArena</span>
          </div>
          <h1>Loading your profile…</h1>
        </section>
      </main>
    );
  }

  const needsPlayerOnboarding =
    user.role === 'player' &&
    (!playerProfile?.username ||
      !playerProfile?.name ||
      !Array.isArray(playerProfile.interestedSports) ||
      !playerProfile.interestedSports.length);

  if (needsPlayerOnboarding) {
    return (
      <PlayerOnboarding
        user={user}
        token={token}
        existingProfile={playerProfile}
        onComplete={completePlayerProfile}
      />
    );
  }

  if (user.role === 'admin') {
    return (
      <main className="app-shell admin-workspace-shell">
        <AdminConsole
          token={token}
          user={user}
          socketStatus={socketStatus}
          theme={theme}
          onToggleTheme={toggleTheme}
          onLogout={handleLogout}
          onDataChanged={async () => Promise.all([refreshMatches(token), refreshHomeData(token)])}
        />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="dashboard-header">
        <div>
          <div className="brand-lockup dashboard-brand">
            <img
              className="brand-logo"
              src="/images/campusarena-logo-v2.png"
              alt=""
              width="40"
              height="40"
            />
            <span>CampusArena</span>
          </div>
          <h1>
            {activePage === 'home'
              ? 'Home'
              : activePage === 'matches'
                ? 'Match Centre'
                : activePage === 'teams'
                  ? 'Manage Team'
                  : activePage === 'players'
                    ? 'Community'
                    : activePage === 'referee'
                      ? 'Referee desk'
                      : 'Management'}
          </h1>
          <p className="muted">{user.name}</p>
        </div>
        <div className="header-actions">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <div className="profile-menu-container" ref={profileMenuRef}>
            <button
              type="button"
              className="header-avatar-btn"
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
              aria-expanded={isProfileMenuOpen}
              aria-haspopup="true"
              aria-label="Account menu"
            >
              <span className="player-avatar-small">
                {playerProfile?.name?.slice(0, 1)?.toUpperCase() ||
                  user.name?.slice(0, 1)?.toUpperCase() ||
                  'P'}
              </span>
              <span className="header-user-name">{playerProfile?.name || user.name}</span>
              <span className="dropdown-chevron">{isProfileMenuOpen ? '▴' : '▾'}</span>
            </button>

            {isProfileMenuOpen && (
              <div className="profile-dropdown-menu panel" role="menu">
                <div className="dropdown-user-info">
                  <strong>{playerProfile?.name || user.name}</strong>
                  {playerProfile?.username && (
                    <span className="dropdown-handle">@{playerProfile.username}</span>
                  )}
                  <span className="dropdown-role-pill">{user.role.replace('_', ' ')}</span>
                </div>
                {playerProfile && (
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      setIsEditingProfile(true);
                    }}
                    role="menuitem"
                  >
                    <svg
                      className="menu-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m16 3 5 5-12 12-6 1 1-6Z" />
                      <path d="m14 5 5 5" />
                    </svg>
                    Edit profile
                  </button>
                )}
                <hr className="dropdown-divider" />
                <button
                  type="button"
                  className="dropdown-item dropdown-item-danger"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    handleLogout();
                  }}
                  role="menuitem"
                >
                  <svg
                    className="menu-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 3v9" />
                    <path d="M6.3 5.6a9 9 0 1 0 11.4 0" />
                  </svg>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="sticky-nav-shell">
        <nav className="dashboard-nav" aria-label="Main navigation">
          <div className="rail-brand">
            <span className="rail-monogram">
              CA<span>↗</span>
            </span>
            <strong>CampusArena</strong>
            <small>THE CAMPUS SPORTS NETWORK</small>
          </div>
          <span className="rail-label">YOUR WORKSPACE</span>
          <button
            className={activePage === 'home' ? 'active' : ''}
            onClick={() => setActivePage('home')}
          >
            <Icon name="home" />
            Home
          </button>
          <button
            className={activePage === 'matches' ? 'active' : ''}
            onClick={() => setActivePage('matches')}
          >
            <Icon name="calendar" />
            Match Centre
          </button>
          <button
            className={activePage === 'teams' ? 'active' : ''}
            onClick={() => setActivePage('teams')}
          >
            <Icon name="users" />
            Manage Team
          </button>
          <button
            className={activePage === 'players' ? 'active' : ''}
            onClick={() => setActivePage('players')}
          >
            <Icon name="search" />
            Community
          </button>
          {user.role === 'event_manager' && (
            <button
              className={activePage === 'management' ? 'active' : ''}
              onClick={() => setActivePage('management')}
            >
              <Icon name="settings" />
              Management
            </button>
          )}
        </nav>
      </div>

      {message && (
        <p className="feedback" role="status">
          {message}
        </p>
      )}
      {teamSelectionToast && (
        <div className="team-selection-toast" role="alert">
          First select a team.
        </div>
      )}

      {activePage === 'teams' && (
        <section aria-label="Manage your teams">
          <CreateTeam
            player={playerProfile}
            teams={teams}
            players={players}
            onSelectTeam={setSelectedTeam}
            token={token}
            onCreated={async () => {
              const profile = await api.getMyPlayerProfile(token);
              setPlayerProfile(profile);
              await refreshHomeData(token);
              setMessage('');
            }}
          />
          {!playerProfile && (
            <p className="muted">Complete your player profile to create or join teams.</p>
          )}
        </section>
      )}

      {activePage === 'referee' && user.role === 'referee' && (
        <RefereeDesk
          user={user}
          matches={matches}
          players={players}
          tournaments={tournaments}
          onBack={() => setActivePage('home')}
        />
      )}

      {activePage === 'home' && (
        <>
          <HomePage
            user={user}
            playerProfile={playerProfile}
            token={token}
            players={players}
            teams={teams}
            tournaments={tournaments}
            matches={matches}
            onOpenRefereeDesk={async () => {
              setActivePage('referee');
              try {
                await Promise.all([refreshMatches(token), refreshHomeData(token)]);
              } catch (error) {
                setMessage(`Unable to refresh referee assignments: ${error.message}`);
              }
            }}
            onSelectTournament={setSelectedTournament}
            onSelectTeam={setSelectedTeam}
            onJoinTournament={(tournamentId, teamId) => {
              const tournament = tournaments.find((t) => String(t._id) === tournamentId);
              const team = teams.find((t) => String(t._id) === teamId);
              if (!team) {
                setTeamSelectionToast(true);
                return;
              }
              setSelectedTournament(null);
              setEntryRequest({ tournament, team });
            }}
          />
        </>
      )}

      {activePage === 'players' && (
        <PlayersPage
          key={profilePreview?.nonce || 'directory'}
          initialSelectedPlayer={profilePreview?.player}
          players={players}
          teams={teams}
          matches={matches}
          tournaments={tournaments}
          user={user}
          playerProfile={playerProfile}
          token={token}
          onViewTeam={setSelectedTeam}
        />
      )}

      {activePage === 'matches' && (
        <section className="match-layout">
          <section
            className="panel registered-tournaments"
            aria-labelledby="registered-tournaments-title"
          >
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Your competitions</p>
                <h2 id="registered-tournaments-title">Registered tournaments</h2>
              </div>
            </div>
            {(() => {
              const accountId = String(user.id || user._id);
              const teamId = playerProfile?.teamId ? String(playerProfile.teamId) : null;
              const registered = tournaments.filter(
                (tournament) =>
                  (tournament.playerIds || []).some((id) => String(id) === accountId) ||
                  (teamId && (tournament.teamIds || []).some((id) => String(id) === teamId))
              );
              if (!registered.length)
                return (
                  <p className="muted">
                    You haven’t registered for a tournament yet. Join one from Home to see it here.
                  </p>
                );
              return (
                <div className="registered-tournament-grid">
                  {registered.map((tournament) => {
                    const fixtures = matches.filter(
                      (match) =>
                        String(match.tournamentId || match.tournament) === String(tournament._id)
                    );
                    return (
                      <article className="registered-tournament-card" key={String(tournament._id)}>
                        <div className="panel-heading">
                          <span className="eyebrow">{tournament.sport}</span>
                          <span className="status-label">{tournament.status}</span>
                        </div>
                        <h3>{tournament.name}</h3>
                        <p className="muted">
                          {fixtures.length
                            ? `${fixtures.length} scheduled ${fixtures.length === 1 ? 'match' : 'matches'}`
                            : 'Fixtures haven’t been announced yet.'}
                        </p>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setSelectedTournament(tournament)}
                        >
                          Details & standings
                        </button>
                        {fixtures.map((match) => (
                          <button
                            type="button"
                            className="match-row"
                            key={String(match._id)}
                            onClick={() => joinMatch(match)}
                          >
                            <span>
                              {match.teamAName} vs {match.teamBName}
                            </span>
                            <span className="status-label">
                              {(liveStates[String(match._id)] || match).status}
                            </span>
                          </button>
                        ))}
                      </article>
                    );
                  })}
                </div>
              );
            })()}
          </section>
          <details className="panel recent-matches">
            <summary>
              <span>Recently played matches</span>
              <span className="recent-chevron" aria-hidden="true">
                ⌄
              </span>
            </summary>
            <div className="recent-matches-content">
              {(() => {
                const recent = matches
                  .map((match) => ({ ...match, ...(liveStates[String(match._id)] || {}) }))
                  .filter((match) => match.status === 'completed')
                  .sort(
                    (a, b) =>
                      new Date(b.updatedAt || b.scheduledAt || 0) -
                      new Date(a.updatedAt || a.scheduledAt || 0)
                  )
                  .slice(0, 10);
                if (!recent.length)
                  return (
                    <p className="muted">
                      No completed matches yet. Final results will appear here after a match
                      finishes.
                    </p>
                  );
                return recent.map((match) => {
                  const tournament = tournaments.find(
                    (item) => String(item._id) === String(match.tournamentId || match.tournament)
                  );
                  const date = new Date(match.updatedAt || match.scheduledAt);
                  return (
                    <button
                      type="button"
                      className="recent-result"
                      key={String(match._id)}
                      onClick={() => {
                        joinMatch(match);
                        document.querySelector('.live-panel')?.scrollIntoView({
                          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                            ? 'auto'
                            : 'smooth',
                          block: 'start'
                        });
                      }}
                    >
                      <span className="recent-result-teams">
                        {match.teamAName} <span className="muted">vs</span> {match.teamBName}
                      </span>
                      <strong className="recent-result-score">
                        {match.score?.teamA ?? 0} – {match.score?.teamB ?? 0}
                      </strong>
                      <span className="muted recent-result-meta">
                        {tournament?.name || 'Final result'}
                        {!Number.isNaN(date.getTime()) &&
                          ` · ${date.toLocaleDateString(undefined, { dateStyle: 'medium' })}`}
                      </span>
                    </button>
                  );
                });
              })()}
            </div>
          </details>
          <div className="panel match-list-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Schedule</p>
                <h2>Matches</h2>
              </div>
              <span className="count-badge">{matches.length}</span>
            </div>

            {matches.length === 0 ? (
              <p className="muted empty-state">
                No matches scheduled yet. Check back when the next fixtures are announced.
              </p>
            ) : (
              <div className="match-list">
                {matches.map((match) => {
                  const state = liveStates[String(match._id)] || match;
                  return (
                    <button
                      className={`match-row ${selectedMatchId === String(match._id) ? 'selected' : ''}`}
                      key={String(match._id)}
                      onClick={() => joinMatch(match)}
                    >
                      <span className="match-row-teams">
                        {match.teamAName} <small>vs</small> {match.teamBName}
                      </span>
                      <span className="match-row-meta">
                        <span>
                          {state.score?.teamA ?? 0} : {state.score?.teamB ?? 0}
                        </span>
                        <span className="status-label">{state.status}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <section className="panel live-panel">
            {selectedMatch ? (
              <>
                <div className="live-heading">
                  <div>
                    <div className="live-meta-row">
                      <p className="eyebrow">Live match</p>
                      {selectedTournamentObj && (
                        <button
                          type="button"
                          className="inline-tournament-badge"
                          onClick={() => setSelectedTournament(selectedTournamentObj)}
                          title="View tournament details & standings"
                        >
                          <Icon name="trophy" /> {selectedTournamentObj.name}
                        </button>
                      )}
                    </div>
                    <h2>
                      <button
                        type="button"
                        className="inline-team-heading-link"
                        onClick={() => selectedTeamAObj && setSelectedTeam(selectedTeamAObj)}
                        title="View team profile & roster"
                      >
                        {selectedMatch.teamAName}
                      </button>{' '}
                      <span>vs</span>{' '}
                      <button
                        type="button"
                        className="inline-team-heading-link"
                        onClick={() => selectedTeamBObj && setSelectedTeam(selectedTeamBObj)}
                        title="View team profile & roster"
                      >
                        {selectedMatch.teamBName}
                      </button>
                    </h2>
                  </div>
                  <span
                    className={`status-label large ${selectedState?.status === 'live' ? 'live' : ''}`}
                  >
                    {selectedState?.status || selectedMatch.status}
                  </span>
                </div>

                <div className="scoreboard">
                  <div className="score-team">
                    <span>{selectedMatch.teamAName}</span>
                    <strong>
                      {selectedState?.score?.teamA ?? selectedMatch.score?.teamA ?? 0}
                    </strong>
                  </div>
                  <span className="score-divider">:</span>
                  <div className="score-team">
                    <span>{selectedMatch.teamBName}</span>
                    <strong>
                      {selectedState?.score?.teamB ?? selectedMatch.score?.teamB ?? 0}
                    </strong>
                  </div>
                </div>

                <p className="muted match-id">Match ID: {selectedMatchId}</p>

                {canEditScores && !matchIsFinal && (
                  <form
                    className="score-editor"
                    onSubmit={(event) => {
                      event.preventDefault();
                      sendScoreUpdate('live');
                    }}
                  >
                    <p className="eyebrow">Score controls</p>
                    <div className="score-inputs">
                      <label>
                        {selectedMatch.teamAName}
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={scoreA}
                          onChange={(event) => setScoreA(event.target.value)}
                          required
                        />
                      </label>
                      <label>
                        {selectedMatch.teamBName}
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={scoreB}
                          onChange={(event) => setScoreB(event.target.value)}
                          required
                        />
                      </label>
                    </div>
                    <div className="score-actions">
                      <button className="primary-button" type="submit">
                        Update live score
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => sendScoreUpdate('completed')}
                      >
                        Finish match
                      </button>
                    </div>
                  </form>
                )}
                {user?.role === 'referee' &&
                  (selectedState?.status || selectedMatch?.status) === 'live' &&
                  !matchIsFinal && (
                    <form className="score-editor foul-editor" onSubmit={sendFoulUpdate}>
                      <p className="eyebrow">Record live foul</p>
                      <div className="score-inputs">
                        <label>
                          Team
                          <select
                            required
                            value={foulTeamId}
                            onChange={(event) => {
                              setFoulTeamId(event.target.value);
                              setFoulPlayerId('');
                            }}
                          >
                            <option value="">Choose team</option>
                            <option value={String(selectedMatch.teamA)}>
                              {selectedMatch.teamAName}
                            </option>
                            <option value={String(selectedMatch.teamB)}>
                              {selectedMatch.teamBName}
                            </option>
                          </select>
                        </label>
                        <label>
                          Player (optional)
                          <select
                            value={foulPlayerId}
                            onChange={(event) => setFoulPlayerId(event.target.value)}
                          >
                            <option value="">Team foul</option>
                            {players
                              .filter((player) =>
                                [...(player.teamIds || []), player.teamId]
                                  .filter(Boolean)
                                  .some((id) => String(id) === foulTeamId)
                              )
                              .map((player) => (
                                <option key={String(player._id)} value={String(player._id)}>
                                  {player.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Event
                          <select
                            value={foulType}
                            onChange={(event) => setFoulType(event.target.value)}
                          >
                            <option>Foul</option>
                            <option>Yellow card</option>
                            <option>Red card</option>
                            <option>Penalty</option>
                          </select>
                        </label>
                      </div>
                      <button className="primary-button" type="submit">
                        Upload event live
                      </button>
                    </form>
                  )}
                {!canEditScores && (
                  <p className="muted viewer-note">You are viewing this score live.</p>
                )}
                {matchIsFinal && (
                  <p className="muted viewer-note">
                    This match is {selectedState?.status || selectedMatch.status}.
                  </p>
                )}

                {/* Match Score Event Timeline */}
                <div className="match-timeline-section">
                  <div className="timeline-section-heading">
                    <p className="eyebrow">Match timeline & score history</p>
                    <span className="count-badge">{matchTimeline.length} events</span>
                  </div>
                  {matchTimeline.length === 0 ? (
                    <p className="muted empty-timeline">
                      No score changes recorded yet. Updates will appear in real time.
                    </p>
                  ) : (
                    <div className="match-timeline-feed">
                      {matchTimeline
                        .slice()
                        .reverse()
                        .map((event, idx) => (
                          <div className="timeline-feed-item" key={idx}>
                            <span
                              className={`timeline-indicator ${event.type === 'completed' ? 'final' : event.type === 'live' ? 'live' : ''}`}
                            />
                            <div className="timeline-item-body">
                              <strong>{event.message}</strong>
                              {event.timestamp && (
                                <span className="timeline-item-time">
                                  {new Date(event.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p className="eyebrow">Live match</p>
                <h2>Select a match</h2>
                <p className="muted">Choose a fixture to follow the score and match timeline.</p>
              </div>
            )}
          </section>
        </section>
      )}

      {activePage === 'management' && user.role === 'event_manager' && (
        <ManagementPanel
          token={token}
          role={user.role}
          onDataChanged={async () => Promise.all([refreshMatches(token), refreshHomeData(token)])}
        />
      )}

      {entryRequest && (
        <TournamentEntry
          {...entryRequest}
          players={players}
          token={token}
          onClose={() => setEntryRequest(null)}
          onSaved={async () => {
            await refreshHomeData(token);
            setEntryRequest(null);
            setMessage('Tournament lineup submitted.');
          }}
        />
      )}

      {isEditingProfile && playerProfile && (
        <EditProfileModal
          playerProfile={playerProfile}
          token={token}
          onClose={() => setIsEditingProfile(false)}
          onSaved={async (updatedProfile) => {
            setPlayerProfile(updatedProfile);
            await refreshHomeData(token);
            setMessage('Profile updated successfully.');
          }}
        />
      )}

      {selectedTournament && (
        <TournamentDetailsModal
          tournament={selectedTournament}
          teams={teams}
          players={players}
          matches={matches}
          user={user}
          onClose={() => setSelectedTournament(null)}
          onSelectTeam={setSelectedTeam}
          onJoinTournament={(tournamentId, teamId) => {
            const tournament = tournaments.find((t) => String(t._id) === tournamentId);
            const team = teams.find((t) => String(t._id) === teamId);
            if (!team) {
              setMessage('First select a team.');
              return;
            }
            setSelectedTournament(null);
            setEntryRequest({ tournament, team });
          }}
        />
      )}

      {selectedTeam && (
        <TeamDetailsModal
          team={selectedTeam}
          onRosterChanged={async () => {
            await refreshHomeData(token);
            const result = await api.request(`/teams/${selectedTeam._id}`, token);
            setSelectedTeam(result.data);
          }}
          token={token}
          currentPlayer={playerProfile}
          onLeft={async () => {
            setSelectedTeam(null);
            setPlayerProfile(await api.getMyPlayerProfile(token));
            await refreshHomeData(token);
            setMessage('You left the team.');
          }}
          players={players}
          tournaments={tournaments}
          matches={matches}
          onClose={() => setSelectedTeam(null)}
          onSelectTournament={setSelectedTournament}
          onSelectPlayer={(player) => {
            setProfilePreview({ player, nonce: Date.now() });
            setSelectedTeam(null);
            setActivePage('players');
          }}
        />
      )}
    </main>
  );
};

export default App;
