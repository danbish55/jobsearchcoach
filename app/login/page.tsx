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
      background: '#1a0000',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        background: '#990000',
        border: '2px solid #FFCC00',
        borderRadius: '12px',
        padding: '48px 40px',
        width: '100%',
        maxWidth: '380px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#FFCC00', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '6px' }}>
          USC
        </div>
        <div style={{ fontSize: '22px', fontWeight: '800', color: '#ffffff', marginBottom: '6px' }}>
          JobSearchCoach
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '32px' }}>
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
                background: 'rgba(0,0,0,0.3)',
                border: `1px solid ${error ? '#ff6b6b' : 'rgba(255,204,0,0.4)'}`,
                borderRadius: '8px',
                color: '#ffffff',
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
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                fontSize: '12px',
                padding: 0,
              }}
            >
              {showPassword ? 'HIDE' : 'SHOW'}
            </button>
          </div>

          {error && (
            <div style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%',
              padding: '12px',
              background: loading || !password ? '#6b0000' : '#FFCC00',
              color: loading || !password ? 'rgba(255,255,255,0.35)' : '#990000',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '800',
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              letterSpacing: '1px',
            }}
          >
            {loading ? 'Entering...' : 'FIGHT ON'}
          </button>
        </form>
      </div>
    </div>
  );
}
