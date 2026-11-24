const ThemeToggle = ({ theme, onToggle }) => (
  <button
    type="button"
    className="theme-toggle"
    role="switch"
    aria-checked={theme === 'dark'}
    aria-label="Dark mode"
    onClick={onToggle}
  >
    <span className="theme-toggle-track" aria-hidden="true">
      <span />
    </span>
    <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
  </button>
);
export default ThemeToggle;
