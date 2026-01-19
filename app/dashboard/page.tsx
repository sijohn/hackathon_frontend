'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import { ChatPanel } from '@/components/ChatPanel';
import { ProfileCard } from '@/components/ProfileCard';
import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <main style={containerStyles}>
        <p>Loading your campus data…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main style={containerStyles}>
        <div style={cardStyles}>
          <h1 style={{ marginTop: 0 }}>You are signed out</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Authenticate through Firebase.
          </p>
          <Link
            href="/login"
            style={{
              display: 'inline-flex',
              borderRadius: '999px',
              padding: '0.85rem 1.5rem',
              background: 'var(--accent)',
              color: '#032025',
              fontWeight: 600,
            }}
          >
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={containerStyles}>
      <div style={contentStyles}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            marginBottom: '2rem',
            gap: '1rem',
          }}
        >
          <div>
            <p style={{ color: 'var(--accent)', margin: 0 }}>Welcome back</p>
            <h1 style={{ margin: '0.25rem 0 0' }}>{user.displayName ?? user.email}</h1>
          </div>
          <button
            onClick={async () => {
              await logout();
              router.replace('/');
            }}
            style={{
              border: '1px solid var(--border)',
              borderRadius: '999px',
              padding: '0.65rem 1.5rem',
              background: 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Sign out
          </button>
        </header>
        <div className="dashboardGrid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <ProfileCard />
          </div>
          <ChatPanel />
        </div>
      </div>
    </main>
  );
}

const containerStyles: CSSProperties = {
  minHeight: '100vh',
  padding: '2.5rem',
  display: 'block',
  background: 'linear-gradient(135deg, #040711 0%, #050a1c 55%, #07102a 100%)',
};

const contentStyles: CSSProperties = {
  width: 'min(1200px, 100%)',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
};

const cardStyles: CSSProperties = {
  width: '100%',
  maxWidth: '480px',
  background: 'var(--card)',
  borderRadius: '24px',
  padding: '2.5rem',
  border: '1px solid var(--border)',
};
