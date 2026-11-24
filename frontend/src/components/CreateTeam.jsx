import TeamJoinAction from './TeamJoinAction';
import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

const CreateTeam = ({ player, token, onCreated, teams = [], players = [], onSelectTeam }) => {
  const sports = [
    ...new Set([
      'All sports',
      'Athletics',
      'Badminton',
      'Basketball',
      'Cricket',
      'Football',
      'Kabaddi',
      'Table tennis',
      'Tennis',
      'Volleyball',
      'Hockey',
      'Handball',
      'Swimming',
      'Chess',
      'Other',
      ...(player?.interestedSports || [])
    ])
  ];
  const teamRowRef = useRef(null);
  const slideTeams = (direction) => {
    const row = teamRowRef.current;
    if (row)
      row.scrollBy({
        left: direction * row.clientWidth * 0.85,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
  };
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState('');
  const [selectedSport, setSelectedSport] = useState('');
  const [createError, setCreateError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [query, setQuery] = useState('');
  const [sportFilter, setSportFilter] = useState('');
  const [requestStatuses, setRequestStatuses] = useState({});
  const [pendingRequests, setPendingRequests] = useState({});
  useEffect(() => {
    if (!token || !player) return;
    Promise.all([
      api.request('/teams/my-join-requests', token),
      api.request('/teams/leader-pending-counts', token)
    ])
      .then(([requests, counts]) => {
        setRequestStatuses(
          Object.fromEntries(
            (requests.data || []).map((request) => [String(request.teamId), request.status])
          )
        );
        setPendingRequests(
          Object.fromEntries(
            (counts.data || []).map((team) => [String(team.teamId), team.pendingCount])
          )
        );
      })
      .catch((error) => {
        setJoinError(`Unable to load join request status: ${error.message}`);
      });
  }, [token, player]);
  if (!player) return null;
  const filterSports = [
    ...new Set([
      ...sports.filter((sport) => sport !== 'Other' && sport !== 'All sports'),
      ...teams.map((team) => team.sport).filter(Boolean)
    ])
  ].sort();
  const searching = Boolean(query.trim() || sportFilter);
  const results = searching
    ? teams.filter(
        (team) =>
          team.name.toLowerCase().includes(query.trim().toLowerCase()) &&
          (!sportFilter || team.sport.toLowerCase() === sportFilter.toLowerCase())
      )
    : [];
  const memberships = [...(player.teamIds || []), player.teamId].filter(Boolean).map(String);

  const myTeams = teams.filter(
    (team) =>
      memberships.includes(String(team._id)) || String(team.captainId) === String(player._id)
  );
  const renderTeam = (team) => {
    const captain = String(team.captainId) === String(player._id);
    const openTeam = () => {
      setPendingRequests((current) => ({ ...current, [String(team._id)]: 0 }));
      onSelectTeam(team);
    };
    return (
      <article
        className="your-team-card"
        key={String(team._id)}
        role="button"
        tabIndex={0}
        onClick={openTeam}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openTeam();
          }
        }}
      >
        {pendingRequests[String(team._id)] > 0 && (
          <span
            className="team-request-dot"
            title={`${pendingRequests[String(team._id)]} pending join request(s)`}
            aria-label={`${pendingRequests[String(team._id)]} pending join request(s)`}
          />
        )}
        <div className="panel-heading">
          <span className="eyebrow">{team.sport}</span>
          <span className={captain ? 'captain-label' : 'joined-label'}>
            {captain
              ? 'Captain · Created by you'
              : memberships.includes(String(team._id))
                ? 'Member'
                : 'Team'}
          </span>
        </div>
        <h3>{team.name}</h3>
        <p className="muted">
          Leader:{' '}
          {players.find((p) => String(p._id) === String(team.captainId))?.name || 'Not assigned'}
        </p>
        <p className="muted">
          {team.players?.length || 0} {(team.players?.length || 0) === 1 ? 'member' : 'members'}
        </p>
        {requestStatuses[String(team._id)] && (
          <span className={`team-request-status ${requestStatuses[String(team._id)]}`}>
            Request {requestStatuses[String(team._id)]}
          </span>
        )}
      </article>
    );
  };
  if (showAll)
    return (
      <section className="panel your-teams-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Campus teams</p>
            <h2>All teams ({teams.length})</h2>
          </div>
          <button className="secondary-button" onClick={() => setShowAll(false)}>
            Back to your teams
          </button>
        </div>
        <div className="all-teams-grid">{teams.map(renderTeam)}</div>
        {!teams.length && <p className="muted">No teams yet.</p>}
      </section>
    );
  return (
    <div className="team-management-grid">
      <section className="panel your-teams-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Your squad</p>
            <h2>Your teams</h2>
          </div>
          <div className="team-row-actions">
            {myTeams.length > 1 && (
              <>
                <button
                  className="secondary-button team-slide-arrow"
                  aria-label="Previous teams"
                  onClick={() => slideTeams(-1)}
                >
                  ‹
                </button>
                <button
                  className="secondary-button team-slide-arrow"
                  aria-label="Next teams"
                  onClick={() => slideTeams(1)}
                >
                  ›
                </button>
              </>
            )}
            <span className="count-badge">{myTeams.length}</span>
            <button className="secondary-button" onClick={() => setShowAll(true)}>
              Show all teams
            </button>
          </div>
        </div>
        {!myTeams.length ? (
          <p className="muted">You haven’t joined a team yet. Create one or find a team below.</p>
        ) : (
          <div className="your-teams-grid" ref={teamRowRef}>
            {myTeams.map(renderTeam)}
          </div>
        )}
      </section>
      <details className="panel team-action-section">
        <summary>
          <span>Create a team</span>
          <span className="recent-chevron" aria-hidden="true">
            ⌄
          </span>
        </summary>
        <div className="create-team-panel">
          <p className="muted">Choose a name and sport. You’ll become the captain.</p>
          <form
            className="auth-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              setBusy('create');
              setCreateError('');
              try {
                await api.request('/teams/mine', token, {
                  method: 'POST',
                  body: JSON.stringify({
                    name: data.get('name'),
                    sport: selectedSport === 'Other' ? data.get('customSport') : selectedSport
                  })
                });
                await onCreated();
                form.reset();
                setSelectedSport('');
              } catch (error) {
                setCreateError(error.message);
              } finally {
                setBusy('');
              }
            }}
          >
            <label>
              Team name
              <input
                name="name"
                minLength={2}
                maxLength={80}
                required
                placeholder="e.g. Campus Hawks"
                disabled={Boolean(busy)}
              />
            </label>
            <label>
              Sport
              <select
                name="sport"
                value={selectedSport}
                onChange={(event) => setSelectedSport(event.target.value)}
                required
                disabled={Boolean(busy)}
              >
                <option value="">Choose a sport</option>
                {sports.map((sport) => (
                  <option key={sport}>{sport}</option>
                ))}
              </select>
            </label>
            {selectedSport === 'Other' && (
              <label>
                Sport name
                <input
                  name="customSport"
                  required
                  maxLength={60}
                  disabled={Boolean(busy)}
                  placeholder="Enter your sport"
                />
              </label>
            )}
            <button className="primary-button" disabled={Boolean(busy)}>
              {busy === 'create' ? 'Creating…' : 'Create team'}
            </button>
            {createError && (
              <p className="feedback" role="alert">
                {createError}
              </p>
            )}
          </form>
        </div>
      </details>
      <details className="panel team-action-section">
        <summary>
          <span>Join a team</span>
          <span className="recent-chevron" aria-hidden="true">
            ⌄
          </span>
        </summary>
        <div className="create-team-panel join-team-panel">
          <p className="muted">Search by team name or explore a sport.</p>
          <div className="auth-form team-search-controls">
            <label>
              Team name
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search teams…"
              />
            </label>
            <label>
              Filter by sport
              <select value={sportFilter} onChange={(event) => setSportFilter(event.target.value)}>
                <option value="">All sports</option>
                {filterSports.map((sport) => (
                  <option key={sport}>{sport}</option>
                ))}
              </select>
            </label>
          </div>
          {joinError && (
            <p className="feedback" role="alert">
              {joinError}
            </p>
          )}
          <div className="team-membership-list" aria-live="polite">
            {!searching ? (
              <p className="muted">Enter a team name or select a sport to see teams.</p>
            ) : !results.length ? (
              <p className="muted">No matching teams. Try another name or sport.</p>
            ) : (
              <>
                <span className="muted">
                  {results.length} {results.length === 1 ? 'team' : 'teams'} found
                </span>
                {results.map((team) => (
                  <article className="team-search-result" key={String(team._id)}>
                    <div>
                      <strong>{team.name}</strong>
                      <p className="muted">{team.sport}</p>
                      <p className="muted">
                        Leader:{' '}
                        {players.find((p) => String(p._id) === String(team.captainId))?.name ||
                          'Not assigned'}
                      </p>
                    </div>
                    <TeamJoinAction
                      isMember={memberships.includes(String(team._id))}
                      isCaptain={String(team.captainId) === String(player._id)}
                      status={requestStatuses[String(team._id)]}
                      busy={Boolean(busy)}
                      onView={() => onSelectTeam(team)}
                      onRequest={async () => {
                        setBusy(String(team._id));
                        setJoinError('');
                        try {
                          await api.request(`/teams/${team._id}/join-request`, token, {
                            method: 'POST'
                          });
                          setRequestStatuses((current) => ({
                            ...current,
                            [String(team._id)]: 'pending'
                          }));
                        } catch (error) {
                          setJoinError(error.message);
                        } finally {
                          setBusy('');
                        }
                      }}
                    />
                  </article>
                ))}
              </>
            )}
          </div>
        </div>
      </details>
    </div>
  );
};
export default CreateTeam;
