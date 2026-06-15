import { useEffect } from 'react';
import { X } from 'lucide-react';
import AuthForm from './AuthForm.jsx';

export default function AuthModal({ open, initialMode = 'login', onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const closeFromBackdrop = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="modal-backdrop auth-floating-backdrop" role="presentation" onMouseDown={closeFromBackdrop}>
      <section className="modal auth-floating-card" role="dialog" aria-modal="true" aria-label={initialMode === 'register' ? 'Register' : 'Login'}>
        <button type="button" className="square-icon-button auth-modal-close" onClick={onClose} title="Close">
          <X size={18} />
        </button>
        <AuthForm initialMode={initialMode} onSuccess={onClose} />
      </section>
    </div>
  );
}
