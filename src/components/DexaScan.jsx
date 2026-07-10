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
import { deriveScanMetrics, heightInches } from '../utils/bodyComp';
import { AI_MODEL } from '../utils/ai';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DEXA ANALYSIS PROMPT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const DEXA_PROMPT = `You are Samsara's AI Body Scan engine — a clinical-grade visual body composition reader. You estimate regional and total body fat from physique photos with the objectivity of a trained DEXA technician reading a scan.

You will report your estimates by calling the report_scan tool. Estimate ONLY what the photos let you see. Every derived number (BMI, FFMI, RMR, lean/fat mass in pounds, android/gynoid ratio, visceral area, metabolic age, percentile) is computed downstream from your visual estimates plus the subject's known weight, waist, height, sex, and age — so do NOT compute or return those. Your job is the part only a human eye can do: read fat levels off the image.

═══ WHAT TO ESTIMATE ═══
- totalBodyFatPct: single best estimate to the nearest 0.5%.
- regions: for each region visible, a fatPct and a relative leanLbs (soft lean tissue in that region — approximate, used only for proportion), a rating, and a confidence. Return only regions actually assessable; omit or mark low-confidence ones you can't see.
- symmetryReadable, bodyType, muscleDensityRating: qualitative reads.
- keyFinding / comparedToLast / recommendations: the narrative.

Region rating scale: "very lean" (<12% male / <20% female), "lean" (12-17% / 20-25%), "moderate" (17-23% / 25-31%), "elevated" (23-28% / 31-36%), "high" (>28% / >36%).
Region confidence: "high" if directly visible, "medium" if partially visible, "low" if inferred.

═══ BODY-FAT CALIBRATION ═══
MALE reference:
- 8-12%:  abs visible relaxed, arm vascularity, shoulder separation
- 12-17%: ab outline visible, minor softness below navel
- 17-23%: flat/slightly rounded midsection, little ab definition
- 23-28%: visible fat pad, no muscle separation
- 28%+:   round midsection, overhang
FEMALE reference runs ~8 percentage points higher for the same visual leanness (essential fat is higher): abs faintly visible ~16-20%, athletic ~21-24%, average ~25-31%, higher ~32%+.
Use the subject's stated biological sex for calibration.

═══ CONSISTENCY RULES (highest priority) ═══
- Assess ONLY what is visible. Protocol duration, compound names, goal, and age must NOT bias the fat estimate. The SAME photo must yield the SAME totalBodyFatPct whether it is day 1 or day 500.
- Prefer a precise single value over a wide hedge, but never claim precision the image doesn't support — lower your confidence instead.
- confidenceLevel: "high" if front+side (or more) with good lighting, "medium" if a single clear photo, "low" if poor quality/obstructed.
- If only a front photo is available, mark posterior regions low-confidence rather than inventing them.
- Report, don't editorialize. keyFinding names a specific visible finding, anchored to a region.`;

// Structured-output schema — the model is forced to call this tool,
// which guarantees a parseable object (no free-text JSON scraping).
// Numeric derived metrics are intentionally ABSENT: they're computed
// in code from these visual estimates via deriveScanMetrics().
const REGION_SCHEMA = {
  type: 'object',
  properties: {
    fatPct: { type: 'number' },
    leanLbs: { type: 'number' },
    rating: { type: 'string', enum: ['very lean', 'lean', 'moderate', 'elevated', 'high'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['fatPct', 'rating', 'confidence'],
};

const SCAN_TOOL = {
  name: 'report_scan',
  description: 'Report the visual body-composition estimates read from the photos.',
  input_schema: {
    type: 'object',
    properties: {
      totalBodyFatPct: { type: 'number', description: 'Best single estimate of whole-body fat %, to nearest 0.5.' },
      regions: {
        type: 'object',
        properties: {
          leftArm: REGION_SCHEMA, rightArm: REGION_SCHEMA, chest: REGION_SCHEMA,
          upperAbs: REGION_SCHEMA, lowerAbs: REGION_SCHEMA, obliques: REGION_SCHEMA,
          upperBack: REGION_SCHEMA, lowerBack: REGION_SCHEMA, glutes: REGION_SCHEMA,
          leftLeg: REGION_SCHEMA, rightLeg: REGION_SCHEMA,
        },
      },
      muscleDensityRating: { type: 'string', description: 'e.g. "below average", "average", "above average", "high".' },
      bodyType: { type: 'string', description: 'e.g. "ectomorph", "mesomorph-leaning", "endomorph-leaning".' },
      confidenceLevel: { type: 'string', enum: ['high', 'medium', 'low'] },
      keyFinding: { type: 'string', description: 'The single most significant visible composition finding, anchored to a region.' },
      comparedToLast: { type: 'string', description: "Comparison to previous scan if provided; else 'Baseline scan established.'" },
      recommendations: {
        type: 'object',
        properties: {
          training: { type: 'string' },
          nutrition: { type: 'string' },
          recovery: { type: 'string' },
          focus: { type: 'string' },
        },
      },
    },
    required: ['totalBodyFatPct', 'regions', 'confidenceLevel', 'keyFinding'],
  },
};

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

/** FFMI horizontal gauge with classification zones */
function FFMIGauge({ value }) {
  const v = parseFloat(value) || 0;
  // FFMI zones: <18 below avg, 18-20 avg, 20-22 above avg, 22-25 excellent, >25 elite
  const zones = [
    { label: 'Below', max: 18, color: 'rgba(220,80,80,0.6)' },
    { label: 'Average', max: 20, color: 'rgba(201,168,76,0.6)' },
    { label: 'Above Avg', max: 22, color: 'rgba(92,184,112,0.6)' },
    { label: 'Excellent', max: 25, color: 'rgba(0,210,180,0.7)' },
    { label: 'Elite', max: 30, color: 'rgba(150,120,220,0.7)' },
  ];
  const min = 15, max = 30;
  const pct = Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  const [animPct, setAnimPct] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnimPct(pct), 100); return () => clearTimeout(t); }, [pct]);

  const getZoneLabel = () => {
    if (v < 18) return 'Below Average';
    if (v < 20) return 'Average';
    if (v < 22) return 'Above Average';
    if (v < 25) return 'Excellent';
    return 'Elite';
  };
  const getZoneColor = () => {
    if (v < 18) return 'rgba(220,80,80,0.8)';
    if (v < 20) return 'rgba(201,168,76,0.8)';
    if (v < 22) return 'rgba(92,184,112,0.8)';
    if (v < 25) return 'rgba(0,210,180,0.9)';
    return 'rgba(150,120,220,0.9)';
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.015)', border: `1px solid rgba(255,255,255,0.05)`, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>FFMI</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: getZoneColor(), fontFamily: T.fm }}>{v.toFixed(1)}</span>
          <span style={{ fontSize: 9, color: getZoneColor(), fontFamily: T.fm }}>{getZoneLabel()}</span>
        </div>
      </div>
      <div style={{ position: 'relative', height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
        {zones.map((z, i) => {
          const prevMax = i === 0 ? min : zones[i - 1].max;
          const width = ((z.max - prevMax) / (max - min)) * 100;
          return <div key={i} style={{ width: width + '%', height: '100%', background: z.color, opacity: 0.3 }} />;
        })}
        <div style={{
          position: 'absolute', top: 0, left: 0, height: '100%', width: animPct + '%',
          background: `linear-gradient(90deg, rgba(220,80,80,0.7), rgba(201,168,76,0.7), rgba(0,210,180,0.8), rgba(150,120,220,0.8))`,
          borderRadius: 4, transition: 'width 1.2s cubic-bezier(.25,.8,.25,1)',
          boxShadow: `0 0 8px ${getZoneColor()}`,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {zones.map((z, i) => <span key={i} style={{ fontSize: 7, color: T.t3, fontFamily: T.fm }}>{z.label}</span>)}
      </div>
    </div>
  );
}

/** Percentile badge — circular badge showing population rank */
function PercentileBadge({ value, label }) {
  const v = parseInt(value) || 0;
  const color = v >= 80 ? T.teal : v >= 60 ? 'rgba(92,184,112,0.8)' : v >= 40 ? T.gold : 'rgba(220,80,80,0.7)';
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const dur = 1000; const start = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      setDisplay(Math.round(p * v));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [v]);

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto' }}>
        <svg width={56} height={56} viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={28} cy={28} r={24} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3" />
          <circle cx={28} cy={28} r={24} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 24} strokeDashoffset={2 * Math.PI * 24 * (1 - v / 100)}
            style={{ transition: 'stroke-dashoffset 1.2s ease', filter: `drop-shadow(0 0 4px ${color})` }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color, fontFamily: T.fm, lineHeight: 1 }}>{display}</span>
          <span style={{ fontSize: 7, color: T.t3, fontFamily: T.fm }}>%ile</span>
        </div>
      </div>
      {label && <div style={{ fontSize: 8, color: T.t3, fontFamily: T.fm, marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>}
    </div>
  );
}

/** Confidence indicator dot */
function ConfidenceDot({ level }) {
  const color = level === 'high' ? T.teal : level === 'medium' ? T.gold : 'rgba(220,80,80,0.7)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}` }} />
      <span style={{ fontSize: 8, color, fontFamily: T.fm, textTransform: 'uppercase', letterSpacing: 0.5 }}>{level || 'med'}</span>
    </span>
  );
}

/** Clinical metric card — used in the 2x3 grid */
function MetricCard({ label, value, unit, color, subtitle }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.015)', border: `1px solid rgba(255,255,255,0.05)`, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || T.t1, fontFamily: T.fm, lineHeight: 1 }}>{value}</div>
      {unit && <div style={{ fontSize: 8, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>{unit}</div>}
      {subtitle && <div style={{ fontSize: 7, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

/** Scan reveal animation — multi-phase scan line effect */
function ScanReveal({ children, onComplete }) {
  const [phase, setPhase] = useState(0); // 0=scanning, 1=revealing, 2=complete
  const [scanY, setScanY] = useState(0);

  useEffect(() => {
    // Phase 0: scan line sweeps down (1.5s)
    const scanDur = 1500;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min((now - start) / scanDur, 1);
      setScanY(p * 100);
      if (p < 1) { raf = requestAnimationFrame(tick); }
      else { setPhase(1); setTimeout(() => { setPhase(2); onComplete?.(); }, 400); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (phase === 2) return <>{children}</>;

  return (
    <div style={{ position: 'relative', minHeight: 200 }}>
      {/* Content with mask */}
      <div style={{
        opacity: phase === 1 ? 1 : 0.15,
        transition: 'opacity 0.4s ease',
        filter: phase === 0 ? 'blur(2px)' : 'none',
      }}>
        {children}
      </div>
      {/* Scan line */}
      {phase === 0 && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: scanY + '%',
          height: 2, background: `linear-gradient(90deg, transparent, ${T.gold}, transparent)`,
          boxShadow: `0 0 20px ${T.gold}, 0 0 40px rgba(201,168,76,0.3)`,
          transition: 'top 0.05s linear',
          zIndex: 2,
        }} />
      )}
    </div>
  );
}

/** Mini sparkline for scan history */
function ScanSparkline({ checkins, currentId }) {
  const scanned = (checkins || []).filter(c => c.dexaScan?.totalBodyFatPct).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (scanned.length < 2) return null;

  const values = scanned.map(c => c.dexaScan.totalBodyFatPct);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const w = 120, h = 32, px = w / (values.length - 1);

  const points = values.map((v, i) => `${i * px},${h - ((v - min) / (max - min)) * h}`).join(' ');
  const isCurrent = (c) => c.id === currentId;

  return (
    <div style={{ display: 'inline-block' }}>
      <svg width={w} height={h + 4} viewBox={`0 0 ${w} ${h + 4}`}>
        <polyline points={points} fill="none" stroke="rgba(201,168,76,0.3)" strokeWidth="1.5" />
        {scanned.map((c, i) => (
          <circle key={c.id} cx={i * px} cy={h - ((c.dexaScan.totalBodyFatPct - min) / (max - min)) * h}
            r={isCurrent(c) ? 3 : 1.5}
            fill={isCurrent(c) ? T.gold : 'rgba(201,168,76,0.5)'}
            stroke={isCurrent(c) ? T.gold : 'none'} strokeWidth={isCurrent(c) ? 1 : 0}
            style={isCurrent(c) ? { filter: `drop-shadow(0 0 4px ${T.gold})` } : {}} />
        ))}
      </svg>
      <div style={{ fontSize: 7, color: T.t3, fontFamily: T.fm, textAlign: 'center', marginTop: 1 }}>BF% TREND</div>
    </div>
  );
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

/** Region detail card — now with confidence indicator */
function RegionCard({ name, data, isWorst }) {
  if (!data) return null;
  const color = fatPctToColor(data.fatPct);
  const ratingLabel = data.rating || 'unknown';

  return (
    <div style={{
      padding: '10px 12px',
      background: isWorst ? 'rgba(201,168,76,0.02)' : 'rgba(255,255,255,0.015)',
      border: `1px solid ${isWorst ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.05)'}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 10,
      animation: isWorst ? 'pulseGlow 3s ease-in-out infinite' : undefined,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.t1, fontFamily: T.fb }}>{name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {data.confidence && <ConfidenceDot level={data.confidence} />}
          <span style={{ fontSize: 10, color, fontFamily: T.fm, fontWeight: 600 }}>{data.fatPct}%</span>
        </div>
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

const REC_ICONS = { training: '\u{1F3CB}', nutrition: '\u{1F34E}', recovery: '\u{1F6CC}', focus: '\u{1F3AF}' };
const REC_LABELS = { training: 'Training', nutrition: 'Nutrition', recovery: 'Recovery', focus: 'Priority Focus' };
const REC_COLORS = { training: T.teal, nutrition: 'rgba(92,184,112,0.8)', recovery: T.purple, focus: T.gold };

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MAIN COMPONENT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function DexaScan({ checkins, setCheckins, stack, profile }) {
  const [scanning, setScanning] = useState(false);
  const [scanData, setScanData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [freshScan, setFreshScan] = useState(false); // true when scan was just run (show reveal anim)
  const abortRef = useRef(null);

  // Find check-ins with photos
  const withPhotos = (checkins || []).filter(c => c.hasPhotos || c.thumbFront);
  const sorted = [...withPhotos].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const latestWithScan = sorted.find(c => c.dexaScan);
  const selected = selectedId ? sorted.find(c => c.id === selectedId) : sorted[0];

  // Auto-load saved scan data (no reveal animation for saved scans)
  useEffect(() => {
    if (!scanData && selected?.dexaScan) {
      setScanData(selected.dexaScan);
      setFreshScan(false);
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

      const sex = profile?.biologicalSex || 'male';
      const hIn = heightInches(profile);
      const payload = {
        model: AI_MODEL,
        max_tokens: 4500,
        temperature: 0, // reproducibility: same photo → same read
        system: DEXA_PROMPT,
        tools: [SCAN_TOOL],
        tool_choice: { type: 'tool', name: 'report_scan' },
        messages: [{
          role: 'user',
          content: [
            ...imageBlocks,
            { type: 'text', text: `Body scan request.\nWeight: ${checkin.weight} lbs. Waist: ${checkin.waist}".\nPhotos available: ${photoLabels.join(', ')} (${photoLabels.length}).\nBiological sex: ${sex}. Age: ${profile?.age || '30'}. Height: ${profile?.height ? (profile.height.feet + "'" + profile.height.inches + '"') : 'unknown'}.\n${prevContext}` },
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

      // Forced tool-use guarantees a structured block. Fall back to
      // legacy text-JSON scraping only if the tool block is absent.
      const toolBlock = (data.content || []).find(b => b.type === 'tool_use');
      let visual = toolBlock ? toolBlock.input : null;
      if (!visual) {
        const rawText = (data.content || []).map(i => i.text || '').join('');
        try {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          visual = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(rawText);
        } catch {
          throw new Error('Could not parse scan results. Try again.');
        }
      }

      if (visual.totalBodyFatPct == null || !visual.regions) {
        throw new Error('Incomplete scan data returned. Try again.');
      }

      // Compute all derived clinical metrics in code (exact, reproducible)
      // from the model's visual estimates + known ground truth.
      const derived = deriveScanMetrics(visual, {
        weightLbs: Number(checkin.weight) || null,
        waistIn: Number(checkin.waist) || null,
        heightIn: hIn,
        sex,
        age: profile?.age,
      });

      // Reconcile per-region lean mass so it sums to the computed total.
      const regions = { ...visual.regions };
      if (derived.totalLeanMassLbs) {
        const sumLean = Object.values(regions).reduce((s, r) => s + (r?.leanLbs || 0), 0);
        if (sumLean > 0) {
          const scale = derived.totalLeanMassLbs / sumLean;
          for (const k of Object.keys(regions)) {
            if (regions[k]?.leanLbs) regions[k] = { ...regions[k], leanLbs: Math.round(regions[k].leanLbs * scale * 10) / 10 };
          }
        }
      }

      const parsed = { ...visual, ...derived, regions, engineVersion: 4 };

      // Save scan data to check-in
      setScanData(parsed);
      setFreshScan(true);
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
      <div style={{ animation: 'fadeUp .5s ease both', textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ opacity: 0.12, margin: '0 auto 16px' }}>
          <BodyMap regions={{}} size={120} />
        </div>
        <p style={{ fontFamily: T.fd, fontSize: 22, fontWeight: 300, color: T.t2, letterSpacing: 1, margin: '0 0 8px' }}>No photos yet</p>
        <p style={{ fontFamily: T.fb, fontSize: 12, color: T.t3, lineHeight: 1.6, margin: '0 0 16px', maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}>
          Complete a check-in with photos to generate your first AI Body Scan.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
          {['Regional fat mapping', 'FFMI analysis', 'Population percentile', 'RMR calculation', 'Symmetry score'].map((feat, i) => (
            <span key={i} style={{
              fontSize: 8, padding: '3px 8px', borderRadius: 4,
              background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)',
              color: T.gold, fontFamily: T.fm, letterSpacing: 0.5,
              animation: `fadeUp .3s ease ${0.2 + i * 0.1}s both`,
            }}>{feat}</span>
          ))}
        </div>
      </div>
    );
  }

  /* ── Scanning state ── */
  if (scanning) {
    const SCAN_STEPS = [
      { label: 'Reading photo data', icon: '\u{1F4F7}' },
      { label: 'Mapping regional fat', icon: '\u{1F9EC}' },
      { label: 'Estimating lean mass', icon: '\u{1F4AA}' },
      { label: 'Calculating FFMI & BMI', icon: '\u{1F4CA}' },
      { label: 'Assessing visceral fat', icon: '\u{1FA7A}' },
      { label: 'Computing RMR', icon: '\u{1F525}' },
      { label: 'Ranking vs population', icon: '\u{1F3C6}' },
      { label: 'Generating report', icon: '\u{1F4CB}' },
    ];
    return (
      <div style={{ animation: 'fadeUp .4s ease both', textAlign: 'center', padding: '40px 20px' }}>
        {/* Scanning silhouette with sweep */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
          <div style={{ opacity: 0.15 }}>
            <BodyMap regions={{}} size={100} />
          </div>
          {/* Scan line sweeping */}
          <div style={{
            position: 'absolute', left: -8, right: -8, height: 2,
            background: `linear-gradient(90deg, transparent, ${T.gold}, transparent)`,
            boxShadow: `0 0 16px ${T.gold}, 0 0 32px rgba(201,168,76,0.2)`,
            animation: 'scanSweep 2.5s ease-in-out infinite',
            top: 0,
          }} />
          {/* Outer ring */}
          <div style={{ position: 'absolute', inset: -12, border: '1px solid rgba(201,168,76,0.08)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', inset: -12, border: '2px solid transparent', borderTopColor: T.gold, borderRadius: '50%', animation: 'spin 3s linear infinite' }} />
        </div>

        <p style={{ fontFamily: T.fd, fontSize: 22, fontWeight: 300, color: T.t1, letterSpacing: 2, margin: '0 0 4px' }}>Scanning</p>
        <p style={{ fontFamily: T.fm, fontSize: 10, color: T.t3, margin: '0 0 20px' }}>Full-spectrum body composition analysis</p>

        {/* Progressive step indicators */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 240, margin: '0 auto' }}>
          {SCAN_STEPS.map((step, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
              borderRadius: 6,
              background: 'rgba(201,168,76,0.02)',
              border: '1px solid rgba(201,168,76,0.06)',
              animation: `fadeUp .3s ease ${0.3 + i * 0.4}s both`,
            }}>
              <span style={{ fontSize: 12, flexShrink: 0, width: 18, textAlign: 'center' }}>{step.icon}</span>
              <span style={{ fontSize: 9, color: T.gold, fontFamily: T.fm, opacity: 0.8 }}>{step.label}</span>
              <span style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: T.gold, animation: `pulse 1.5s ease ${0.3 + i * 0.4}s infinite`, flexShrink: 0 }} />
            </div>
          ))}
        </div>

        <button onClick={cancelScan} style={{ ...S.newVialBtn, marginTop: 20, fontSize: 11, maxWidth: 120, margin: '20px auto 0' }}>Cancel</button>
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
    const worstKey = worstRegion ? worstRegion[0] : null;

    // Support both old (array) and new (object) recommendation formats
    const recs = d.recommendations || {};
    const recsIsArray = Array.isArray(recs);

    const reportContent = (
      <div>
        {/* ── HEADER ── */}
        <FadeIn delay={0}>
          <div style={{ textAlign: 'center', padding: '4px 0 12px' }}>
            <div style={{ fontSize: 8, letterSpacing: 3, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm, marginBottom: 4 }}>AI BODY SCAN</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: 9, color: T.t3, fontFamily: T.fm }}>
                {selected?.date || 'Unknown'} {'\u00B7'} {selected?.weight || '?'} lbs
              </span>
              {d.confidenceLevel && <ConfidenceDot level={d.confidenceLevel} />}
            </div>
          </div>
        </FadeIn>

        {/* ── HERO: Body Map + Ring + Sparkline + Percentile ── */}
        <FadeIn delay={0.1}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
            {/* Body Map */}
            <div style={{ flex: '0 0 auto' }}>
              <BodyMap regions={regions} size={130} />
            </div>

            {/* Right column: ring, percentile, sparkline */}
            <div style={{ flex: 1, paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Ring value={fatPct} max={50} color={fatPctToColor(fatPct)} size={68} label="Body Fat" />
                {d.populationPercentile != null && (
                  <PercentileBadge value={d.populationPercentile} label="Pop. Rank" />
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>Lean</span>
                  <span style={{ fontSize: 11, color: T.teal, fontFamily: T.fm, fontWeight: 600 }}>{leanLbs} lbs</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>Fat</span>
                  <span style={{ fontSize: 11, color: T.gold, fontFamily: T.fm, fontWeight: 600 }}>{fatLbs} lbs</span>
                </div>
              </div>
              <ScanSparkline checkins={sorted} currentId={selected?.id} />
            </div>
          </div>
        </FadeIn>

        {/* ── FFMI GAUGE ── */}
        {d.ffmi > 0 && (
          <FadeIn delay={0.15}>
            <div style={{ marginBottom: 14 }}>
              <FFMIGauge value={d.ffmi} />
            </div>
          </FadeIn>
        )}

        {/* ── KEY FINDING ── */}
        {d.keyFinding && (
          <FadeIn delay={0.2}>
            <div style={{ position: 'relative', padding: '14px 16px', marginBottom: 14, background: 'rgba(201,168,76,0.03)', borderRadius: 12, borderLeft: `3px solid ${T.gold}` }}>
              <p style={{ fontSize: 13, color: T.gold, fontFamily: T.fd, lineHeight: 1.6, margin: 0, fontWeight: 400, fontStyle: 'italic' }}>{d.keyFinding}</p>
            </div>
          </FadeIn>
        )}

        {/* ── COMPOSITION BAR ── */}
        <FadeIn delay={0.25}>
          <div style={{ background: 'rgba(255,255,255,0.015)', border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 10 }}>BODY COMPOSITION</div>
            <CompositionBar fatPct={fatPct} leanPct={100 - fatPct - bonePct} bonePct={bonePct} />
          </div>
        </FadeIn>

        {/* ── CLINICAL METRICS GRID (2x3) ── */}
        <FadeIn delay={0.3}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
            <MetricCard label="BMI" value={d.bmi || '--'} color={
              (d.bmi || 0) < 18.5 ? 'rgba(220,80,80,0.7)' : (d.bmi || 0) < 25 ? T.teal : (d.bmi || 0) < 30 ? T.gold : T.red
            } subtitle={(d.bmi || 0) < 18.5 ? 'under' : (d.bmi || 0) < 25 ? 'normal' : (d.bmi || 0) < 30 ? 'over' : 'obese'} />
            <MetricCard label="RMR" value={d.estimatedRMR || '--'} unit="kcal/day" color={T.teal} />
            <MetricCard label="Met. Age" value={d.metabolicAge || '--'} color={
              (d.metabolicAge || 99) <= (parseInt(profile?.age) || 30) ? T.teal : T.gold
            } subtitle={
              (d.metabolicAge || 99) <= (parseInt(profile?.age) || 30) ? 'younger' : 'older'
            } />
            <MetricCard label="Visceral" value={d.visceralFatArea || '--'} unit={'cm\u00B2'} color={
              (d.visceralFatArea || 0) < 100 ? T.teal : (d.visceralFatArea || 0) < 160 ? T.gold : T.red
            } subtitle={(d.visceralFatArea || 0) < 100 ? 'normal' : (d.visceralFatArea || 0) < 160 ? 'elevated' : 'high'} />
            <MetricCard label="A/G Ratio" value={d.agRatio || '--'} color={
              (d.agRatio || 0) <= 1.0 ? T.teal : (d.agRatio || 0) <= 1.3 ? T.gold : T.red
            } subtitle={(d.agRatio || 0) <= 1.0 ? 'gynoid' : 'android'} />
            <MetricCard label="Symmetry" value={d.symmetryScore || '--'} unit="/ 10" color={
              (d.symmetryScore || 0) >= 8 ? T.teal : (d.symmetryScore || 0) >= 6 ? T.gold : T.amber
            } />
          </div>
        </FadeIn>

        {/* ── COMPARED TO LAST ── */}
        {d.comparedToLast && d.comparedToLast !== 'Baseline scan established.' && (
          <FadeIn delay={0.35}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', marginBottom: 14, background: 'linear-gradient(135deg, rgba(201,168,76,0.04), rgba(0,210,180,0.03))', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12 }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{'\u0394'}</span>
              <p style={{ fontSize: 12, color: T.t1, fontFamily: T.fb, lineHeight: 1.55, fontWeight: 400, margin: 0 }}>{d.comparedToLast}</p>
            </div>
          </FadeIn>
        )}

        {/* ── FAT DISTRIBUTION ── */}
        <FadeIn delay={0.4}>
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
            {d.trunkToLimbFatRatio > 0 && (
              <div style={{ textAlign: 'center', marginTop: 10, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>Trunk:Limb {'\u2014'} <span style={{ fontWeight: 600, color: (d.trunkToLimbFatRatio || 0) > 1.3 ? T.gold : T.teal }}>{d.trunkToLimbFatRatio}</span></span>
                <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>Type: <span style={{ fontWeight: 600, color: T.t1 }}>{d.bodyType || 'Mixed'}</span></span>
                <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>Density: <span style={{ fontWeight: 600, color: T.t1 }}>{d.muscleDensityRating || '--'}</span></span>
              </div>
            )}
            {!d.trunkToLimbFatRatio && (
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>Distribution: </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: T.t1, fontFamily: T.fm }}>{d.bodyType || 'Mixed'}</span>
                <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}> {'\u00B7'} Muscle density: </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: T.t1, fontFamily: T.fm }}>{d.muscleDensityRating || '--'}</span>
              </div>
            )}
          </div>
        </FadeIn>

        {/* ── REGIONAL BREAKDOWN ── */}
        <FadeIn delay={0.45}>
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
                <RegionCard key={key} name={name} data={regions[key]} isWorst={key === worstKey} />
              ))}
            </div>
          </div>
        </FadeIn>

        {/* ── RECOMMENDATIONS (categorized or legacy array) ── */}
        <FadeIn delay={0.5}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 8 }}>RECOMMENDATIONS</div>
            {recsIsArray ? (
              /* Legacy array format */
              recs.map((rec, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', marginBottom: 6, background: 'rgba(201,168,76,0.025)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.gold, flexShrink: 0, marginTop: 5, boxShadow: `0 0 6px ${T.gold}` }} />
                  <span style={{ fontSize: 12, color: T.t2, fontFamily: T.fb, lineHeight: 1.55 }}>{rec}</span>
                </div>
              ))
            ) : (
              /* New categorized format */
              Object.entries(recs).filter(([, v]) => v).map(([cat, text]) => (
                <div key={cat} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', marginBottom: 6,
                  background: `${REC_COLORS[cat] || T.gold}08`,
                  border: `1px solid ${REC_COLORS[cat] || T.gold}18`,
                  borderRadius: 10,
                }}>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 28 }}>
                    <span style={{ fontSize: 14 }}>{REC_ICONS[cat] || '\u2022'}</span>
                    <span style={{ fontSize: 7, color: REC_COLORS[cat] || T.gold, fontFamily: T.fm, textTransform: 'uppercase', letterSpacing: 0.5 }}>{REC_LABELS[cat] || cat}</span>
                  </div>
                  <span style={{ fontSize: 12, color: T.t2, fontFamily: T.fb, lineHeight: 1.55 }}>{text}</span>
                </div>
              ))
            )}
          </div>
        </FadeIn>

        {/* ── CONFIDENCE NOTICE ── */}
        {d.confidenceLevel && d.confidenceLevel !== 'high' && (
          <FadeIn delay={0.52}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 10, background: 'rgba(201,168,76,0.03)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 8 }}>
              <ConfidenceDot level={d.confidenceLevel} />
              <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>
                {d.confidenceLevel === 'medium' ? 'Single-photo scan — add side/back photos for higher accuracy.' : 'Low quality input — results may be less accurate.'}
              </span>
            </div>
          </FadeIn>
        )}

        {/* ── DISCLAIMER ── */}
        <FadeIn delay={0.55}>
          <div style={{ padding: '10px 12px', marginBottom: 14, background: 'rgba(255,255,255,0.01)', border: `1px solid ${T.border}`, borderRadius: 8 }}>
            <p style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, lineHeight: 1.6, margin: 0, textAlign: 'center' }}>
              AI-estimated body composition from photos. Not a medical device. Results are approximations and should not replace clinical DEXA scans for medical decisions.
            </p>
          </div>
        </FadeIn>

        {/* ── ACTIONS ── */}
        <FadeIn delay={0.6}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setScanData(null); setSelectedId(null); }} style={{ ...S.newVialBtn, flex: 1, padding: '12px', textAlign: 'center', fontSize: 11 }}>Back</button>
            <button onClick={() => runScan(selected)} style={{ ...S.logBtn, flex: 1, padding: '12px', textAlign: 'center', fontSize: 11 }}>Rescan</button>
          </div>
        </FadeIn>
      </div>
    );

    return (
      <div style={{ animation: 'fadeUp .5s ease both' }}>
        {freshScan ? (
          <ScanReveal onComplete={() => setFreshScan(false)}>{reportContent}</ScanReveal>
        ) : (
          reportContent
        )}
      </div>
    );
  }

  /* ── Select check-in to scan ── */
  const scannedCount = sorted.filter(c => c.dexaScan).length;
  return (
    <div style={{ animation: 'fadeUp .5s ease both' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 8, letterSpacing: 3, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm, marginBottom: 6 }}>AI BODY SCAN</div>
        <p style={{ fontFamily: T.fd, fontSize: 22, fontWeight: 300, color: T.t1, letterSpacing: 1, margin: '0 0 6px' }}>Select a check-in</p>
        <p style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, lineHeight: 1.6, margin: 0 }}>
          DEXA-grade composition analysis with FFMI, percentile ranking, and clinical metrics.
        </p>
        {/* Stats bar */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.t1, fontFamily: T.fm }}>{sorted.length}</div>
            <div style={{ fontSize: 8, color: T.t3, fontFamily: T.fm, letterSpacing: 1, textTransform: 'uppercase' }}>Check-ins</div>
          </div>
          <div style={{ width: 1, background: T.border, alignSelf: 'stretch' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.teal, fontFamily: T.fm }}>{scannedCount}</div>
            <div style={{ fontSize: 8, color: T.t3, fontFamily: T.fm, letterSpacing: 1, textTransform: 'uppercase' }}>Scanned</div>
          </div>
          <div style={{ width: 1, background: T.border, alignSelf: 'stretch' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.gold, fontFamily: T.fm }}>{sorted.length - scannedCount}</div>
            <div style={{ fontSize: 8, color: T.t3, fontFamily: T.fm, letterSpacing: 1, textTransform: 'uppercase' }}>Pending</div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 12, background: 'rgba(220,80,80,0.06)', border: '1px solid rgba(220,80,80,0.2)', borderRadius: 10 }}>
          <p style={{ fontSize: 12, color: 'rgba(220,80,80,0.85)', fontFamily: T.fm, margin: 0 }}>{error}</p>
        </div>
      )}

      {sorted.map((ci, idx) => {
        const hasScan = !!ci.dexaScan;
        const isLatest = idx === 0;
        const scanBf = hasScan ? ci.dexaScan.totalBodyFatPct : null;
        return (
          <div key={ci.id} style={{
            ...S.card, padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
            borderColor: isLatest ? 'rgba(201,168,76,0.15)' : T.border,
            background: isLatest ? 'rgba(201,168,76,0.02)' : undefined,
            animation: `fadeUp .4s ease ${idx * 0.05}s both`,
          }}
            onClick={() => {
              if (hasScan) { setSelectedId(ci.id); setScanData(ci.dexaScan); setFreshScan(false); }
              else { setSelectedId(ci.id); runScan(ci); }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.t1, fontFamily: T.fb }}>Day {ci.day || '?'}</span>
                  {isLatest && <span style={{ fontSize: 7, padding: '2px 5px', borderRadius: 3, background: 'rgba(201,168,76,0.1)', color: T.gold, fontFamily: T.fm, letterSpacing: 0.5 }}>LATEST</span>}
                </div>
                <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>
                  {ci.date} {'\u00B7'} {ci.weight} lbs{ci.waist ? ` \u00B7 ${ci.waist}"` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {hasScan ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: fatPctToColor(scanBf), fontFamily: T.fm }}>{scanBf}%</div>
                    <div style={{ fontSize: 7, color: T.t3, fontFamily: T.fm }}>BF</div>
                  </div>
                ) : (
                  <span style={{ fontSize: 9, padding: '4px 10px', borderRadius: 6, background: T.goldS, border: `1px solid ${T.goldM}`, color: T.gold, fontFamily: T.fm, fontWeight: 600 }}>Scan</span>
                )}
                {ci.thumbFront && (
                  <img src={'data:image/jpeg;base64,' + ci.thumbFront} alt="" style={{ width: 32, height: 42, objectFit: 'cover', borderRadius: 6, border: `1px solid ${hasScan ? fatPctToColor(scanBf) : T.border}` }} />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
