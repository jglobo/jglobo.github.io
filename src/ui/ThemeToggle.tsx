// Light/dark switch for Studio Paper: the title screen and Quick Portfolio pages, and the
// game's HUD, menus and panels (paper-ui, which sets the colours without a page background).
import { useSettings } from '../stores/settingsStore';

export function usePaperClass() {
  return useSettings((s) => (s.pageTheme === 'dark' ? 'paper paper-dark' : 'paper'));
}

export function usePaperUiClass() {
  return useSettings((s) => (s.pageTheme === 'dark' ? 'paper-ui paper-dark' : 'paper-ui'));
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const dark = useSettings((s) => s.pageTheme === 'dark');
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      aria-pressed={dark}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      onClick={() => useSettings.getState().set({ pageTheme: dark ? 'light' : 'dark' })}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-knob">
          {dark ? (
            <svg viewBox="0 0 24 24" width="14" height="14"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="4.2" fill="currentColor" /><g stroke="currentColor" strokeWidth="2" strokeLinecap="round">{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <line key={a} x1="12" y1="2.5" x2="12" y2="4.8" transform={`rotate(${a} 12 12)`} />)}</g></svg>
          )}
        </span>
      </span>
      <span className="theme-toggle-label">{dark ? 'Dark' : 'Light'}</span>
    </button>
  );
}
