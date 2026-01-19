import Link from 'next/link';

export default function LandingPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
      }}
    >
      <div
        style={{
          background: 'var(--card)',
          borderRadius: '20px',
          padding: '3rem',
          width: '100%',
          maxWidth: '720px',
          border: '1px solid var(--border)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
        }}
      >
        <p style={{ color: 'var(--accent)', marginBottom: '0.5rem', fontWeight: 600 }}>
          Grestok Navigator Agent
        </p>
        <h1 style={{ margin: '0 0 1rem', fontSize: '2.8rem', lineHeight: 1.1 }}>
          Guidance without the wait
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '2.5rem' }}>
          Ask the Immigration agent
          anything about Canada immigration & Express entry program.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link
            href="/login"
            style={{
              background: 'var(--accent)',
              borderRadius: '999px',
              padding: '0.9rem 1.8rem',
              color: '#031417',
              fontWeight: 600,
            }}
          >
            Sign in to start
          </Link>
          <Link
            href="/dashboard"
            style={{
              borderRadius: '999px',
              padding: '0.9rem 1.8rem',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontWeight: 600,
            }}
          >
            View dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
