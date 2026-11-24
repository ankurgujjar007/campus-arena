import Icon from './Icon';
import { useMemo, useState } from 'react';
import defaults from '../../../shared/sportLineups.json';
import { api } from '../services/api';

export default function TournamentEntry({ tournament, team, players, token, onClose, onSaved }) {
  const roster = players.filter((p) =>
    [...(p.teamIds || []), p.teamId].filter(Boolean).some((id) => String(id) === String(team._id))
  );
  const key =
    /3\s*(v|vs|x)\s*3/i.test(tournament.name) && tournament.sport.toLowerCase() === 'basketball'
      ? 'basketball 3v3'
      : tournament.sport.toLowerCase();
  const rules = tournament.lineupRules || defaults[key];
  const [roles, setRoles] = useState({ [String(team.captainId)]: 'starter' });
  const [captainId, setCaptainId] = useState(String(team.captainId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const visibleRoster = useMemo(() => {
    const query = playerSearch.trim().toLowerCase();
    if (!query) return roster;
    return roster.filter((player) =>
      [player.name, player.username, player._id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [roster, playerSearch]);
  const starters = roster
    .filter((p) => roles[String(p._id)] === 'starter')
    .map((p) => String(p._id));
  const substitutes = roster
    .filter((p) => roles[String(p._id)] === 'substitute')
    .map((p) => String(p._id));
  const submit = async (allow = false) => {
    setBusy(true);
    setError('');
    try {
      await api.registerForTournament(token, String(tournament._id), allow, String(team._id), {
        starters,
        substitutes,
        captainId
      });
      await onSaved();
    } catch (err) {
      if (err.code === 'SPORT_MISMATCH') setWarning(err.message);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <section
        className="modal-card panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-title"
      >
        <button className="modal-close-button" aria-label="Close" disabled={busy} onClick={onClose}>
          ×
        </button>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{team.name}</p>
            <h2 id="entry-title">Tournament lineup</h2>
          </div>
        </div>
        <p>{tournament.name}</p>
        {!rules ? (
          <p className="feedback">
            An event manager needs to configure lineup rules for this sport.
          </p>
        ) : (
          <>
            <p className="muted">
              Select {rules.starters} starters and up to {rules.substitutes} substitutes. Singles is
              the default for racket sports; event-specific rules may override these limits.
            </p>
            <p className="muted">
              Starters: {starters.length}/{rules.starters} · Substitutes: {substitutes.length}/
              {rules.substitutes}
            </p>
            <label className="lineup-search">
              Search players by name or ID
              <input
                type="search"
                value={playerSearch}
                onChange={(event) => setPlayerSearch(event.target.value)}
                placeholder="Name or player ID"
                disabled={busy}
              />
            </label>
            <div className="lineup-roster">
              {visibleRoster.map((p) => (
                <label className="lineup-player" key={String(p._id)}>
                  {p.name}
                  <select
                    value={roles[String(p._id)] || ''}
                    disabled={busy}
                    onChange={(event) =>
                      setRoles((current) => ({ ...current, [String(p._id)]: event.target.value }))
                    }
                  >
                    <option value="">Not selected</option>
                    <option value="starter">Starter</option>
                    {rules.substitutes > 0 && <option value="substitute">Substitute</option>}
                  </select>
                </label>
              ))}
              {visibleRoster.length === 0 && <p className="muted">No players match that search.</p>}
            </div>
            <label className="tournament-team-picker">
              Match captain
              <select
                value={captainId}
                disabled={busy}
                onChange={(event) => setCaptainId(event.target.value)}
              >
                <option value="">Choose captain</option>
                {roster
                  .filter((p) => starters.includes(String(p._id)))
                  .map((p) => (
                    <option key={String(p._id)} value={String(p._id)}>
                      {p.name}
                      {String(p._id) === String(team.captainId) ? ' (team leader)' : ''}
                    </option>
                  ))}
              </select>
            </label>
            {warning && (
              <p className="feedback" role="alert">
                <Icon name="alert" /> {warning}
              </p>
            )}
            {error && (
              <p className="feedback" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button className="secondary-button" disabled={busy} onClick={onClose}>
                Cancel
              </button>
              <button
                className="primary-button"
                disabled={
                  busy ||
                  starters.length !== rules.starters ||
                  substitutes.length > rules.substitutes ||
                  !starters.includes(captainId)
                }
                onClick={() => submit(Boolean(warning))}
              >
                {busy ? 'Submitting…' : warning ? 'Continue anyway' : 'Submit lineup'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
