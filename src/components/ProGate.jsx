/* SAMSARA - Pro Tier Gating Components */
import { useState } from 'react';
import T from '../utils/tokens';
import S from '../utils/styles';
import { SamsaraSymbol } from './Shared';

/* ── ProBadge: small inline "PRO" tag ─────────────────────────── */
export function ProBadge({ style }) {
  return (
    <span style={{
      fontSize: 8, fontWeight: 700, fontFamily: T.fm, letterSpacing: 1.5,
      color: T.bg, background: T.gold, borderRadius: 4, padding: '2px 5px',
      verticalAlign: 'middle', marginLeft: 6, ...style,
    }}>PRO</span>
  );
}

/* ── ProLock: overlay that blurs content and shows upgrade prompt ─── */
export function ProLock({ children, onUpgrade, label }) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ filter: 'blur(3px)', opacity: 0.4, pointerEvents: 'none', userSelect: 'none' }}>
        {children}
      </div>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', zIndex: 10,
      }}>
        <div style={{
          background: 'rgba(8,9,11,0.85)', border: '1px solid ' + T.goldM,
          borderRadius: 13, padding: '20px 24px', textAlign: 'center',
          maxWidth: 280, backdropFilter: 'blur(8px)',
        }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>{'\u2731'}</div>
          <div style={{
            fontSize: 13, fontWeight: 600, color: T.t1, fontFamily: T.fb, marginBottom: 4,
          }}>{label || 'Pro Feature'}</div>
          <div style={{
            fontSize: 11, color: T.t3, fontFamily: T.fm, lineHeight: 1.5, marginBottom: 14,
          }}>Upgrade to unlock this feature.</div>
          <button onClick={onUpgrade} style={{
            ...S.logBtn, width: '100%', padding: '10px', textAlign: 'center',
            fontSize: 12, fontWeight: 600,
          }}>Upgrade to Pro</button>
        </div>
      </div>
    </div>
  );
}

/* ── ProTab: replaces entire tab content with upgrade prompt ─── */
export function ProTab({ onUpgrade, title, features }) {
  return (
    <div style={{ animation: 'fadeUp .5s ease both', padding: '40px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>{'\u2731'}</div>
      <h2 style={{
        fontFamily: T.fd, fontSize: 24, fontWeight: 300, color: T.t1, marginBottom: 8,
      }}>{title}</h2>
      <p style={{
        fontFamily: T.fm, fontSize: 12, color: T.t3, lineHeight: 1.6, marginBottom: 24,
      }}>This feature requires Samsara Pro.</p>

      {features && features.length > 0 && (
        <div style={{
          ...S.card, padding: '14px 16px', marginBottom: 24, textAlign: 'left',
          borderColor: T.goldM, background: T.goldS,
        }}>
          {features.map((f, i) => (
            <div key={i} style={{ fontSize: 12, color: T.t2, fontFamily: T.fm, lineHeight: 1.8 }}>
              <span style={{ color: T.gold, marginRight: 6 }}>{'\u2713'}</span>{f}
            </div>
          ))}
        </div>
      )}

      <button onClick={onUpgrade} style={{
        ...S.logBtn, width: '100%', padding: '14px', textAlign: 'center',
        fontSize: 14, fontWeight: 600, letterSpacing: 0.5,
      }}>Upgrade to Pro</button>
    </div>
  );
}

/* ── UpgradeScreen: full-screen paywall modal ─────────────────────────── */
const PRO_FEATURES = [
  { icon: '\u2728', title: 'AI Body Analysis', desc: 'Photo-powered composition tracking with Claude AI' },
  { icon: '\u2261', title: 'Advanced Metrics', desc: 'Subjective trends, weekly insights, and milestone detection' },
  { icon: '\u2696', title: 'Lab Results', desc: 'Extract and track bloodwork markers with AI' },
  { icon: '\u25CE', title: 'Site Rotation', desc: 'Tissue quality tracking with 3D body map' },
  { icon: '\u2693', title: 'Vial Management', desc: 'Track freshness, remaining doses, and expiry' },
  { icon: '\u2B50', title: 'Subjective Logging', desc: 'Mood, energy, sleep, and libido tracking' },
  { icon: '\u21E9', title: 'Data Export', desc: 'Full backup with photos to keep your data safe' },
  { icon: '\u266B', title: 'Smart Notifications', desc: 'Dose reminders, vial expiry, and streak alerts' },
];

/* ── PricingOptions: 3-tier pricing selector ─────────────────────────── */
function PricingOptions() {
  const [selected, setSelected] = useState('year');

  const plans = [
    { key: 'month', label: 'Monthly', price: '$4.99', sub: '/month', note: null },
    { key: 'year', label: 'Annual', price: '$29.99', sub: '/year', note: 'Save 50%', best: true },
    { key: 'lifetime', label: 'Lifetime', price: '$49.99', sub: 'one time', note: 'Best value' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {plans.map(p => {
          const active = selected === p.key;
          return (
            <button key={p.key} onClick={() => setSelected(p.key)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 10,
              background: active ? T.goldS : 'rgba(255,255,255,0.02)',
              border: active ? '1.5px solid ' + T.gold : '1px solid ' + T.border,
              cursor: 'pointer', textAlign: 'left', width: '100%',
              transition: 'all .2s ease', position: 'relative',
            }}>
              {/* Radio circle */}
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                border: '2px solid ' + (active ? T.gold : T.t3),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {active && <div style={{ width: 10, height: 10, borderRadius: '50%', background: T.gold }} />}
              </div>
              {/* Plan info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: active ? T.gold : T.t1, fontFamily: T.fb }}>{p.label}</div>
                <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginTop: 1 }}>{p.sub}</div>
              </div>
              {/* Price */}
              <div style={{ fontSize: 18, fontWeight: 300, color: active ? T.gold : T.t1, fontFamily: T.fd }}>{p.price}</div>
              {/* Badge */}
              {p.note && (
                <div style={{
                  position: 'absolute', top: -8, right: 12,
                  fontSize: 8, fontWeight: 700, fontFamily: T.fm, letterSpacing: 1,
                  color: T.bg, background: T.gold, borderRadius: 4, padding: '2px 6px',
                  textTransform: 'uppercase',
                }}>{p.note}</div>
              )}
            </button>
          );
        })}
      </div>

      <button onClick={() => {/* IAP will go here based on selected plan */}} style={{
        ...S.logBtn, width: '100%', padding: '16px', textAlign: 'center',
        fontSize: 15, fontWeight: 700, letterSpacing: 0.5,
        background: T.gold, color: T.bg, border: 'none', borderRadius: 10,
      }}>{selected === 'lifetime' ? 'Purchase Lifetime' : 'Subscribe to Pro'}</button>
    </div>
  );
}

export function UpgradeScreen({ onClose, onRestore }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500, background: T.bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      overflowY: 'auto',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {/* Close button */}
      <div style={{ width: '100%', maxWidth: 480, padding: '16px 20px 0' }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: T.t2, fontFamily: T.fm,
          fontSize: 12, cursor: 'pointer', padding: '4px 0',
        }}>{'\u2190'} Back</button>
      </div>

      <div style={{
        maxWidth: 480, width: '100%', padding: '0 20px 40px',
        animation: 'fadeUp .4s ease both',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', paddingTop: 20, marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <SamsaraSymbol size={48} detail="full" />
          </div>
          <h1 style={{
            fontFamily: T.fd, fontSize: 28, fontWeight: 300, letterSpacing: 6,
            color: T.t1, margin: 0,
          }}>SAMSARA <span style={{
            fontSize: 14, fontWeight: 700, fontFamily: T.fm, letterSpacing: 2,
            color: T.gold, verticalAlign: 'middle',
          }}>PRO</span></h1>
          <p style={{
            fontFamily: T.fm, fontSize: 11, color: T.t3, marginTop: 8, lineHeight: 1.5,
          }}>Unlock the full protocol experience.</p>
        </div>

        {/* Feature list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
          {PRO_FEATURES.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '10px 14px', borderRadius: 10,
              background: 'rgba(255,255,255,0.02)', border: '1px solid ' + T.border,
            }}>
              <span style={{ fontSize: 16, lineHeight: 1, marginTop: 2 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.t1, fontFamily: T.fb }}>{f.title}</div>
                <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginTop: 2, lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing options — will be wired to Apple IAP */}
        <PricingOptions />

        <div style={{ height: 8 }} />

        <button onClick={onRestore} style={{
          width: '100%', padding: '10px', textAlign: 'center',
          fontSize: 11, color: T.t3, fontFamily: T.fm,
          background: 'none', border: 'none', cursor: 'pointer',
        }}>Restore Purchase</button>

        <div style={{ height: 12 }} />

        <p style={{
          fontSize: 9, color: T.t3, fontFamily: T.fm, textAlign: 'center', lineHeight: 1.6, opacity: 0.6,
        }}>
          Payment will be charged to your Apple ID account at confirmation of purchase.
          Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period.
        </p>
      </div>
    </div>
  );
}

/* ── Helper: check if feature is available ─── */
export const isPro = (profile) => profile?.tier === 'pro';
export const FREE_STACK_LIMIT = Infinity; // full library access on free tier
