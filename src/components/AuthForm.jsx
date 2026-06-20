import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import { PASSWORD_MIN_LENGTH, validatePassword } from '../utils/passwordSecurity.js';

export default function AuthForm({ initialMode = 'login', onSuccess }) {
  const auth = useAuthStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState(() => (['login', 'register', 'admin'].includes(initialMode) ? initialMode : 'login'));
  const [form, setForm] = useState({ email: '', password: '', username: '', adminUsername: '' });

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

    const response = mode === 'admin'
      ? await auth.loginAdmin({ username: form.adminUsername, password: form.password })
      : mode === 'register'
        ? await auth.register({ ...form, full_name: form.username })
        : await auth.login(form);

    if (response.error) {
      toast.error(response.error.message);
      return;
    }

    toast.success(mode === 'admin' ? 'Admin logged in' : response.message ?? (mode === 'register' ? 'Account created' : 'Logged in'));
    onSuccess?.({ mode });
    if (mode === 'admin') navigate('/admin');
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

  const title = mode === 'register' ? 'Create account' : mode === 'admin' ? 'Admin Login' : 'Login';
  const description = mode === 'register'
    ? 'Register to keep your profile and game stats.'
    : mode === 'admin'
      ? 'Sign in with administrator credentials to manage registered users.'
      : 'Sign in to open your profile and saved stats.';

  return (
    <div className="auth-form-card">
      <div className="auth-form-heading">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="auth-mode-actions">
          {mode === 'admin' ? (
            <button type="button" className="secondary-button auth-mode-button" onClick={() => switchMode('login')}>
              User login
            </button>
          ) : (
            <button type="button" className="secondary-button auth-mode-button" onClick={() => switchMode(mode === 'register' ? 'login' : 'register')}>
              {mode === 'register' ? 'Use login' : 'Create account'}
            </button>
          )}
          {mode !== 'admin' ? (
            <button type="button" className="secondary-button auth-mode-button" onClick={() => switchMode('admin')}>
              <ShieldCheck size={16} />
              <span>Admin login</span>
            </button>
          ) : null}
        </div>
      </div>
      <form className="auth-form-fields" onSubmit={submit}>
        {mode === 'register' ? (
          <label>
            Username
            <input value={form.username} onChange={(event) => change('username', event.target.value)} autoComplete="username" required />
          </label>
        ) : null}
        {mode === 'admin' ? (
          <label>
            Username
            <input value={form.adminUsername} onChange={(event) => change('adminUsername', event.target.value)} autoComplete="username" required />
          </label>
        ) : (
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => change('email', event.target.value)} autoComplete="email" required />
          </label>
        )}
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
          {mode === 'admin' ? (
            <button type="button" className="secondary-button" onClick={() => switchMode('login')}>Cancel</button>
          ) : (
            <button type="button" className="secondary-button" onClick={forgot}>Forgot password</button>
          )}
          <button type="submit" className="primary-button">{mode === 'register' ? 'Create account' : mode === 'admin' ? 'Open dashboard' : 'Login'}</button>
        </div>
      </form>
    </div>
  );
}