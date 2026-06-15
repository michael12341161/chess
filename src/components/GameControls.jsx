import { Flag, Handshake, RefreshCw, RotateCcw, Save, Settings, Undo2 } from 'lucide-react';

export default function GameControls({ onReset, onUndo, onSave, onResign, onDraw, onFlip, onSettings }) {
  return (
    <section className="panel control-panel">
      <button type="button" className="icon-button primary-button" onClick={onSave} title="Save">
        <Save size={18} />
        <span>Save</span>
      </button>
      <button type="button" className="icon-button" onClick={onUndo} title="Undo">
        <Undo2 size={18} />
        <span>Undo</span>
      </button>
      <button type="button" className="icon-button" onClick={onReset} title="Reset">
        <RefreshCw size={18} />
        <span>Reset</span>
      </button>
      <button type="button" className="icon-button" onClick={onFlip} title="Flip board">
        <RotateCcw size={18} />
        <span>Flip</span>
      </button>
      <button type="button" className="icon-button" onClick={onDraw} title="Draw">
        <Handshake size={18} />
        <span>Draw</span>
      </button>
      <button type="button" className="icon-button danger-button" onClick={onResign} title="Resign">
        <Flag size={18} />
        <span>Resign</span>
      </button>
      <button type="button" className="icon-button" onClick={onSettings} title="Settings">
        <Settings size={18} />
        <span>Settings</span>
      </button>
    </section>
  );
}
