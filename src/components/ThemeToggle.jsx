export default function ThemeToggle({ mode, onToggle, className = '' }) {
  const isDark = mode === 'dark'

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`theme-toggle ${className}`.trim()}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className={`theme-ball ${isDark ? 'luxury-ball' : 'love-ball'}`}>
        <span className="theme-ball__top" />
        <span className="theme-ball__band" />
        <span className="theme-ball__button" />
        <span className="theme-ball__mark">{isDark ? 'L' : '♥'}</span>
      </span>
    </button>
  )
}
