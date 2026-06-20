import { X } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore.js';

export default function SettingsModal({ open, onClose }) {
  const { settings, updateSettings, resetSettings } = useSettingsStore();
  if (!open) return null;

  return (
    <dialog open className="modal-backdrop" aria-label="Settings">
      <div className="modal settings-modal">
        <div className="modal-title">
          <h2>Settings</h2>
          <button type="button" className="square-icon-button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>
        <label>
          Board theme
          <select value={settings.boardTheme} onChange={(event) => updateSettings({ boardTheme: event.target.value })}>
            <option value="tournament">Tournament</option>
            <option value="walnut">Walnut</option>
            <option value="midnight">Midnight</option>
          </select>
        </label>
        <label className="switch-row">
          Sound
          <input type="checkbox" checked={settings.soundEnabled} onChange={(event) => updateSettings({ soundEnabled: event.target.checked })} />
        </label>
        <label className="switch-row">
          Legal moves
          <input type="checkbox" checked={settings.legalMoveHints} onChange={(event) => updateSettings({ legalMoveHints: event.target.checked })} />
        </label>
        <label className="switch-row">
          Auto queen
          <input type="checkbox" checked={settings.autoQueen} onChange={(event) => updateSettings({ autoQueen: event.target.checked })} />
        </label>
        <label>
          Clock minutes
          <input
            type="number"
            min="1"
            max="120"
            value={settings.clockMinutes}
            onChange={(event) => updateSettings({ clockMinutes: Number(event.target.value) })}
          />
        </label>
        <label>
          Increment seconds
          <input
            type="number"
            min="0"
            max="60"
            value={settings.incrementSeconds}
            onChange={(event) => updateSettings({ incrementSeconds: Number(event.target.value) })}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={resetSettings}>
            Reset
          </button>
          <button type="button" className="primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
