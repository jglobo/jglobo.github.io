import { useEffect, useState } from 'react';
import { DEFAULT_BINDINGS, useSettings, type Action, type Quality } from '../stores/settingsStore';
import { useGame } from '../stores/gameStore';

const QUALITIES: { id: Quality; label: string; note: string }[] = [
  { id: 'low', label: 'Low', note: 'Integrated graphics, older laptops' },
  { id: 'medium', label: 'Medium', note: 'Most laptops' },
  { id: 'high', label: 'High', note: 'Shadows, more particles' },
  { id: 'ultra', label: 'Ultra', note: 'Dedicated GPU' },
];

const REMAPPABLE: { action: Action; label: string }[] = [
  { action: 'forward', label: 'Move forward / up' },
  { action: 'back', label: 'Move back / down' },
  { action: 'left', label: 'Move left' },
  { action: 'right', label: 'Move right' },
  { action: 'sprint', label: 'Sprint / boost' },
  { action: 'interact', label: 'Interact / visit project' },
  { action: 'inspect', label: 'Project details' },
  { action: 'returnPortal', label: 'Return portal (hold)' },
];

const keyName = (code: string) => code.replace(/^Key/, '').replace(/^Digit/, '').replace('Left', ' L').replace('Right', ' R').replace('Arrow', '');

export function SettingsPanel() {
  const s = useSettings();
  const [binding, setBinding] = useState<Action | null>(null);

  useEffect(() => {
    if (!binding) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape') useSettings.getState().rebind(binding, e.code);
      setBinding(null);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [binding]);

  const slider = (label: string, key: 'master' | 'music' | 'sfx' | 'ambience') => (
    <label className="setting-row">
      <span>{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={s.audio[key]} onChange={(e) => s.setAudio({ [key]: Number(e.target.value) })} />
      <span className="value">{Math.round(s.audio[key] * 100)}</span>
    </label>
  );
  const toggle = (label: string, key: 'invertY' | 'reducedMotion' | 'reducedParticles' | 'highContrast' | 'subtitles') => (
    <label className="setting-row toggle">
      <span>{label}</span>
      <input type="checkbox" checked={s[key]} onChange={(e) => s.set({ [key]: e.target.checked })} />
    </label>
  );

  return (
    <div className="settings">
      <fieldset>
        <legend>Graphics</legend>
        <div className="quality-grid" role="radiogroup" aria-label="Graphics quality">
          {QUALITIES.map((q) => (
            <button key={q.id} role="radio" aria-checked={s.quality === q.id} className={`quality ${s.quality === q.id ? 'active' : ''}`} onClick={() => s.set({ quality: q.id, qualityChosen: true })}>
              <strong>{q.label}</strong>
              <span>{q.note}</span>
            </button>
          ))}
        </div>
        {toggle('Reduced particles', 'reducedParticles')}
      </fieldset>
      <fieldset>
        <legend>Audio</legend>
        {slider('Master', 'master')}
        {slider('Music', 'music')}
        {slider('Sound effects', 'sfx')}
        {slider('Ambience', 'ambience')}
        <label className="setting-row toggle">
          <span>Mute all</span>
          <input type="checkbox" checked={s.audio.muted} onChange={(e) => s.setAudio({ muted: e.target.checked })} />
        </label>
      </fieldset>
      <fieldset>
        <legend>Controls</legend>
        <label className="setting-row">
          <span>Mouse sensitivity</span>
          <input type="range" min={0.2} max={3} step={0.1} value={s.mouseSensitivity} onChange={(e) => s.set({ mouseSensitivity: Number(e.target.value) })} />
          <span className="value">{s.mouseSensitivity.toFixed(1)}</span>
        </label>
        {toggle('Invert look Y', 'invertY')}
        <div className="bindings">
          {REMAPPABLE.map((r) => (
            <div className="setting-row" key={r.action}>
              <span>{r.label}</span>
              <button className="btn small" onClick={() => setBinding(r.action)} aria-label={`Rebind ${r.label}`}>
                {binding === r.action ? 'Press a key…' : (s.bindings[r.action] ?? DEFAULT_BINDINGS[r.action]).map(keyName).join(' / ')}
              </button>
            </div>
          ))}
          <button className="btn small" onClick={() => s.set({ bindings: DEFAULT_BINDINGS })}>Reset keys</button>
        </div>
      </fieldset>
      <fieldset>
        <legend>Accessibility</legend>
        {toggle('Reduced motion', 'reducedMotion')}
        {toggle('High contrast interface', 'highContrast')}
        {toggle('Subtitles for dialogue', 'subtitles')}
      </fieldset>
      <fieldset>
        <legend>Progress</legend>
        <p className="muted small">Progress is saved in this browser only. No account, no tracking.</p>
        <button className="btn small" onClick={() => useGame.getState().resetProgress()}>Reset progress</button>
      </fieldset>
    </div>
  );
}
