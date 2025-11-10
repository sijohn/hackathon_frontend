'use client';

import { FormEvent, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err) {
      setError('Unable to sign in. Check your email/password or try again later.');
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'var(--card)',
          borderRadius: '24px',
          padding: '2.5rem',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 35px rgba(0, 0, 0, 0.45)',
        }}
      >
        <p style={{ color: 'var(--accent)', margin: 0 }}>CampusConnect Agent</p>
        <h1 style={{ margin: '0.25rem 0 1.5rem' }}>Sign in</h1>
        <p style={{ margin: '0 0 2rem', color: 'var(--text-muted)' }}>
          Use the credentials shared for the hackathon. Accounts are provisioned via Firebase Auth.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.95rem' }}>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyles}
              placeholder="you@grestok.com"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.95rem' }}>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyles}
              placeholder="••••••••"
            />
          </label>
          {error ? (
            <span style={{ color: '#ff7b86', fontSize: '0.9rem' }}>{error}</span>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            style={{
              border: 'none',
              borderRadius: '999px',
              padding: '0.95rem',
              marginTop: '0.5rem',
              background: loading ? 'var(--text-muted)' : 'linear-gradient(90deg, var(--accent), var(--accent-strong))',
              color: '#041414',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? 'Signing in…' : 'Continue'}
          </button>
        </form>
        <p style={{ marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Having trouble? Ping the CampusConnect ops channel or{' '}
          <Link href="/" style={{ color: 'var(--accent)' }}>
            go back
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

const inputStyles: CSSProperties = {
  borderRadius: '12px',
  border: '1px solid var(--border)',
  background: 'rgba(255, 255, 255, 0.04)',
  padding: '0.85rem 1rem',
  color: 'var(--text)',
};
