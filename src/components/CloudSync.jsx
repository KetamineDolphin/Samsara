/* SAMSARA v4.0 - Cloud Sync UI Component
   OTP code-based auth (no email links — works on iOS native).
   Gated behind Pro subscription.
*/
import { useState, useEffect, useCallback } from 'react';
import T from '../utils/tokens';
import S from '../utils/styles';
import { isCloudConfigured, supabase } from '../utils/supabase';
import {
  useSyncStatus,
  signUp,
  signIn,
  sendOtp,
  verifyOtp,
  resendSignupOtp,
  signOut,
  getCurrentUserId,
  pushAll,
  mergePull,
  onAuthChange,
} from '../hooks/useSync';

const STATUS_DISPLAY = {
  idle: { label: 'Not connected', color: T.t3, icon: '\u25CB' },
  syncing: { label: 'Syncing...', color: T.gold, icon: '\u21BB' },
  synced: { label: 'Synced', color: '#5cb870', icon: '\u2713' },
  offline: { label: 'Offline', color: T.amber, icon: '\u2299' },
  error: { label: 'Sync error', color: T.red, icon: '\u2717' },
  disabled: { label: 'Not configured', color: T.t3, icon: '\u2015' },
};

function SyncStatusBadge({ status, lastSynced }) {
  const display = STATUS_DISPLAY[status] || STATUS_DISPLAY.idle;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 13, color: display.color }}>{display.icon}</span>
      <span style={{ fontSize: 11, color: display.color, fontFamily: T.fm }}>{display.label}</span>
      {lastSynced && status === 'synced' && (
        <span style={{ fontSize: 9, color: T.t3, fontFamily: T.fm }}>
          {'\u00B7'} {new Date(lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}

export default function CloudSync() {
  const configured = isCloudConfigured();
  const { status, lastSynced } = useSyncStatus();
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [authMode, setAuthMode] = useState(null); // null | 'signin' | 'signup' | 'otp' | 'verify'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState(''); // email awaiting OTP verification
  const [otpType, setOtpType] = useState('email'); // 'signup' | 'email'
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Check existing session on mount
  useEffect(() => {
    if (!configured) return;
    getCurrentUserId().then(id => {
      if (id) {
        setUserId(id);
        if (supabase) {
          supabase.auth.getSession().then(({ data }) => {
            setUserEmail(data?.session?.user?.email || null);
          });
        }
      }
    });
  }, [configured]);

  // Listen for auth changes
  useEffect(() => {
    if (!configured) return;
    const unsub = onAuthChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        setUserEmail(session.user.email);
        setAuthMode(null);
      } else {
        setUserId(null);
        setUserEmail(null);
      }
    });
    return unsub;
  }, [configured]);

  const resetAuth = useCallback(() => {
    setAuthMode(null); setMessage(null); setEmail(''); setPassword(''); setOtpCode(''); setPendingEmail('');
  }, []);

  const handleSignIn = useCallback(async () => {
    setLoading(true); setMessage(null);
    const result = await signIn(email, password);
    setLoading(false);
    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else {
      setMessage({ type: 'success', text: 'Signed in! Syncing your data...' });
      if (result.user) {
        const applied = await mergePull(result.user.id);
        if (applied) setMessage({ type: 'success', text: 'Data synced from cloud. Reload to apply.' });
      }
    }
  }, [email, password]);

  const handleSignUp = useCallback(async () => {
    setLoading(true); setMessage(null);
    const result = await signUp(email, password);
    setLoading(false);
    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else if (result.needsVerification) {
      // Move to verification step — user needs to enter OTP code from email
      setPendingEmail(email);
      setOtpType('signup');
      setAuthMode('verify');
      setMessage({ type: 'success', text: 'Account created! Enter the 6-digit code sent to your email.' });
      // Push data immediately if we got a user
      if (result.user) await pushAll(result.user.id);
    } else {
      setMessage({ type: 'success', text: 'Account created and signed in!' });
      if (result.user) await pushAll(result.user.id);
    }
  }, [email, password]);

  const handleSendOtp = useCallback(async () => {
    setLoading(true); setMessage(null);
    const result = await sendOtp(email);
    setLoading(false);
    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else {
      setPendingEmail(email);
      setOtpType('email');
      setAuthMode('verify');
      setMessage({ type: 'success', text: 'Code sent! Check your email for a 6-digit code.' });
    }
  }, [email]);

  const handleVerifyOtp = useCallback(async () => {
    if (otpCode.length < 6) { setMessage({ type: 'error', text: 'Enter the 6-digit code from your email.' }); return; }
    setLoading(true); setMessage(null);
    const result = await verifyOtp(pendingEmail, otpCode, otpType);
    setLoading(false);
    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else {
      setMessage({ type: 'success', text: 'Verified! Syncing your data...' });
      if (result.user) {
        const applied = await mergePull(result.user.id);
        if (applied) setMessage({ type: 'success', text: 'Data synced from cloud. Reload to apply.' });
      }
    }
  }, [otpCode, pendingEmail, otpType]);

  const handleResendCode = useCallback(async () => {
    setLoading(true); setMessage(null);
    const result = otpType === 'signup'
      ? await resendSignupOtp(pendingEmail)
      : await sendOtp(pendingEmail);
    setLoading(false);
    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else {
      setMessage({ type: 'success', text: 'New code sent! Check your email.' });
      setOtpCode('');
    }
  }, [pendingEmail, otpType]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setUserId(null); setUserEmail(null); setMessage(null);
  }, []);

  const handleSyncNow = useCallback(async () => {
    if (!userId) return;
    setSyncing(true); await pushAll(userId); setSyncing(false);
  }, [userId]);

  const handlePullFromCloud = useCallback(async () => {
    if (!userId) return;
    setSyncing(true);
    const applied = await mergePull(userId);
    setSyncing(false);
    if (applied) {
      setMessage({ type: 'success', text: 'Cloud data merged. Reload to apply changes.' });
    } else {
      setMessage({ type: 'info', text: 'Already up to date.' });
    }
  }, [userId]);

  // Not configured
  if (!configured) {
    return (
      <div style={{ ...S.card, padding: '14px', marginBottom: 12 }}>
        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 10 }}>Cloud Sync</div>
        <div style={{ fontSize: 12, color: T.t2, fontFamily: T.fm, lineHeight: 1.6 }}>
          Cloud sync is available but not configured. To enable, set <span style={{ color: T.gold, fontFamily: T.fm }}>VITE_SUPABASE_URL</span> and <span style={{ color: T.gold, fontFamily: T.fm }}>VITE_SUPABASE_ANON_KEY</span> in your environment.
        </div>
      </div>
    );
  }

  // Signed in — show sync controls
  if (userId) {
    return (
      <div style={{ ...S.card, padding: '14px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>Cloud Sync</div>
          <SyncStatusBadge status={status} lastSynced={lastSynced} />
        </div>
        <div style={{ fontSize: 12, color: T.t2, fontFamily: T.fm, marginBottom: 10 }}>
          Signed in as <span style={{ color: T.gold }}>{userEmail || 'unknown'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={handleSyncNow} disabled={syncing}
            style={{ ...S.logBtn, flex: 1, padding: '10px', textAlign: 'center', fontSize: 11, opacity: syncing ? 0.5 : 1 }}>
            {syncing ? 'Syncing...' : '\u2191 Push to Cloud'}
          </button>
          <button onClick={handlePullFromCloud} disabled={syncing}
            style={{ ...S.newVialBtn, flex: 1, padding: '10px', textAlign: 'center', fontSize: 11, opacity: syncing ? 0.5 : 1 }}>
            {syncing ? 'Syncing...' : '\u2193 Pull from Cloud'}
          </button>
        </div>
        {message && (
          <div style={{
            fontSize: 11, fontFamily: T.fm, marginBottom: 8, padding: '8px 10px', borderRadius: 8,
            color: message.type === 'error' ? T.red : message.type === 'success' ? '#5cb870' : T.gold,
            background: message.type === 'error' ? 'rgba(220,80,80,0.06)' : message.type === 'success' ? 'rgba(92,184,112,0.06)' : 'rgba(201,168,76,0.06)',
          }}>
            {message.text}
          </div>
        )}
        <button onClick={handleSignOut}
          style={{ ...S.newVialBtn, width: '100%', fontSize: 10, color: 'rgba(220,80,80,0.6)', borderColor: 'rgba(220,80,80,0.2)' }}>
          Sign Out
        </button>
      </div>
    );
  }

  // OTP Verification step
  if (authMode === 'verify') {
    return (
      <div style={{ ...S.card, padding: '14px', marginBottom: 12 }}>
        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 6 }}>Verify Email</div>
        <div style={{ fontSize: 12, color: T.t2, fontFamily: T.fm, lineHeight: 1.6, marginBottom: 12 }}>
          Enter the 6-digit code sent to <span style={{ color: T.gold }}>{pendingEmail}</span>
        </div>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otpCode}
          onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          autoComplete="one-time-code"
          style={{
            ...S.input, width: '100%', marginBottom: 10, fontSize: 28, fontWeight: 700,
            padding: '14px', textAlign: 'center', letterSpacing: 12, fontFamily: T.fm,
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={handleVerifyOtp} disabled={loading || otpCode.length < 6}
            style={{ ...S.logBtn, flex: 1, padding: '10px', textAlign: 'center', fontSize: 11, opacity: loading || otpCode.length < 6 ? 0.5 : 1 }}>
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
          <button onClick={resetAuth} style={{ ...S.newVialBtn, padding: '10px 14px', fontSize: 11 }}>Cancel</button>
        </div>
        <button onClick={handleResendCode} disabled={loading}
          style={{ background: 'none', border: 'none', color: T.t3, fontSize: 10, fontFamily: T.fm, cursor: 'pointer', padding: '4px 0', textDecoration: 'underline' }}>
          Resend code
        </button>
        {message && (
          <div style={{
            fontSize: 11, fontFamily: T.fm, marginTop: 8, padding: '8px 10px', borderRadius: 8,
            color: message.type === 'error' ? T.red : '#5cb870',
            background: message.type === 'error' ? 'rgba(220,80,80,0.06)' : 'rgba(92,184,112,0.06)',
          }}>
            {message.text}
          </div>
        )}
      </div>
    );
  }

  // Not signed in — auth options
  return (
    <div style={{ ...S.card, padding: '14px', marginBottom: 12 }}>
      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 6 }}>Cloud Sync</div>
      <div style={{ fontSize: 12, color: T.t2, fontFamily: T.fm, lineHeight: 1.6, marginBottom: 12 }}>
        Sign in to back up your data and sync across devices.
      </div>

      {!authMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setAuthMode('signin')} style={{ ...S.logBtn, flex: 1, padding: '10px', textAlign: 'center', fontSize: 11 }}>Sign In</button>
            <button onClick={() => setAuthMode('signup')} style={{ ...S.newVialBtn, flex: 1, padding: '10px', textAlign: 'center', fontSize: 11 }}>Create Account</button>
          </div>
          <button onClick={() => setAuthMode('otp')}
            style={{ background: 'none', border: 'none', color: T.t3, fontSize: 10, fontFamily: T.fm, cursor: 'pointer', padding: '4px 0', textDecoration: 'underline', textAlign: 'center' }}>
            Sign in with email code (no password)
          </button>
        </div>
      ) : (
        <div>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            style={{ ...S.input, width: '100%', marginBottom: 8, fontSize: 13, padding: '11px 14px' }}
          />
          {authMode !== 'otp' && (
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              style={{ ...S.input, width: '100%', marginBottom: 10, fontSize: 13, padding: '11px 14px' }}
            />
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {authMode === 'signin' && (
              <button onClick={handleSignIn} disabled={loading || !email}
                style={{ ...S.logBtn, flex: 1, padding: '10px', textAlign: 'center', fontSize: 11, opacity: loading ? 0.5 : 1 }}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            )}
            {authMode === 'signup' && (
              <button onClick={handleSignUp} disabled={loading || !email || !password}
                style={{ ...S.logBtn, flex: 1, padding: '10px', textAlign: 'center', fontSize: 11, opacity: loading ? 0.5 : 1 }}>
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            )}
            {authMode === 'otp' && (
              <button onClick={handleSendOtp} disabled={loading || !email}
                style={{ ...S.logBtn, flex: 1, padding: '10px', textAlign: 'center', fontSize: 11, opacity: loading ? 0.5 : 1 }}>
                {loading ? 'Sending...' : 'Send Code'}
              </button>
            )}
            <button onClick={resetAuth} style={{ ...S.newVialBtn, padding: '10px 14px', fontSize: 11 }}>Cancel</button>
          </div>

          {authMode === 'otp' ? (
            <button onClick={() => setAuthMode('signin')}
              style={{ background: 'none', border: 'none', color: T.t3, fontSize: 10, fontFamily: T.fm, cursor: 'pointer', padding: '4px 0', textDecoration: 'underline' }}>
              Use password instead
            </button>
          ) : (
            <button onClick={() => setAuthMode('otp')}
              style={{ background: 'none', border: 'none', color: T.t3, fontSize: 10, fontFamily: T.fm, cursor: 'pointer', padding: '4px 0', textDecoration: 'underline' }}>
              Use email code instead (no password)
            </button>
          )}

          {message && (
            <div style={{
              fontSize: 11, fontFamily: T.fm, marginTop: 8, padding: '8px 10px', borderRadius: 8,
              color: message.type === 'error' ? T.red : '#5cb870',
              background: message.type === 'error' ? 'rgba(220,80,80,0.06)' : 'rgba(92,184,112,0.06)',
            }}>
              {message.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
