import { useLayoutEffect, useRef, useState } from 'react';
import { api } from '../services/api';

const SPORT_CHOICES = [
  'Athletics',
  'Badminton',
  'Basketball',
  'Cricket',
  'Chess',
  'Football',
  'Handball',
  'Hockey',
  'Kabaddi',
  'Table tennis',
  'Swimming',
  'Tennis',
  'Volleyball',
  'Other'
];

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_]{2,19}$/;

const PlayerOnboarding = ({ user, token, existingProfile, onComplete }) => {
  const legacySport = existingProfile?.sport || '';
  const knownSports = SPORT_CHOICES.filter((sport) => sport !== 'Other');
  const legacyIsKnown = knownSports.some(
    (sport) => sport.toLowerCase() === legacySport.toLowerCase()
  );
  const initialSports = existingProfile?.interestedSports?.length
    ? existingProfile.interestedSports
    : legacySport
      ? [
          legacyIsKnown
            ? knownSports.find((sport) => sport.toLowerCase() === legacySport.toLowerCase())
            : 'Other'
        ]
      : [];

  const [step, setStep] = useState(1);
  const [username, setUsername] = useState(existingProfile?.username || '');
  const [usernameMessage, setUsernameMessage] = useState('');
  const [name, setName] = useState(existingProfile?.name || user.name || '');
  const [selectedSports, setSelectedSports] = useState(initialSports);
  const [otherSport, setOtherSport] = useState(!legacyIsKnown ? legacySport : '');
  const [message, setMessage] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [saving, setSaving] = useState(false);
  const stepContentRef = useRef(null);
  const [stepContentHeight, setStepContentHeight] = useState(null);

  useLayoutEffect(() => {
    if (stepContentRef.current) {
      setStepContentHeight(stepContentRef.current.scrollHeight);
    }
  }, [step, selectedSports, otherSport, usernameMessage, message]);

  const toggleSport = (sport) => {
    setSelectedSports((current) =>
      current.includes(sport) ? current.filter((item) => item !== sport) : [...current, sport]
    );
  };

  const continueFromUsername = async () => {
    setMessage('');
    setUsernameMessage('');
    const normalizedUsername = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setUsernameMessage(
        'Use 3–20 letters, numbers, or underscores. Start with a letter or number.'
      );
      return;
    }

    setCheckingUsername(true);
    try {
      const result = await api.checkUsernameAvailability(token, normalizedUsername);
      if (!result.available) {
        setUsernameMessage(result.reason || 'That username is already taken.');
        return;
      }
      setUsername(normalizedUsername);
      setUsernameMessage('Username is available.');
      setStep(2);
    } catch (error) {
      setUsernameMessage(error.message);
    } finally {
      setCheckingUsername(false);
    }
  };

  const continueFromDetails = () => {
    setMessage('');
    if (!name.trim()) {
      setMessage('Enter your full name to continue.');
      return;
    }
    setStep(3);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    const interestedSports = selectedSports.filter((sport) => sport !== 'Other');
    if (selectedSports.includes('Other')) {
      if (!otherSport.trim()) {
        setMessage('Enter the other sport you are interested in.');
        return;
      }
      interestedSports.push(otherSport.trim());
    }

    if (!interestedSports.length) {
      setMessage('Choose at least one sport to continue.');
      return;
    }

    setSaving(true);
    try {
      const profile = await api.saveMyPlayerProfile(token, {
        username: username.trim().toLowerCase(),
        name: name.trim(),
        interestedSports
      });
      await onComplete(profile);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="auth-shell onboarding-shell">
      <section className="auth-card onboarding-card">
        <p className="eyebrow">Player profile · step {step} of 3</p>
        <div className="onboarding-progress" aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((item) => (
            <span
              className={`${item <= step ? 'complete' : ''} ${item === step ? 'active' : ''}`}
              key={item}
            />
          ))}
        </div>
        <h1>{step === 1 ? 'Choose your username' : step === 2 ? 'Your details' : 'Your sports'}</h1>
        <p className="muted">
          This profile will link to your signed-in email: <strong>{user.email}</strong>
        </p>

        <form
          className="auth-form"
          onSubmit={step === 3 ? handleSubmit : (event) => event.preventDefault()}
        >
          <div
            className="onboarding-step-frame"
            style={stepContentHeight === null ? undefined : { height: `${stepContentHeight}px` }}
          >
            <div key={step} ref={stepContentRef} className="onboarding-step-content">
              {step === 1 && (
                <>
                  <label>
                    Username
                    <input
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value.toLowerCase().replace(/\s/g, ''));
                        setUsernameMessage('');
                      }}
                      autoComplete="username"
                      minLength={3}
                      maxLength={20}
                      pattern="[A-Za-z0-9][A-Za-z0-9_]{2,19}"
                      required
                    />
                  </label>
                  <p className="field-hint">
                    3–20 characters: letters, numbers, and underscores. The username must be unique.
                  </p>
                  {usernameMessage && (
                    <p className="username-message" role="status">
                      {usernameMessage}
                    </p>
                  )}
                  <button
                    className="primary-button"
                    type="button"
                    onClick={continueFromUsername}
                    disabled={checkingUsername}
                  >
                    {checkingUsername ? 'Checking…' : 'Continue'}
                  </button>
                </>
              )}

              {step === 2 && (
                <>
                  <label>
                    Full name
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      required
                    />
                  </label>
                  <div className="wizard-actions">
                    <button className="secondary-button" type="button" onClick={() => setStep(1)}>
                      Back
                    </button>
                    <button className="primary-button" type="button" onClick={continueFromDetails}>
                      Continue
                    </button>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <fieldset className="sports-fieldset">
                    <legend>Which sports are you interested in? Choose at least one.</legend>
                    <div className="sport-options">
                      {SPORT_CHOICES.map((sport) => (
                        <label
                          className={`sport-option ${selectedSports.includes(sport) ? 'selected' : ''}`}
                          key={sport}
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
                        value={otherSport}
                        onChange={(event) => setOtherSport(event.target.value)}
                        required
                      />
                    </label>
                  )}

                  <div className="wizard-actions">
                    <button className="secondary-button" type="button" onClick={() => setStep(2)}>
                      Back
                    </button>
                    <button className="primary-button" type="submit" disabled={saving}>
                      {saving ? 'Saving profile…' : 'Complete profile'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </form>

        {message && (
          <p className="feedback" role="alert">
            {message}
          </p>
        )}
      </section>
    </main>
  );
};

export default PlayerOnboarding;
