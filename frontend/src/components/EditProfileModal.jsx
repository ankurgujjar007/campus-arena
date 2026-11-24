import { useState, useEffect } from 'react';
import { api } from '../services/api';

const SPORT_CHOICES = [
  'Athletics',
  'Badminton',
  'Basketball',
  'Cricket',
  'Football',
  'Kabaddi',
  'Table tennis',
  'Tennis',
  'Volleyball',
  'Other'
];

const EditProfileModal = ({ playerProfile, token, onClose, onSaved }) => {
  const knownSports = SPORT_CHOICES.filter((sport) => sport !== 'Other');
  const existingSports = playerProfile?.interestedSports || [];
  const initialKnown = existingSports.filter((sport) =>
    knownSports.some((known) => known.toLowerCase() === sport.toLowerCase())
  );
  const initialCustom = existingSports.find(
    (sport) => !knownSports.some((known) => known.toLowerCase() === sport.toLowerCase())
  );

  const [name, setName] = useState(playerProfile?.name || '');
  const [bio, setBio] = useState(playerProfile?.bio || '');
  const [selectedSports, setSelectedSports] = useState([
    ...initialKnown,
    ...(initialCustom ? ['Other'] : [])
  ]);
  const [otherSport, setOtherSport] = useState(initialCustom || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, saving]);

  const toggleSport = (sport) => {
    setSelectedSports((current) =>
      current.includes(sport) ? current.filter((item) => item !== sport) : [...current, sport]
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Full name cannot be empty.');
      return;
    }

    const interestedSports = selectedSports.filter((sport) => sport !== 'Other');
    if (selectedSports.includes('Other')) {
      if (!otherSport.trim()) {
        setError('Please enter the name of your other sport.');
        return;
      }
      interestedSports.push(otherSport.trim());
    }

    if (!interestedSports.length) {
      setError('Please choose at least one interested sport.');
      return;
    }

    setSaving(true);
    try {
      await api.saveMyPlayerProfile(token, {
        username: playerProfile.username,
        name: name.trim(),
        bio: bio.trim(),
        interestedSports
      });
      const persisted = await api.getMyPlayerProfile(token);
      if (!persisted || persisted.bio !== bio.trim()) {
        throw new Error('Your bio could not be confirmed as saved. Please try again.');
      }
      if (onSaved) await onSaved(persisted);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!saving) onClose();
      }}
      role="presentation"
    >
      <div
        className="modal-card panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close-button"
          onClick={onClose}
          disabled={saving}
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
            <p className="eyebrow">Your profile</p>
            <h2 id="edit-profile-title">Edit player profile</h2>
          </div>
        </div>

        {error && (
          <p className="feedback" role="alert">
            {error}
          </p>
        )}

        <form className="auth-form modal-form" onSubmit={handleSubmit}>
          <label>
            Full name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
            />
          </label>

          <label>
            Bio / About
            <textarea
              className="modal-textarea"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. 2nd Year Computer Science · Forward"
              maxLength={250}
              rows={3}
            />
            <span className="field-hint">{bio.length}/250 characters</span>
          </label>

          <fieldset className="sports-fieldset">
            <legend>Interested sports (select at least one)</legend>
            <div className="sport-options">
              {SPORT_CHOICES.map((sport) => (
                <label
                  key={sport}
                  className={`sport-option ${selectedSports.includes(sport) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSports.includes(sport)}
                    onChange={() => toggleSport(sport)}
                  />
                  <span>{sport}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {selectedSports.includes('Other') && (
            <label>
              Other sport
              <input
                type="text"
                value={otherSport}
                onChange={(e) => setOtherSport(e.target.value)}
                placeholder="Enter sport name"
                required
              />
            </label>
          )}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;
