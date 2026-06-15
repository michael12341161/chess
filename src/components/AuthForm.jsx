import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore.js';
import { PASSWORD_MIN_LENGTH, validatePassword } from '../utils/passwordSecurity.js';

export default function AuthForm({ initialMode = 'login', onSuccess }) {
  const auth = useAuthStore();
  const [mode, setMode] = useState(initialMode === 'register' ? 'register' : 'login');
  const [form, setForm] = useState({ email: '', password: '', username: '' });

  useEffect(() => {
    setMode(initialMode === 'register' ? 'register' : 'login');
  }, [initialMode]);

  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const switchMode = (nextMode) => {
    setMode(nextMode);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (mode === 'register') {
      const passwordCheck = validatePassword(form.password);
      if (!passwordCheck.valid) {
        toast.error(passwordCheck.message);
        return;
      }
    }

    const response = mode === 'register' ? await auth.register(form) : await auth.login(form);
    if (response.error) {
      toast.error(response.error.message);
      return;
    }

    toast.success(mode === 'register' ? 'Account created' : 'Logged in');
    onSuccess?.();
  };

  const forgot = async () => {
    if (!form.email) {
      toast.error('Enter your email first.');
      return;
    }

    const response = await auth.forgotPassword(form.email);
    if (response.error) toast.error(response.error.message);
    else toast.success('Password email sent');
  };

  return (
    <div className="auth-form-card">
      <div className="auth-form-heading">
        <div>
          <h1>{mode === 'register' ? 'Create account' : 'Login'}</h1>
          <p>{mode === 'register' ? 'Register to keep your profile and game stats.' : 'Sign in to open your profile and saved stats.'}</p>
        </div>
        <button type="button" className="secondary-button auth-mode-button" onClick={() => switchMode(mode === 'register' ? 'login' : 'register')}>
          {mode === 'register' ? 'Use login' : 'Create account'}
        </button>
      </div>
      <form className="auth-form-fields" onSubmit={submit}>
        {mode === 'register' ? (
          <label>
            Username
            <input value={form.username} onChange={(event) => change('username', event.target.value)} autoComplete="username" required />
          </label>
        ) : null}
        <label>
          Email
          <input type="email" value={form.email} onChange={(event) => change('email', event.target.value)} autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(event) => change('password', event.target.value)}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            minLength={mode === 'register' ? PASSWORD_MIN_LENGTH : undefined}
            required
          />
        </label>
        {mode === 'register' ? (
          <p className="password-hint">Use at least 12 characters with uppercase, lowercase, number, and symbol.</p>
        ) : null}
        <div className="auth-form-actions">
          <button type="button" className="secondary-button" onClick={forgot}>Forgot password</button>
          <button type="submit" className="primary-button">{mode === 'register' ? 'Create account' : 'Login'}</button>
        </div>
      </form>
    </div>
  );
}
