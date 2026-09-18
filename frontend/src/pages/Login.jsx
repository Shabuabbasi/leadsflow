import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, setToken } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@leadflow.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      setToken(data.token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <div className="auth-header">
          <div className="auth-logo">
            <div className="sidebar-logo-icon">LF</div>
            <span className="sidebar-logo-text">LeadFlow</span>
          </div>
          <h2>Sign In to Dashboard</h2>
          <p className="muted">Enter your credentials to manage leads captured from WordPress.</p>
        </div>

        {error ? <p className="alert error">{error}</p> : null}

        <label>
          Email Address
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <button type="submit" disabled={loading} style={{ width: '100%', marginTop: '8px', padding: '12px' }}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
