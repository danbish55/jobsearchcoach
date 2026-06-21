'use client';

import { useState, FormEvent } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      window.location.href = '/';
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Invalid password');
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0d0d0d',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: '12px',
        padding: '48px 40px',
        width: '100%',
        maxWidth: '380px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '32px', fontWeight: '800', color: '#c9a84c', letterSpacing: '4px', marginBottom: '8px' }}>
          007
        </div>
        <div style={{ fontSize: '18px', fontWeight: '700', color: '#e8e8e8', marginBottom: '6px' }}>
          JobSearchCoach
        </div>
        <div style={{ fontSize: '13px', color: '#666', marginBottom: '32px' }}>
          Enter your access code to continue
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              style={{
                width: '100%',
                padding: '12px 40px 12px 16px',
                background: '#111',
                border: `1px solid ${error ? '#c0392b' : '#333'}`,
                borderRadius: '8px',
                color: '#e8e8e8',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#666',
                cursor: 'pointer',
                fontSize: '12px',
                padding: 0,
              }}
            >
              {showPassword ? 'HIDE' : 'SHOW'}
            </button>
          </div>

          {error && (
            <div style={{ color: '#e74c3c', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%',
              padding: '12px',
              background: loading || !password ? '#2a2a2a' : '#c9a84c',
              color: loading || !password ? '#555' : '#0d0d0d',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              letterSpacing: '1px',
            }}
          >
            {loading ? 'Entering...' : 'ENTER'}
          </button>
        </form>
      </div>
    </div>
  );
}
