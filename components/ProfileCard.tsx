'use client';

import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import type { CSSProperties } from 'react';
import { useAuth } from '@/context/AuthContext';
import { firebaseApp } from '@/lib/firebase/client';

const db = getFirestore(firebaseApp);

interface UserProfile {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  studyLevel?: string;
  source?: string;
  preferences?: {
    budget?: {
      annualAmount?: number;
      currencyCode?: string;
      considersLoan?: boolean;
    };
    destinationCountries?: string[];
    fieldOfStudy?: {
      category?: string;
      focus?: string;
    };
    intake?: {
      month?: string;
      year?: number;
    };
  };
  updatedAt?: string;
  lastUpdatedAt?: string;
}

export function ProfileCard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setProfile(null);
      return undefined;
    }

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const ref = doc(db, 'Users', user.uid);
        const snap = await getDoc(ref);
        if (!cancelled) {
          setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        if (!cancelled) {
          setError('Unable to load profile from Firestore.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, refreshIndex]);

  const identityName = useMemo(() => {
    if (profile?.displayName) return profile.displayName;
    const composed = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
    if (composed) return composed;
    return user?.displayName ?? 'CampusConnect learner';
  }, [profile?.displayName, profile?.firstName, profile?.lastName, user?.displayName]);

  if (!user) {
    return null;
  }

  const meta = {
    email: profile?.email ?? user.email,
    phone: profile?.phoneNumber ?? '—',
    uid: user.uid,
    studyLevel: profile?.studyLevel ?? '—',
    source: profile?.source ?? '—',
    updated: formatDateish(profile?.updatedAt ?? profile?.lastUpdatedAt),
  };

  const preferences = profile?.preferences;

  return (
    <section style={cardStyles}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' }}>
        <p style={{ color: 'var(--accent)', margin: 0 }}>Profile synced</p>
        <button
          type="button"
          onClick={() => setRefreshIndex(prev => prev + 1)}
          disabled={loading}
          style={refreshButtonStyles}
        >
          {loading ? 'Syncing…' : '↻ Refresh'}
        </button>
      </div>

      <h2 style={{ margin: '0.35rem 0 0' }}>{identityName}</h2>
      <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)' }}>{meta.email}</p>

      <dl style={metaListStyles}>
        
        <dt>Study level</dt>
        <dd style={metaListValueStyles}>{meta.studyLevel}</dd>
        <dt>Source</dt>
        <dd style={metaListValueStyles}>{meta.source}</dd>
        <dt>Phone</dt>
        <dd style={metaListValueStyles}>{meta.phone}</dd>
        <dt>Recently updated</dt>
        <dd style={metaListValueStyles}>{meta.updated}</dd>
      </dl>

      {loading ? <p style={mutedText}>Syncing Firestore details…</p> : null}
      {error ? <p style={{ color: '#ff8b94', margin: 0 }}>{error}</p> : null}
      {!loading && !profile ? (
        <p style={mutedText}>We have not received additional profile info yet.</p>
      ) : null}

      {preferences ? (
        <div style={sectionStyles}>
          <p style={sectionTitleStyles}>Preferences snapshot</p>
          <div style={pillListStyles}>
            {preferences.destinationCountries?.length ? (
              <div>
                <span style={pillLabelStyles}>Destinations</span>
                <p style={pillValueStyles}>{preferences.destinationCountries.join(', ')}</p>
              </div>
            ) : null}
            {preferences.fieldOfStudy ? (
              <div>
                <span style={pillLabelStyles}>Field of study</span>
                <p style={pillValueStyles}>
                  {preferences.fieldOfStudy.category}
                  {preferences.fieldOfStudy.focus ? ` · ${preferences.fieldOfStudy.focus}` : ''}
                </p>
              </div>
            ) : null}
            {preferences.intake ? (
              <div>
                <span style={pillLabelStyles}>Target intake</span>
                <p style={pillValueStyles}>
                  {preferences.intake.month ?? 'TBD'} {preferences.intake.year ?? ''}
                </p>
              </div>
            ) : null}
            {preferences.budget ? (
              <div>
                <span style={pillLabelStyles}>Budget</span>
                <p style={pillValueStyles}>
                  {formatCurrency(preferences.budget.annualAmount, preferences.budget.currencyCode)}{' '}
                  {preferences.budget.considersLoan ? '(loan ok)' : ''}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatCurrency(amount?: number, currency?: string) {
  if (!amount) return '—';
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currency ?? 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency ?? ''}`.trim();
  }
}

type FirestoreTimestamp = { seconds: number; nanoseconds: number };

function formatDateish(value?: string | FirestoreTimestamp): string {
  if (!value) {
    return '—';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') {
    const millis = value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1_000_000);
    return new Date(millis).toLocaleString();
  }
  return String(value);
}

const cardStyles: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.04)',
  borderRadius: '20px',
  border: '1px solid var(--border)',
  padding: '1.75rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const metaListStyles: CSSProperties = {
  margin: 0,
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  columnGap: '0.65rem',
  rowGap: '0.35rem',
  color: 'var(--text-muted)',
  fontSize: '0.9rem',
};

const metaListValueStyles: CSSProperties = {
  margin: 0,
  color: 'var(--text)',
};

const mutedText: CSSProperties = {
  color: 'var(--text-muted)',
  margin: 0,
  fontSize: '0.9rem',
};

const sectionStyles: CSSProperties = {
  paddingTop: '0.75rem',
  borderTop: '1px solid var(--border)',
};

const sectionTitleStyles: CSSProperties = {
  margin: '0 0 0.5rem',
  fontWeight: 600,
  fontSize: '0.95rem',
};

const pillListStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const pillLabelStyles: CSSProperties = {
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-muted)',
};

const pillValueStyles: CSSProperties = {
  margin: '0.2rem 0 0',
  background: 'rgba(0, 0, 0, 0.2)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '0.6rem 0.75rem',
};

const refreshButtonStyles: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: '999px',
  padding: '0.35rem 0.9rem',
  background: 'rgba(255, 255, 255, 0.06)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: '0.85rem',
};
