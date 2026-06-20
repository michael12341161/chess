import { X } from 'lucide-react';
import AuthForm from './AuthForm.jsx';

export default function AuthModal({ open, initialMode = 'login', onClose }) {
  const closeFromBackdrop = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <dialog open className="modal-backdrop auth-floating-backdrop" aria-label={initialMode === 'register' ? 'Register' : initialMode === 'admin' ? 'Admin Login' : 'Login'} onMouseDown={closeFromBackdrop} onKeyDown={handleKeyDown}>
      <section className="modal auth-floating-card">
        <button type="button" className="square-icon-button auth-modal-close" onClick={onClose} title="Close" autoFocus>
          <X size={18} />
        </button>
        <AuthForm initialMode={initialMode} onSuccess={onClose} />
      </section>
    </dialog>
  );
}
