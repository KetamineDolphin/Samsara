/* SAMSARA — AI Body Scan
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DEXA-style body composition report generated from progress photos.
   Produces regional fat estimates, lean mass ratings, composition
   breakdown, and visceral fat assessment using Claude Vision.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import { useState, useEffect, useRef, useCallback } from 'react';
import T from '../utils/tokens';
import S from '../utils/styles';
import { getPhotosForCheckin } from '../hooks/useStorage';
import { SamsaraSymbol, Enso } from './Shared';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DEXA ANALYSIS PROMPT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const DEXA_PROMPT = `You are Samsara's AI Body Scan engine — a clinical-grade body composition estimator. You analyze physique photos with the precision of a DEXA scan, producing regional body fat estimates and lean mass assessments.

Analyze the uploaded photo(s) and return ONLY a valid JSON object. No markdown, no backticks, no explanation — raw JSON only.

Required JSON schema:
{
  "totalBodyFatPct": 18.5,
  "totalLeanMassLbs": 155,
  "totalFatMassLbs": 34,
  "boneMineralPct": 3.2,
  "regions": {
    "leftArm": { "fatPct": 14.2, "leanLbs": 9.8, "rating": "lean" },
    "rightArm": { "fatPct": 14.0, "leanLbs": 10.1, "rating": "lean" },
    "chest": { "fatPct": 15.5, "leanLbs": 12.3, "rating": "lean" },
    "upperAbs": { "fatPct": 18.0, "leanLbs": 8.4, "rating": "moderate" },
    "lowerAbs": { "fatPct": 24.5, "leanLbs": 6.2, "rating": "elevated" },
    "obliques": { "fatPct": 22.0, "leanLbs": 5.8, "rating": "moderate" },
    "upperBack": { "fatPct": 14.8, "leanLbs": 14.5, "rating": "lean" },
    "lowerBack": { "fatPct": 20.0, "leanLbs": 7.2, "rating": "moderate" },
    "glutes": { "fatPct": 20.5, "leanLbs": 11.0, "rating": "moderate" },
    "leftLeg": { "fatPct": 17.8, "leanLbs": 22.5, "rating": "lean" },
    "rightLeg": { "fatPct": 17.5, "leanLbs": 23.0, "rating": "lean" }
  },
  "androidFatPct": 22.5,
  "gynoidFatPct": 18.0,
  "agRatio": 1.25,
  "visceralFatRating": "moderate",
  "visceralFatArea": 95,
  "symmetryScore": 9.2,
  "muscleDensityRating": "above average",
  "bodyType": "mesomorph-leaning",
  "metabolicAge": 28,
  "keyFinding": "One specific, clinical-sounding observation about the most significant composition finding.",
  "comparedToLast": "Specific comparison to previous scan data if provided. If first scan, say 'Baseline scan established.'",
  "recommendations": [
    "Specific actionable recommendation based on composition findings",
    "Second recommendation targeting weakest region"
  ]
}

Rating scale for regions: "very lean" (<12%), "lean" (12-17%), "moderate" (17-23%), "elevated" (23-28%), "high" (>28%).

Critical rules:
- Assess ONLY what is visible in the photo(s). Do not let protocol duration, compound names, or any non-visual context bias your estimates.
- The same photo must produce the same results regardless of whether it is day 1 or day 100 of a protocol.
- Use the subject's weight to calculate realistic lean/fat mass splits. Total lean + fat must approximately equal body weight.
- Regional lean mass must sum approximately to total lean mass.
- Be precise — narrow estimates, not wide ranges. This simulates clinical equipment.
- Android fat = trunk region average. Gynoid fat = hip/thigh region average. A/G ratio > 1.0 indicates android (central) fat distribution.
- Visceral fat area: <100 cm² normal, 100-160 elevated, >160 high.
- Metabolic age: estimate based on composition relative to population norms.
- If only front photo available, estimate back/posterior regions with lower confidence.
- Symmetry score: 10 = perfect bilateral symmetry, assess arm and leg balance.
- Be honest and consistent. Never inflate or deflate estimates based on expected timeline or protocol. A clinician reports what the scan shows, period.`;

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BODY MAP SVG — Stylized anatomical silhouette with fillable regions
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const REGION_COLORS = {
  'very lean': 'rgba(0,210,180,0.85)',
  'lean':      'rgba(92,184,112,0.8)',
  'moderate':  'rgba(201,168,76,0.75)',
  'elevated':  'rgba(230,140,60,0.8)',
  'high':      'rgba(220,80,80,0.8)',
};

function fatPctToColor(pct) {
  if (pct < 12) return REGION_COLORS['very lean'];
  if (pct < 17) return REGION_COLORS['lean'];
  if (pct < 23) return REGION_COLORS['moderate'];
  if (pct < 28) return REGION_COLORS['elevated'];
  return REGION_COLORS['high'];
}

function BodyMap({ regions, size = 260 }) {
  const r = regions || {};
  const gc = (key) => r[key] ? fatPctToColor(r[key].fatPct) : 'rgba(255,255,255,0.06)';

  // Glow filter intensity based on fat level
  const gf = (key) => {
    if (!r[key]) return 0;
    return r[key].fatPct < 17 ? 4 : r[key].fatPct < 23 ? 6 : 8;
  };

  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 200 320" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {Object.keys(r).map(key => (
          <filter key={key} id={`glow-${key}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={gf(key)} result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        ))}
      </defs>

      {/* Head - structural, no fat data */}
      <ellipse cx="100" cy="28" rx="16" ry="20" fill="rgba(240,236,228,0.08)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      {/* Neck */}
      <rect x="93" y="47" width="14" height="12" rx="4" fill="rgba(240,236,228,0.06)" />

      {/* Chest / Pectorals */}
      <path d="M68 62 Q72 56 100 56 Q128 56 132 62 L136 80 Q130 90 100 92 Q70 90 64 80 Z"
        fill={gc('chest')} opacity="0.85" filter={r.chest ? `url(#glow-chest)` : undefined}
        stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

      {/* Upper Abs */}
      <path d="M76 92 Q88 90 100 90 Q112 90 124 92 L122 115 Q112 117 100 117 Q88 117 78 115 Z"
        fill={gc('upperAbs')} opacity="0.85" filter={r.upperAbs ? `url(#glow-upperAbs)` : undefined}
        stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

      {/* Lower Abs */}
      <path d="M78 115 Q88 117 100 117 Q112 117 122 115 L120 145 Q112 148 100 148 Q88 148 80 145 Z"
        fill={gc('lowerAbs')} opacity="0.85" filter={r.lowerAbs ? `url(#glow-lowerAbs)` : undefined}
        stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

      {/* Left Oblique */}
      <path d="M64 80 L76 92 L78 115 L80 145 Q72 142 66 135 L60 100 Z"
        fill={gc('obliques')} opacity="0.8" filter={r.obliques ? `url(#glow-obliques)` : undefined}
        stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />

      {/* Right Oblique */}
      <path d="M136 80 L124 92 L122 115 L120 145 Q128 142 134 135 L140 100 Z"
        fill={gc('obliques')} opacity="0.8"
        stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />

      {/* Left Shoulder + Arm */}
      <path d="M68 62 L52 68 Q44 74 40 88 L38 120 Q36 130 40 132 Q44 134 46 130 L48 105 Q50 95 54 88 L60 80 L64 80"
        fill={gc('leftArm')} opacity="0.85" filter={r.leftArm ? `url(#glow-leftArm)` : undefined}
        stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

      {/* Right Shoulder + Arm */}
      <path d="M132 62 L148 68 Q156 74 160 88 L162 120 Q164 130 160 132 Q156 134 154 130 L152 105 Q150 95 146 88 L140 80 L136 80"
        fill={gc('rightArm')} opacity="0.85" filter={r.rightArm ? `url(#glow-rightArm)` : undefined}
        stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

      {/* Glutes / Hip */}
      <path d="M80 145 Q88 148 100 148 Q112 148 120 145 L124 162 Q116 170 100 172 Q84 170 76 162 Z"
        fill={gc('glutes')} opacity="0.8" filter={r.glutes ? `url(#glow-glutes)` : undefined}
        stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />

      {/* Left Leg */}
      <path d="M76 162 Q80 168 88 172 L90 220 Q88 250 86 270 Q84 285 88 290 Q82 292 80 288 L78 270 Q76 245 74 220 L72 190 Z"
        fill={gc('leftLeg')} opacity="0.85" filter={r.leftLeg ? `url(#glow-leftLeg)` : undefined}
        stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

      {/* Right Leg */}
      <path d="M124 162 Q120 168 112 172 L110 220 Q112 250 114 270 Q116 285 112 290 Q118 292 120 288 L122 270 Q124 245 126 220 L128 190 Z"
        fill={gc('rightLeg')} opacity="0.85" filter={r.rightLeg ? `url(#glow-rightLeg)` : undefined}
        stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

      {/* Center line - subtle anatomical detail */}
      <line x1="100" y1="60" x2="100" y2="148" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" strokeDasharray="2 3" />
    </svg>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ANIMATED COMPONENTS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function FadeIn({ delay = 0, children }) {
  return <div style={{ animation: `fadeUp .5s ease ${delay}s both` }}>{children}</div>;
}

/** Animated radial score ring */
function Ring({ value, max = 100, color, size = 80, label }) {
  const [progress, setProgress] = useState(0);
  const [displayVal, setDisplayVal] = useState(0);
  const rafRef = useRef(null);
  const target = parseFloat(value) || 0;
  const pct = target / max;
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;

  useEffect(() => {
    const dur = 1200; const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const p = Math.min(elapsed / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setProgress(eased * pct);
      setDisplayVal(+(eased * target).toFixed(1));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  const offset = circ * (1 - progress);
  const half = size / 2;

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
          <circle cx={half} cy={half} r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="5" />
          <circle cx={half} cy={half} r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.1s linear', filter: `drop-shadow(0 0 6px ${color})` }} />
        </svg>
        <div style={{ zIndex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: size * 0.28, fontWeight: 700, color, fontFamily: T.fm, lineHeight: 1 }}>{displayVal}</div>
          <div style={{ fontSize: 8, color: T.t3, fontFamily: T.fm }}>%</div>
        </div>
      </div>
      {label && <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 4 }}>{label}</div>}
    </div>
  );
}

/** Composition bar — horizontal stacked bar for fat/lean/bone */
function CompositionBar({ fatPct, leanPct, bonePct }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 300); return () => clearTimeout(t); }, []);

  const segments = [
    { pct: leanPct, color: 'rgba(0,210,180,0.7)', label: 'Lean' },
    { pct: fatPct, color: 'rgba(201,168,76,0.7)', label: 'Fat' },
    { pct: bonePct, color: 'rgba(150,120,220,0.6)', label: 'Bone' },
  ];

  return (
    <div>
      <div style={{ height: 24, borderRadius: 12, overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
        {segments.map((seg, i) => (
          <div key={i} style={{
            width: animated ? seg.pct + '%' : '0%',
            height: '100%', background: seg.color,
            transition: `width 1.2s cubic-bezier(.25,.8,.25,1) ${i * 0.15}s`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {seg.pct >= 12 && <span style={{ fontSize: 9, fontWeight: 600, color: '#fff', fontFamily: T.fm, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{seg.pct.toFixed(1)}%</span>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color }} />
            <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>{seg.label} {seg.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Region detail card */
function RegionCard({ name, data }) {
  if (!data) return null;
  const color = fatPctToColor(data.fatPct);
  const ratingLabel = data.rating || 'unknown';

  return (
    <div style={{
      padding: '10px 12px',
      background: 'rgba(255,255,255,0.015)',
      border: `1px solid rgba(255,255,255,0.05)`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.t1, fontFamily: T.fb }}>{name}</span>
        <span style={{ fontSize: 10, color, fontFamily: T.fm, fontWeight: 600 }}>{data.fatPct}%</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>{data.leanLbs} lbs lean</span>
        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${color}15`, color, fontFamily: T.fm, textTransform: 'uppercase', letterSpacing: 0.5 }}>{ratingLabel}</span>
      </div>
      {/* Mini fat bar */}
      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.03)', marginTop: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: Math.min(data.fatPct / 35 * 100, 100) + '%', borderRadius: 2, background: color, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MAIN COMPONENT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function DexaScan({ checkins, setCheckins, stack, profile }) {
  const [scanning, setScanning] = useState(false);
  const [scanData, setScanData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const abortRef = useRef(null);

  // Find check-ins with photos
  const withPhotos = (checkins || []).filter(c => c.hasPhotos || c.thumbFront);
  const sorted = [...withPhotos].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const latestWithScan = sorted.find(c => c.dexaScan);
  const selected = selectedId ? sorted.find(c => c.id === selectedId) : sorted[0];

  // Auto-load saved scan data
  useEffect(() => {
    if (!scanData && selected?.dexaScan) {
      setScanData(selected.dexaScan);
    }
  }, [selected]);

  const runScan = useCallback(async (checkin) => {
    if (!checkin) return;
    setScanning(true);
    setError(null);
    setScanData(null);

    try {
      // Load full photos from IndexedDB
      const photos = await getPhotosForCheckin(checkin.id);
      const photoMap = {};
      photos.forEach(p => { photoMap[p.slot] = p.data; });

      if (!photoMap.front && !photoMap.side) {
        setError('No photos found for this check-in. Full-resolution photos are needed for scanning.');
        setScanning(false);
        return;
      }

      // Build image blocks
      const imageBlocks = [];
      for (const key of ['front', 'side', 'back', 'flex']) {
        if (photoMap[key]) {
          imageBlocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photoMap[key] } });
        }
      }

      const photoLabels = Object.keys(photoMap);
      const prevScan = sorted.find(c => c.id !== checkin.id && c.dexaScan);
      const prevContext = prevScan
        ? `Previous scan data: ${JSON.stringify(prevScan.dexaScan)}`
        : 'First scan — establish baseline.';

      const payload = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        system: DEXA_PROMPT,
        messages: [{
          role: 'user',
          content: [
            ...imageBlocks,
            { type: 'text', text: `Body scan request.\nWeight: ${checkin.weight} lbs. Waist: ${checkin.waist}".\nPhotos available: ${photoLabels.join(', ')} (${photoLabels.length}).\nBio sex: ${profile?.biologicalSex || 'male'}. Age: ${profile?.age || '30'}. Height: ${profile?.height ? (profile.height.feet + "'" + profile.height.inches + '"') : 'unknown'}.\n${prevContext}` },
          ],
        }],
      };

      abortRef.current = new AbortController();
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortRef.current.signal,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`Analysis failed (${resp.status}): ${errText.slice(0, 100)}`);
      }

      const data = await resp.json();
      const rawText = (data.content || []).map(i => i.text || '').join('');

      // Parse JSON from response
      let parsed;
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(rawText);
      } catch {
        throw new Error('Could not parse scan results. Try again.');
      }

      if (!parsed.totalBodyFatPct || !parsed.regions) {
        throw new Error('Incomplete scan data returned. Try again.');
      }

      // Save scan data to check-in
      setScanData(parsed);
      setCheckins(prev => (prev || []).map(c =>
        c.id === checkin.id ? { ...c, dexaScan: parsed } : c
      ));

    } catch (e) {
      if (e.name === 'AbortError') {
        setError('Scan cancelled.');
      } else {
        setError(e.message || 'Scan failed. Please try again.');
      }
    }

    abortRef.current = null;
    setScanning(false);
  }, [sorted, stack, profile, setCheckins]);

  const cancelScan = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setScanning(false);
  }, []);

  /* ── Empty state ── */
  if (withPhotos.length === 0) {
    return (
      <div style={{ animation: 'fadeUp .5s ease both', textAlign: 'center', padding: '60px 20px' }}>
        <SamsaraSymbol size={48} />
        <p style={{ fontFamily: T.fd, fontSize: 20, fontWeight: 300, color: T.t2, marginTop: 16, letterSpacing: 1 }}>No photos yet</p>
        <p style={{ fontFamily: T.fb, fontSize: 12, color: T.t3, marginTop: 8, lineHeight: 1.6 }}>Complete a check-in with photos to generate your first AI Body Scan.</p>
      </div>
    );
  }

  /* ── Scanning state ── */
  if (scanning) {
    return (
      <div style={{ animation: 'fadeUp .4s ease both', textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <div style={{ width: 80, height: 80, border: '2px solid rgba(201,168,76,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Enso size={32} />
          </div>
          <div style={{ position: 'absolute', inset: -4, border: '2px solid transparent', borderTopColor: T.gold, borderRadius: '50%', animation: 'spin 2s linear infinite' }} />
        </div>
        <p style={{ fontFamily: T.fd, fontSize: 20, fontWeight: 300, color: T.t1, marginTop: 20, letterSpacing: 1 }}>Scanning</p>
        <p style={{ fontFamily: T.fm, fontSize: 11, color: T.t3, marginTop: 6 }}>Analyzing body composition across all regions...</p>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          {['Estimating fat distribution', 'Mapping lean mass', 'Calculating visceral fat', 'Assessing symmetry'].map((step, i) => (
            <span key={i} style={{ fontSize: 9, padding: '3px 8px', borderRadius: 4, background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.12)', color: T.gold, fontFamily: T.fm, animation: `fadeUp .4s ease ${0.5 + i * 0.3}s both` }}>{step}</span>
          ))}
        </div>
        <button onClick={cancelScan} style={{ ...S.newVialBtn, marginTop: 24, fontSize: 11 }}>Cancel</button>
      </div>
    );
  }

  /* ── Report view ── */
  if (scanData) {
    const d = scanData;
    const fatPct = d.totalBodyFatPct || 0;
    const leanLbs = d.totalLeanMassLbs || 0;
    const fatLbs = d.totalFatMassLbs || 0;
    const bonePct = d.boneMineralPct || 3.2;
    const totalWeight = leanLbs + fatLbs;
    const leanPct = totalWeight > 0 ? (leanLbs / totalWeight * 100) : 100 - fatPct - bonePct;
    const regions = d.regions || {};

    const regionNames = {
      leftArm: 'Left Arm', rightArm: 'Right Arm', chest: 'Chest',
      upperAbs: 'Upper Abs', lowerAbs: 'Lower Abs', obliques: 'Obliques',
      upperBack: 'Upper Back', lowerBack: 'Lower Back', glutes: 'Glutes',
      leftLeg: 'Left Leg', rightLeg: 'Right Leg',
    };

    // Determine best and worst regions
    const regionEntries = Object.entries(regions).filter(([, v]) => v && v.fatPct != null);
    const bestRegion = regionEntries.reduce((best, [k, v]) => (!best || v.fatPct < best[1].fatPct) ? [k, v] : best, null);
    const worstRegion = regionEntries.reduce((worst, [k, v]) => (!worst || v.fatPct > worst[1].fatPct) ? [k, v] : worst, null);

    return (
      <div style={{ animation: 'fadeUp .5s ease both' }}>
        {/* Report header */}
        <FadeIn delay={0}>
          <div style={{ textAlign: 'center', padding: '4px 0 16px' }}>
            <div style={{ fontSize: 8, letterSpacing: 3, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm, marginBottom: 6 }}>AI BODY SCAN</div>
            <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm }}>
              {selected?.date || 'Unknown'} {'\u00B7'} Day {selected?.day || '?'} {'\u00B7'} {selected?.weight || '?'} lbs
            </div>
          </div>
        </FadeIn>

        {/* Hero: Body Map + Total Composition */}
        <FadeIn delay={0.1}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-start' }}>
            {/* Body Map */}
            <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'center' }}>
              <BodyMap regions={regions} size={140} />
            </div>

            {/* Composition summary */}
            <div style={{ flex: 1, paddingTop: 8 }}>
              <Ring value={fatPct} max={50} color={fatPctToColor(fatPct)} size={72} label="Body Fat" />
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>Lean Mass</span>
                  <span style={{ fontSize: 11, color: T.teal, fontFamily: T.fm, fontWeight: 600 }}>{leanLbs} lbs</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>Fat Mass</span>
                  <span style={{ fontSize: 11, color: T.gold, fontFamily: T.fm, fontWeight: 600 }}>{fatLbs} lbs</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>Metabolic Age</span>
                  <span style={{ fontSize: 11, color: (d.metabolicAge || 0) <= (parseInt(profile?.age) || 30) ? T.teal : T.amber, fontFamily: T.fm, fontWeight: 600 }}>{d.metabolicAge || '--'}</span>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Composition Bar */}
        <FadeIn delay={0.2}>
          <div style={{ background: 'rgba(255,255,255,0.015)', border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 10 }}>BODY COMPOSITION</div>
            <CompositionBar fatPct={fatPct} leanPct={100 - fatPct - bonePct} bonePct={bonePct} />
          </div>
        </FadeIn>

        {/* Key Finding */}
        {d.keyFinding && (
          <FadeIn delay={0.25}>
            <div style={{ position: 'relative', padding: '14px 16px', marginBottom: 14, background: 'rgba(201,168,76,0.03)', borderRadius: 12, borderLeft: `3px solid ${T.gold}` }}>
              <p style={{ fontSize: 13, color: T.gold, fontFamily: T.fd, lineHeight: 1.6, margin: 0, fontWeight: 400, fontStyle: 'italic' }}>{d.keyFinding}</p>
            </div>
          </FadeIn>
        )}

        {/* Compared to Last */}
        {d.comparedToLast && d.comparedToLast !== 'Baseline scan established.' && (
          <FadeIn delay={0.3}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', marginBottom: 14, background: 'linear-gradient(135deg, rgba(201,168,76,0.04), rgba(0,210,180,0.03))', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12 }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{'\u0394'}</span>
              <p style={{ fontSize: 12, color: T.t1, fontFamily: T.fb, lineHeight: 1.55, fontWeight: 400, margin: 0 }}>{d.comparedToLast}</p>
            </div>
          </FadeIn>
        )}

        {/* Visceral Fat + A/G Ratio + Symmetry */}
        <FadeIn delay={0.35}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
            <div style={{ background: T.card || 'rgba(255,255,255,0.015)', border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 4 }}>Visceral</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: (d.visceralFatArea || 0) < 100 ? T.teal : (d.visceralFatArea || 0) < 160 ? T.gold : T.red, fontFamily: T.fm }}>{d.visceralFatArea || '--'}</div>
              <div style={{ fontSize: 8, color: T.t3, fontFamily: T.fm }}>cm{'\u00B2'}</div>
            </div>
            <div style={{ background: T.card || 'rgba(255,255,255,0.015)', border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 4 }}>A/G Ratio</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: (d.agRatio || 0) <= 1.0 ? T.teal : (d.agRatio || 0) <= 1.3 ? T.gold : T.red, fontFamily: T.fm }}>{d.agRatio || '--'}</div>
              <div style={{ fontSize: 8, color: T.t3, fontFamily: T.fm }}>{(d.agRatio || 0) <= 1.0 ? 'gynoid' : 'android'}</div>
            </div>
            <div style={{ background: T.card || 'rgba(255,255,255,0.015)', border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 4 }}>Symmetry</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: (d.symmetryScore || 0) >= 8 ? T.teal : (d.symmetryScore || 0) >= 6 ? T.gold : T.amber, fontFamily: T.fm }}>{d.symmetryScore || '--'}</div>
              <div style={{ fontSize: 8, color: T.t3, fontFamily: T.fm }}>/ 10</div>
            </div>
          </div>
        </FadeIn>

        {/* Regional Breakdown */}
        <FadeIn delay={0.4}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 8 }}>REGIONAL BREAKDOWN</div>

            {/* Best/Worst callout */}
            {bestRegion && worstRegion && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <div style={{ flex: 1, padding: '8px 10px', background: 'rgba(0,210,180,0.03)', border: '1px solid rgba(0,210,180,0.12)', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 8, color: T.t3, fontFamily: T.fm, letterSpacing: 1, textTransform: 'uppercase' }}>Leanest</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.teal, fontFamily: T.fb, marginTop: 2 }}>{regionNames[bestRegion[0]]}</div>
                  <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>{bestRegion[1].fatPct}%</div>
                </div>
                <div style={{ flex: 1, padding: '8px 10px', background: 'rgba(201,168,76,0.03)', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 8, color: T.t3, fontFamily: T.fm, letterSpacing: 1, textTransform: 'uppercase' }}>Focus Area</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.gold, fontFamily: T.fb, marginTop: 2 }}>{regionNames[worstRegion[0]]}</div>
                  <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>{worstRegion[1].fatPct}%</div>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {Object.entries(regionNames).map(([key, name]) => (
                <RegionCard key={key} name={name} data={regions[key]} />
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Android vs Gynoid detail */}
        <FadeIn delay={0.45}>
          <div style={{ background: 'rgba(255,255,255,0.015)', border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 10 }}>FAT DISTRIBUTION</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: T.t2, fontFamily: T.fm }}>Android (trunk)</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.gold, fontFamily: T.fm }}>{d.androidFatPct || '--'}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: Math.min((d.androidFatPct || 0) / 40 * 100, 100) + '%', borderRadius: 3, background: 'rgba(201,168,76,0.6)', transition: 'width 0.8s ease' }} />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: T.t2, fontFamily: T.fm }}>Gynoid (hip/thigh)</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.teal, fontFamily: T.fm }}>{d.gynoidFatPct || '--'}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: Math.min((d.gynoidFatPct || 0) / 40 * 100, 100) + '%', borderRadius: 3, background: 'rgba(0,210,180,0.5)', transition: 'width 0.8s ease' }} />
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>Distribution: </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.t1, fontFamily: T.fm }}>{d.bodyType || 'Mixed'}</span>
              <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}> {'\u00B7'} Muscle density: </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.t1, fontFamily: T.fm }}>{d.muscleDensityRating || '--'}</span>
            </div>
          </div>
        </FadeIn>

        {/* Recommendations */}
        {Array.isArray(d.recommendations) && d.recommendations.length > 0 && (
          <FadeIn delay={0.5}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 8 }}>RECOMMENDATIONS</div>
              {d.recommendations.map((rec, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', marginBottom: 6, background: 'rgba(201,168,76,0.025)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.gold, flexShrink: 0, marginTop: 5, boxShadow: `0 0 6px ${T.gold}` }} />
                  <span style={{ fontSize: 12, color: T.t2, fontFamily: T.fb, lineHeight: 1.55 }}>{rec}</span>
                </div>
              ))}
            </div>
          </FadeIn>
        )}

        {/* Disclaimer */}
        <FadeIn delay={0.55}>
          <div style={{ padding: '10px 12px', marginBottom: 14, background: 'rgba(255,255,255,0.01)', border: `1px solid ${T.border}`, borderRadius: 8 }}>
            <p style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, lineHeight: 1.6, margin: 0, textAlign: 'center' }}>
              AI-estimated body composition from photos. Not a medical device. Results are approximations and should not replace clinical DEXA scans for medical decisions.
            </p>
          </div>
        </FadeIn>

        {/* Actions */}
        <FadeIn delay={0.6}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setScanData(null); setSelectedId(null); }} style={{ ...S.newVialBtn, flex: 1, padding: '12px', textAlign: 'center', fontSize: 11 }}>Back</button>
            <button onClick={() => runScan(selected)} style={{ ...S.logBtn, flex: 1, padding: '12px', textAlign: 'center', fontSize: 11 }}>Rescan</button>
          </div>
        </FadeIn>
      </div>
    );
  }

  /* ── Select check-in to scan ── */
  return (
    <div style={{ animation: 'fadeUp .5s ease both' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 8, letterSpacing: 3, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm, marginBottom: 6 }}>AI BODY SCAN</div>
        <p style={{ fontFamily: T.fd, fontSize: 20, fontWeight: 300, color: T.t1, letterSpacing: 1, margin: '0 0 6px' }}>Select a check-in to scan</p>
        <p style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, lineHeight: 1.6 }}>Generate a DEXA-style body composition report from your progress photos.</p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 12, background: 'rgba(220,80,80,0.06)', border: '1px solid rgba(220,80,80,0.2)', borderRadius: 10 }}>
          <p style={{ fontSize: 12, color: 'rgba(220,80,80,0.85)', fontFamily: T.fm, margin: 0 }}>{error}</p>
        </div>
      )}

      {sorted.map((ci, idx) => {
        const hasScan = !!ci.dexaScan;
        const isLatest = idx === 0;
        return (
          <div key={ci.id} style={{
            ...S.card, padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
            borderColor: isLatest ? 'rgba(201,168,76,0.15)' : T.border,
            background: isLatest ? 'rgba(201,168,76,0.02)' : undefined,
          }}
            onClick={() => {
              if (hasScan) { setSelectedId(ci.id); setScanData(ci.dexaScan); }
              else { setSelectedId(ci.id); runScan(ci); }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.t1, fontFamily: T.fb }}>Day {ci.day || '?'}</div>
                <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>
                  {ci.date} {'\u00B7'} {ci.weight} lbs {'\u00B7'} {ci.waist}"
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {hasScan && (
                  <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 4, background: 'rgba(92,184,112,0.1)', color: '#5cb870', fontFamily: T.fm }}>Scanned</span>
                )}
                {ci.thumbFront && (
                  <img src={'data:image/jpeg;base64,' + ci.thumbFront} alt="" style={{ width: 32, height: 42, objectFit: 'cover', borderRadius: 6, border: `1px solid ${T.border}` }} />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
