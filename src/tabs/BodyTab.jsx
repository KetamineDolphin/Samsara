/* SAMSARA v4.0 - BodyTab: Timeline | Check-in | Insights | Compare
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Core AI-assisted body composition analysis module.
   Photo storage via IndexedDB, progress charts, before/after compare.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Chart, registerables } from 'chart.js';
import T from '../utils/tokens';
import S from '../utils/styles';
import { getToday, makeId } from '../utils/helpers';
import { SamsaraSymbol, Enso } from '../components/Shared';
// Pro gating removed — all features unlocked
import { AIDisclaimer } from '../components/Disclaimers';
import { savePhoto, getPhotosForCheckin } from '../hooks/useStorage';

Chart.register(...registerables);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CONSTANTS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const VIEWS = ['Timeline', 'Check-in', 'Insights', 'Compare'];
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const REQUEST_TIMEOUT = 90_000;
const PHOTO_SLOTS = [
  { key: 'front', label: 'Front Relaxed', required: true },
  { key: 'side',  label: 'Side Relaxed',  required: false },
  { key: 'back',  label: 'Back Relaxed',  required: false },
  { key: 'flex',  label: 'Front Flexed',  required: false },
];

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SYSTEM PROMPT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const ANALYSIS_PROMPT = `You are Samsara's body composition analyst - an expert-level physique assessor and peptide protocol advisor for users tracking peptide-assisted recomposition. You provide honest, precise, data-driven assessments and actionable peptide guidance. Never sugarcoat.

Analyze the uploaded photo(s) and return ONLY a valid JSON object. No markdown, no backticks, no explanation text - raw JSON only.

Required JSON schema:
{
  "bodyFatEstimate": "XX-XX%" (narrow 2% range, e.g. "18-20%"),
  "muscleStatus": "description of overall muscle preservation/growth",
  "lowerAbdomen": "specific assessment - fat pad thickness, linea alba visibility, skin fold quality",
  "upperAbdomen": "upper ab definition, serratus hints, rectus visibility",
  "obliques": "oblique definition, love handle status, V-taper contribution",
  "chest": "pec fullness, upper/lower split visibility, gyno check",
  "shoulders": "delt cap roundness, anterior/lateral/posterior balance, capped look",
  "arms": "bicep/tricep separation, vein visibility, forearm detail",
  "back": "lat spread, rhomboid detail, lower back fat - or 'not visible' if no back photo",
  "skinQuality": "note peptide-related changes: collagen improvement, injection site marks, bruising, redness, skin tightness, elasticity changes, any GH-related water retention signs",
  "vascularity": "specific veins visible, forearm/bicep/delt vascularity level (1-5 scale description)",
  "injectionSites": "visible injection marks, bruising, lipodystrophy, scar tissue - or 'none visible'",
  "waistEstimate": "estimated waist measurement based on visual",
  "keyObservation": "One powerful, specific sentence - the single most important finding. Not generic. Reference actual visible changes.",
  "comparedToLast": "Specific comparison if previous data provided. Mention exact areas of change. If first check-in, say 'Baseline established'",
  "rateScore": 7.3 (number with one decimal - precise, not rounded. 1-10 scale: 1-3=high body fat/low muscle, 4-5=average, 6-7=lean with muscle, 8-9=very lean/muscular, 9.5+=competition ready),
  "flags": ["array of concerns: injection site reactions, asymmetry, potential gyno, unusual water retention, skin issues worth monitoring"],
  "peptideRecommendations": [
    {
      "compound": "Exact compound name from library",
      "category": "compound category",
      "rationale": "1-2 sentences explaining WHY this compound would help based on what you SEE in the photos. Reference specific visual observations.",
      "priority": "high" | "medium" | "low",
      "alreadyInStack": false
    }
  ],
  "stackAssessment": "1-2 sentences evaluating the user's current stack relative to their visible physique and goals. Note what's working, what might be redundant, or what's missing. If stack is empty, say so and emphasize recommendations."
}

Peptide recommendation guidelines:
- Recommend 2-4 compounds based on VISUAL observations, not generic advice.
- Reference what you actually see: stubborn fat deposits → fat loss peptides, poor recovery signs → recovery peptides, skin quality issues → collagen/anti-aging peptides, low muscle mass → GH secretagogues, etc.
- Mark compounds already in the user's active stack with "alreadyInStack": true and note if dosing/timing might need adjustment.
- Consider synergies: if user runs a GHRH, recommend a compatible GHRP. If on GLP-1 agonists, note fat loss progress.
- Available compound categories: GH Secretagogue, Fat Loss, Recovery, Cognitive, Hormonal, Anti-Aging, Hormonal Support, Growth Hormone, Metabolic, Skin & Cosmetic, Bioregulators.
- Key compounds to consider by observation:
  * Stubborn abdominal fat → Tesamorelin (targets visceral fat), AOD-9604, Retatrutide, Semaglutide, Tirzepatide, 5-Amino-1MQ
  * Low muscle mass/poor fullness → Ipamorelin + CJC-1295 no DAC, IGF-1 LR3, Follistatin 344, HGH
  * Poor skin quality/elasticity → GHK-Cu, BPC-157, Glow Blend
  * Slow recovery/inflammation signs → BPC-157, TB-500, KPV, LL-37
  * Water retention/bloat → check if current GH stack is too aggressive, consider cycling protocol
  * Injection site reactions → BPC-157 for healing, rotate sites, consider TB-500
  * Signs of hormonal imbalance → Gonadorelin, Enclomiphene, HCG, Kisspeptin-10
  * Aging skin/overall anti-aging → Epithalon, NAD+, GHK-Cu, Thymosin Alpha-1, MOTS-c
- Priority levels: "high" = directly addresses a visible issue, "medium" = would complement current progress, "low" = nice-to-have optimization.

Assessment principles:
- Be brutally honest. Users want truth, not encouragement.
- Rate score must use decimals (7.3, not 7). Differentiate meaningfully between check-ins.
- keyObservation must be specific and visual - reference what you actually see, not platitudes.
- Note any visible peptide-related changes: GH-related water retention, collagen improvements, injection marks.
- When previous data is provided, focus comparedToLast on measurable visual deltas.
- Flag anything concerning: injection site reactions, unusual swelling, skin changes.
- If a flexed photo is provided, note muscle hardness, peak contraction quality, and compare relaxed vs flexed separation.
- peptideRecommendations must be grounded in visual evidence. Do not recommend compounds without tying them to something observable.`;

const LOADING_TIPS = [
  'Analyzing body composition...',
  'Assessing regional fat distribution...',
  'Comparing to previous check-in...',
  'Evaluating muscle preservation...',
  'Checking injection site quality...',
  'Generating regional assessment...',
  'Calculating rate score...',
  'Evaluating peptide recommendations...',
  'Assessing stack synergies...',
  'Finalizing analysis...',
];

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   UTILITY FUNCTIONS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function parseAnalysisJSON(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim();
  try { return JSON.parse(cleaned); } catch {}
  const mdMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch) { try { return JSON.parse(mdMatch[1].trim()); } catch {} }
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last > first) { try { return JSON.parse(cleaned.slice(first, last + 1)); } catch {} }
  const stripped = cleaned.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
  if (stripped.length > 2) { try { return JSON.parse(stripped); } catch {} }
  return null;
}

const POSITIVE_WORDS = ['visible', 'defined', 'improved', 'lean', 'separation', 'vascular', 'tighter', 'reduced', 'emerging', 'progress', 'sharper', 'clearer', 'developing', 'firmer', 'fuller', 'capped', 'striated', 'harder'];
const CONCERN_WORDS = ['bloated', 'swelling', 'gyno', 'asymmetr', 'reaction', 'bruising', 'redness', 'inflam', 'retention', 'soft', 'smooth', 'spill', 'puffy', 'holding', 'thicken', 'distend'];

function sentimentColor(text) {
  if (!text) return T.t1;
  const lower = text.toLowerCase();
  const pos = POSITIVE_WORDS.some(w => lower.includes(w));
  const neg = CONCERN_WORDS.some(w => lower.includes(w));
  if (pos && !neg) return T.teal;
  if (neg) return T.amber;
  return T.t1;
}

const scoreColor = (s) => {
  const n = parseFloat(s) || 0;
  if (n >= 9) return T.gold;
  if (n >= 7) return T.teal;
  if (n >= 5) return T.amber;
  return T.red;
};

function classifyError(resp, errText) {
  if (!resp) return { title: 'Network Error', detail: 'Could not reach the server. Check your connection and try again.', retryable: true };
  if (resp.status === 401) return { title: 'API Configuration Error', detail: 'The server API key is invalid or missing. Contact the app administrator.', retryable: false };
  if (resp.status === 429) return { title: 'Rate Limited', detail: 'Too many requests. Wait a moment and try again.', retryable: true };
  if (resp.status === 529) return { title: 'API Overloaded', detail: 'Anthropic servers are busy. Try again in a few seconds.', retryable: true };
  if (resp.status >= 500) return { title: 'Server Error (' + resp.status + ')', detail: 'Anthropic API issue. Usually resolves quickly.', retryable: true };
  return { title: 'API Error (' + resp.status + ')', detail: errText ? errText.slice(0, 200) : 'Unknown error', retryable: true };
}

function validatePhoto(file) {
  if (!file) return 'No file selected.';
  if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(jpe?g|png|webp|heic|heif)$/i)) return 'Unsupported file type. Use JPEG, PNG, WebP, or HEIC.';
  if (file.size > MAX_FILE_SIZE) return 'File too large (max 20 MB). Try a smaller photo or lower resolution.';
  return null;
}

function compressImage(file, maxDim) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) { const r = Math.min(maxDim / w, maxDim / h); w = Math.round(w * r); h = Math.round(h * r); }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', maxDim > 200 ? 0.85 : 0.6).split(',')[1]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function buildImageBlocks(photos) {
  const blocks = [];
  for (const key of ['front', 'side', 'back', 'flex']) {
    if (photos[key]) blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photos[key] } });
  }
  return blocks;
}

function createCheckin(stats, thumbs, analysis) {
  return {
    id: makeId(), date: stats.date,
    day: parseInt(stats.day) || 0,
    weight: parseFloat(stats.weight) || 0,
    waist: parseFloat(stats.waist) || 0,
    thumbFront: thumbs.front, thumbSide: thumbs.side,
    hasPhotos: !!(thumbs.front || thumbs.side || thumbs.back || thumbs.flex),
    analysis: analysis || { rateScore: 0, keyObservation: 'Manual entry' },
    timestamp: Date.now(),
  };
}

async function sendAnalysisRequest(payload, signal) {
  const controller = signal ? undefined : new AbortController();
  const activeSignal = signal || controller.signal;
  const timeoutId = setTimeout(() => { if (controller) controller.abort(); }, REQUEST_TIMEOUT);
  try {
    const resp = await fetch('/api/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: activeSignal,
    });
    clearTimeout(timeoutId);
    if (!resp.ok) { const errText = await resp.text().catch(() => ''); return { error: classifyError(resp, errText), resp }; }
    const data = await resp.json();
    const rawText = (data.content || []).map(i => i.text || '').join('');
    return { parsed: parseAnalysisJSON(rawText), rawText, resp };
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') return { error: { title: 'Request Cancelled', detail: 'Analysis was cancelled.', retryable: true } };
    return { error: classifyError(null, e.message) };
  }
}

/** Parse body fat midpoint from "XX-XX%" string */
function parseBFMidpoint(est) {
  if (!est || typeof est !== 'string') return null;
  const range = est.match(/(\d+(?:\.\d+)?)\s*[-]\s*(\d+(?:\.\d+)?)/);
  if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2;
  const num = parseFloat(est.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? null : num;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SUB-COMPONENTS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function AnimatedScore({ value, color }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    const target = parseFloat(value) || 0;
    const duration = 1200; const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start; const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(+(eased * target).toFixed(1));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);
  return <span style={{ fontSize: 42, fontWeight: 800, color, fontFamily: T.fm, lineHeight: 1 }}>{display}</span>;
}

/** Score ring — radial arc SVG with animated fill + centered score */
function ScoreRing({ value, color, size = 140 }) {
  const [progress, setProgress] = useState(0);
  const [displayVal, setDisplayVal] = useState(0);
  const rafRef = useRef(null);
  const target = parseFloat(value) || 0;
  const pct = target / 10;
  const r = (size - 16) / 2;
  const circumference = 2 * Math.PI * r;

  useEffect(() => {
    const duration = 1400; const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start; const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setProgress(eased * pct);
      setDisplayVal(+(eased * target).toFixed(1));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  const dashOffset = circumference * (1 - progress);
  const half = size / 2;

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle cx={half} cy={half} r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="8" />
        <circle cx={half} cy={half} r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.1s linear', filter: `drop-shadow(0 0 8px ${color})` }} />
      </svg>
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontSize: 36, fontWeight: 800, color, fontFamily: T.fm, lineHeight: 1 }}>{displayVal}</div>
        <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>/ 10</div>
      </div>
    </div>
  );
}

/** Staggered fade-up wrapper for analysis sections */
function FadeSection({ delay = 0, children }) {
  return (
    <div style={{ animation: `fadeUp .5s ease ${delay}s both` }}>
      {children}
    </div>
  );
}

function AnalysisLoader({ onCancel }) {
  const [tipIdx, setTipIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const tipInterval = setInterval(() => setTipIdx(i => (i + 1) % LOADING_TIPS.length), 2800);
    const timeInterval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { clearInterval(tipInterval); clearInterval(timeInterval); };
  }, []);
  return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <div style={{ animation: 'spin 2s linear infinite', display: 'inline-block' }}><SamsaraSymbol size={48} /></div>
      <p style={{ fontFamily: T.fb, fontSize: 13, color: T.t2, marginTop: 16, animation: 'pulse 1.5s ease infinite', minHeight: 20 }}>{LOADING_TIPS[tipIdx]}</p>
      <p style={{ fontFamily: T.fm, fontSize: 10, color: T.t3, marginTop: 8 }}>{elapsed}s {'\u00B7'} typically 10-15 seconds</p>
      {onCancel && <button onClick={onCancel} style={{ ...S.newVialBtn, marginTop: 16, padding: '8px 24px', display: 'inline-block', width: 'auto', fontSize: 11 }}>Cancel</button>}
    </div>
  );
}

function PhotoSlot({ slot, photo, thumb, compressing, onCapture, onRemove }) {
  const handleFile = (e) => { const file = e.target.files?.[0]; if (file) onCapture(slot.key, file); e.target.value = ''; };
  const hasPhoto = !!photo;
  const isCompressing = compressing === slot.key;
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ ...S.label, marginBottom: 6 }}>{slot.label}{slot.required ? ' *' : ''}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {thumb ? (
          <div onClick={() => onRemove(slot.key)} style={{ position: 'relative', cursor: 'pointer' }} title="Tap to remove">
            <img src={'data:image/jpeg;base64,' + thumb} alt={slot.label} style={{ width: 48, height: 64, objectFit: 'cover', borderRadius: 6, border: `2px solid ${T.goldM}` }} />
            <div style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: 'rgba(220,80,80,0.9)', color: '#fff', fontSize: 10, lineHeight: '16px', textAlign: 'center', fontFamily: T.fm, fontWeight: 700 }}>{'\u00D7'}</div>
          </div>
        ) : (
          <div style={{ width: 48, height: 64, borderRadius: 6, border: `1px dashed ${slot.required ? T.goldM : T.border}`, background: 'rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 18, color: T.t3 }}>{'\u{1F4F7}'}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, flex: 1 }}>
          <label style={{ ...S.logBtn, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, opacity: isCompressing ? 0.5 : 1, flex: 1, justifyContent: 'center', fontSize: 11 }}>
            {isCompressing ? 'Processing...' : hasPhoto ? '\u2713 Retake' : '\u{1F4F8} Camera'}
            <input type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} disabled={isCompressing} />
          </label>
          <label style={{ ...S.newVialBtn, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, opacity: isCompressing ? 0.5 : 1, flex: 1, justifyContent: 'center', fontSize: 11, textAlign: 'center' }}>
            {'\u{1F4C1}'} Upload
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={handleFile} style={{ display: 'none' }} disabled={isCompressing} />
          </label>
        </div>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CHART COMPONENTS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function ChartCard({ title, children, height = 180 }) {
  return (
    <div style={{ ...S.card, padding: '14px', marginBottom: 10 }}>
      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 10 }}>{title}</div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

function WeightWaistChart({ checkins, height = 180 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || checkins.length < 2) return;
    if (chartRef.current) chartRef.current.destroy();
    const sorted = [...checkins].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = sorted.map(c => c.date?.slice(5) || '');
    const weights = sorted.map(c => c.weight);
    const waists = sorted.map(c => c.waist);
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Weight (lbs)', data: weights, borderColor: 'rgba(0,210,180,0.8)', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3, borderWidth: 2, yAxisID: 'y' },
          { label: 'Waist (in)', data: waists, borderColor: 'rgba(201,168,76,0.8)', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3, borderWidth: 2, yAxisID: 'y1' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
        plugins: {
          legend: { display: true, labels: { color: T.t3, font: { family: 'DM Mono', size: 9 }, boxWidth: 12 } },
          tooltip: { backgroundColor: 'rgba(15,17,20,0.95)', borderColor: T.gold, borderWidth: 1, titleFont: { family: 'DM Mono' }, bodyFont: { family: 'DM Mono' } },
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: T.t3, font: { family: 'DM Mono', size: 9 }, maxRotation: 0 } },
          y: { type: 'linear', position: 'left', grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: 'rgba(0,210,180,0.6)', font: { family: 'DM Mono', size: 9 } }, title: { display: true, text: 'lbs', color: 'rgba(0,210,180,0.4)', font: { family: 'DM Mono', size: 9 } } },
          y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { color: 'rgba(201,168,76,0.6)', font: { family: 'DM Mono', size: 9 } }, title: { display: true, text: 'in', color: 'rgba(201,168,76,0.4)', font: { family: 'DM Mono', size: 9 } } },
        },
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [checkins, height]);
  return <canvas ref={canvasRef} style={{ width: '100%', height }} />;
}

function ScoreChart({ checkins, height = 180 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || checkins.length < 1) return;
    if (chartRef.current) chartRef.current.destroy();
    const sorted = [...checkins].filter(c => c.analysis?.rateScore).sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sorted.length < 1) return;
    const labels = sorted.map(c => c.date?.slice(5) || '');
    const scores = sorted.map(c => parseFloat(c.analysis.rateScore) || 0);
    const colors = scores.map(s => s >= 9 ? 'rgba(255,215,0,0.7)' : s >= 7 ? 'rgba(0,210,180,0.7)' : s >= 5 ? 'rgba(201,168,76,0.7)' : 'rgba(220,80,80,0.7)');
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: { labels, datasets: [{ data: scores, backgroundColor: colors, borderRadius: 4, borderSkipped: false }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: 'rgba(15,17,20,0.95)', borderColor: T.gold, borderWidth: 1, titleFont: { family: 'DM Mono' }, bodyFont: { family: 'DM Mono' } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: T.t3, font: { family: 'DM Mono', size: 9 } } },
          y: { min: 0, max: 10, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: T.t3, font: { family: 'DM Mono', size: 10 } } },
        },
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [checkins, height]);
  return <canvas ref={canvasRef} style={{ width: '100%', height }} />;
}

function BodyFatChart({ checkins, height = 160 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    const sorted = [...checkins]
      .filter(c => c.analysis?.bodyFatEstimate)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const data = sorted.map(c => ({ label: c.date?.slice(5) || '', value: parseBFMidpoint(c.analysis.bodyFatEstimate) })).filter(d => d.value !== null);
    if (data.length < 2) return;
    const ctx = canvasRef.current.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(201,168,76,0.25)'); grad.addColorStop(1, 'transparent');
    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels: data.map(d => d.label), datasets: [{ data: data.map(d => d.value), borderColor: 'rgba(201,168,76,0.8)', backgroundColor: grad, fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: 'rgba(201,168,76,0.8)', borderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15,17,20,0.95)', borderColor: T.gold, borderWidth: 1, titleFont: { family: 'DM Mono' }, bodyFont: { family: 'DM Mono' }, callbacks: { label: (ctx) => ctx.parsed.y.toFixed(1) + '%' } } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: T.t3, font: { family: 'DM Mono', size: 9 }, maxRotation: 0 } },
          y: { reverse: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: T.t3, font: { family: 'DM Mono', size: 10 }, callback: v => v + '%' } },
        },
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [checkins, height]);
  return <canvas ref={canvasRef} style={{ width: '100%', height }} />;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MAIN COMPONENT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function BodyTab({
  checkins: rawCheckins, setCheckins, stack: rawStack, logs: rawLogs,
  subjective: rawSubjective, setSubjective,
  detectMilestones, calculateTrajectory, generateWeeklySummary, profile, onUpgrade
}) {
  const checkins = rawCheckins || [];
  const stack = rawStack || [];
  const logs = (rawLogs || []).map(l => l.compoundId ? l : { ...l, compoundId: l.cid });

  /* --- view state --- */
  const [activeView, setActiveView] = useState('Timeline');
  const [step, setStep] = useState(1);
  // Pre-fill stats from last checkin if available
  const lastCheckin = checkins.length > 0 ? checkins[checkins.length - 1] : null;
  const [stats, setStats] = useState(() => {
    const dayNum = lastCheckin ? String((parseInt(lastCheckin.day) || 0) + 7) : '';
    return { date: getToday(), day: dayNum, weight: '', waist: '' };
  });
  const hasLastStats = lastCheckin && lastCheckin.weight && lastCheckin.waist;
  const prefillFromLast = useCallback(() => {
    if (!lastCheckin) return;
    const dayNum = String((parseInt(lastCheckin.day) || 0) + 7);
    setStats({ date: getToday(), day: dayNum, weight: String(lastCheckin.weight), waist: String(lastCheckin.waist) });
  }, [lastCheckin]);
  const [photos, setPhotos] = useState({ front: null, side: null, back: null, flex: null });
  const [thumbs, setThumbs] = useState({ front: null, side: null, back: null, flex: null });
  const [compressing, setCompressing] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [parseWarning, setParseWarning] = useState(null);
  const [showAIDisclaimer, setShowAIDisclaimer] = useState(false);
  const [lastPayload, setLastPayload] = useState(null);
  const abortRef = useRef(null);
  const [expandedId, setExpandedId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ weight: '', waist: '', day: '' });

  /* --- compare state --- */
  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);
  const [comparePhotosA, setComparePhotosA] = useState(null);
  const [comparePhotosB, setComparePhotosB] = useState(null);
  const [compareSlot, setCompareSlot] = useState('front');
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  /* --- lightbox state --- */
  const [lightboxPhotos, setLightboxPhotos] = useState(null);

  /* --- insights state --- */
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(() => {
    try { const saved = localStorage.getItem('samsara_weekly'); return saved ? JSON.parse(saved) : null; } catch { return null; }
  });

  /* ============================================================
     PHOTO HANDLING + IndexedDB PERSISTENCE
     ============================================================ */

  const handlePhoto = useCallback(async (key, file) => {
    if (!file) return;
    const validationError = validatePhoto(file);
    if (validationError) { setError({ title: 'Invalid Photo', detail: validationError, retryable: false }); return; }
    setCompressing(key); setError(null);
    try {
      const [full, thumb] = await Promise.all([compressImage(file, 1024), compressImage(file, 120)]);
      setPhotos(p => ({ ...p, [key]: full }));
      setThumbs(p => ({ ...p, [key]: thumb }));
    } catch (err) {
      setError({ title: 'Compression Failed', detail: 'Could not process this photo: ' + (err.message || 'unknown error'), retryable: false });
    }
    setCompressing(null);
  }, []);

  const removePhoto = useCallback((key) => {
    setPhotos(p => ({ ...p, [key]: null }));
    setThumbs(p => ({ ...p, [key]: null }));
  }, []);

  /** Save photos to IndexedDB after checkin creation */
  const persistPhotos = useCallback(async (checkinId, currentPhotos) => {
    for (const slot of ['front', 'side', 'back', 'flex']) {
      if (currentPhotos[slot]) {
        await savePhoto(checkinId, slot, currentPhotos[slot]);
      }
    }
  }, []);

  /* ============================================================
     PROCESS ANALYSIS RESPONSE
     ============================================================ */

  const processAnalysisResponse = useCallback((result) => {
    const { parsed, rawText, error: apiError } = result;
    if (apiError) { setError(apiError); return null; }

    let finalAnalysis = null;
    if (parsed && parsed.rateScore != null) {
      finalAnalysis = parsed;
      setAnalysis(parsed);
    } else if (parsed) {
      finalAnalysis = { ...parsed, rateScore: parsed.rateScore || 0 };
      setAnalysis(finalAnalysis);
      setParseWarning('Analysis returned but some fields may be incomplete.');
    } else {
      setError({ title: 'Analysis Parse Failed', detail: 'AI returned a response but it could not be parsed. Your stats have been saved.', retryable: true });
      finalAnalysis = { rateScore: 0, keyObservation: 'Analysis parse failed - raw: ' + (rawText || '').slice(0, 100) };
    }

    const checkin = createCheckin(stats, thumbs, finalAnalysis);
    setCheckins(p => [...(p || []), checkin]);

    // Persist full-res photos to IndexedDB
    persistPhotos(checkin.id, photos);

    return checkin;
  }, [stats, thumbs, photos, setCheckins, persistPhotos]);

  /* ============================================================
     RUN / CANCEL / RETRY ANALYSIS
     ============================================================ */

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true); setError(null); setParseWarning(null); setStep(3);
    const prev = checkins.length > 0 ? checkins[checkins.length - 1] : null;
    const prevContext = prev
      ? `Previous check-in (Day ${prev.day || '?'}, ${prev.weight} lbs, ${prev.waist}" waist): ${JSON.stringify(prev.analysis || {})}`
      : 'First check-in - establish baseline.';
    const photoLabels = ['front', 'side', 'back', 'flex'].filter(k => photos[k]);
    const payload = {
      model: 'claude-sonnet-4-20250514', max_tokens: 2000, system: ANALYSIS_PROMPT,
      messages: [{ role: 'user', content: [
        ...buildImageBlocks(photos),
        { type: 'text', text: `Day ${stats.day || '?'}, ${stats.weight} lbs, ${stats.waist}" waist.\nPhotos: ${photoLabels.join(', ')} (${photoLabels.length}).\nActive peptide stack: ${stack.length > 0 ? stack.map(s => `${s.name} (${s.category || 'unknown'}, ${s.dose || '?'}${s.unit || 'mcg'} ${s.freq || s.frequency || 'daily'})`).join('; ') : 'none — recommend a starter protocol'}.\nGoal: ${profile?.primaryGoal || 'recomp'}. Bio sex: ${profile?.biologicalSex || 'unknown'}. Age: ${profile?.age || '?'}.\n${prevContext}` },
      ]}],
    };
    setLastPayload(payload);
    if (!navigator.onLine) {
      setError({ title: 'No Internet Connection', detail: 'Body analysis requires an internet connection to process your photos. Connect to Wi-Fi or cellular and try again.', retryable: true });
      setAnalyzing(false);
      return;
    }
    abortRef.current = new AbortController();
    const result = await sendAnalysisRequest(payload, abortRef.current.signal);
    processAnalysisResponse(result);
    abortRef.current = null;
    setAnalyzing(false);
  }, [photos, stats, stack, checkins, processAnalysisResponse]);

  // Gate analysis behind AIDisclaimer consent (skip if user has previous AI analyses)
  const hasConsentedBefore = checkins.some(c => c.analysis);
  const handleAnalyzeClick = useCallback(() => {
    if (hasConsentedBefore) {
      runAnalysis();
    } else {
      setShowAIDisclaimer(true);
    }
  }, [hasConsentedBefore, runAnalysis]);

  const handleDisclaimerProceed = useCallback(() => {
    setShowAIDisclaimer(false);
    runAnalysis();
  }, [runAnalysis]);

  const handleDisclaimerCancel = useCallback(() => {
    setShowAIDisclaimer(false);
  }, []);

  const cancelAnalysis = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setAnalyzing(false); setStep(2);
  }, []);

  const retryAnalysis = useCallback(async () => {
    if (!lastPayload) return;
    setAnalyzing(true); setError(null); setParseWarning(null);
    abortRef.current = new AbortController();
    const result = await sendAnalysisRequest(lastPayload, abortRef.current.signal);
    if (result.parsed) {
      const patched = { ...result.parsed, rateScore: result.parsed.rateScore || 0 };
      setAnalysis(patched);
      setCheckins(p => {
        const existing = [...(p || [])];
        const lastIdx = existing.length - 1;
        if (lastIdx >= 0 && existing[lastIdx].date === stats.date && existing[lastIdx].analysis?.rateScore === 0) {
          existing[lastIdx] = { ...existing[lastIdx], analysis: patched };
          return existing;
        }
        return p;
      });
      setError(null);
    } else if (result.error) { setError(result.error); }
    else { setError({ title: 'Parse Failed Again', detail: 'Retry also failed to parse.', retryable: false }); }
    abortRef.current = null; setAnalyzing(false);
  }, [lastPayload, stats.date, setCheckins]);

  const saveManual = useCallback(() => {
    const checkin = createCheckin(stats, thumbs, null);
    setCheckins(p => [...(p || []), checkin]);
    if (thumbs.front || thumbs.side) persistPhotos(checkin.id, photos);
    resetForm();
  }, [stats, thumbs, photos, setCheckins, persistPhotos]);

  const resetForm = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setActiveView('Timeline'); setStep(1);
    setStats({ date: getToday(), day: '', weight: '', waist: '' });
    setPhotos({ front: null, side: null, back: null, flex: null });
    setThumbs({ front: null, side: null, back: null, flex: null });
    setAnalysis(null); setError(null); setParseWarning(null); setLastPayload(null); setCompressing(null);
  }, []);

  /* ============================================================
     DELETE / EDIT CHECKINS
     ============================================================ */

  const handleDeleteCheckin = useCallback((id) => {
    if (confirmDeleteId === id) {
      setCheckins(p => (p || []).filter(c => c.id !== id));
      setConfirmDeleteId(null);
      setExpandedId(null);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 4000);
    }
  }, [confirmDeleteId, setCheckins]);

  const startEdit = useCallback((ci) => {
    setEditingId(ci.id);
    setEditData({ weight: String(ci.weight || ''), waist: String(ci.waist || ''), day: String(ci.day || '') });
  }, []);

  const saveEdit = useCallback(() => {
    setCheckins(p => (p || []).map(c => {
      if (c.id !== editingId) return c;
      return { ...c, weight: parseFloat(editData.weight) || c.weight, waist: parseFloat(editData.waist) || c.waist, day: parseInt(editData.day) || c.day };
    }));
    setEditingId(null);
  }, [editingId, editData, setCheckins]);

  /* ============================================================
     COMPARE - LOAD PHOTOS FROM IndexedDB
     ============================================================ */

  const loadComparePhotos = useCallback(async (checkinId, setter) => {
    setLoadingPhotos(true);
    try {
      const photos = await getPhotosForCheckin(checkinId);
      const map = {};
      photos.forEach(p => { map[p.slot] = p.data; });
      setter(map);
    } catch { setter(null); }
    setLoadingPhotos(false);
  }, []);

  useEffect(() => {
    if (compareA) loadComparePhotos(compareA, setComparePhotosA);
    else setComparePhotosA(null);
  }, [compareA, loadComparePhotos]);

  useEffect(() => {
    if (compareB) loadComparePhotos(compareB, setComparePhotosB);
    else setComparePhotosB(null);
  }, [compareB, loadComparePhotos]);

  /* ============================================================
     LIGHTBOX - LOAD FULL PHOTOS FROM IndexedDB
     ============================================================ */

  const openLightbox = useCallback(async (checkinId) => {
    const photos = await getPhotosForCheckin(checkinId);
    if (photos.length > 0) {
      const map = {};
      photos.forEach(p => { map[p.slot] = p.data; });
      setLightboxPhotos(map);
    }
  }, []);

  /* ============================================================
     INSIGHTS - WEEKLY SUMMARY
     ============================================================ */

  const handleGenerateSummary = useCallback(async () => {
    if (!generateWeeklySummary) return;
    setSummaryLoading(true);
    try {
      const result = await generateWeeklySummary(logs, checkins, stack);
      const payload = { summary: result.summary, date: result.date || getToday() };
      setSummaryData(payload);
      try { localStorage.setItem('samsara_weekly', JSON.stringify(payload)); } catch {}
    } catch {}
    setSummaryLoading(false);
  }, [generateWeeklySummary, logs, checkins, stack]);

  const isSunday = new Date().getDay() === 0;

  /* ============================================================
     SHARED STYLES + HELPERS
     ============================================================ */

  const goldCard = { background: 'rgba(201,168,76,0.025)', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 14, padding: '16px', marginBottom: 14 };
  const sectionLabel = { fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 8 };
  const statCard = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 10px', textAlign: 'center' };

  const REGION_FIELDS = [
    ['Body Fat', 'bodyFatEstimate'], ['Muscle Status', 'muscleStatus'],
    ['Lower Abdomen', 'lowerAbdomen'], ['Upper Abdomen', 'upperAbdomen'],
    ['Obliques', 'obliques'], ['Chest', 'chest'],
    ['Shoulders', 'shoulders'], ['Arms', 'arms'],
    ['Back', 'back'], ['Skin Quality', 'skinQuality'], ['Vascularity', 'vascularity'],
  ];

  const renderRegionalRows = (a, compact) => (
    REGION_FIELDS.map(([label, key]) => [label, a[key]]).filter(([, v]) => v && v !== 'not visible').map(([label, value]) => (
      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: compact ? '6px 0' : '8px 0', borderBottom: `1px solid ${T.border}` }}>
        <span style={{ fontSize: compact ? 11 : 12, color: T.t3, fontFamily: T.fm, flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: compact ? 11 : 12, color: sentimentColor(value), fontFamily: T.fm, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
      </div>
    ))
  );

  /* ============================================================
     SEGMENTED CONTROL
     ============================================================ */

  const renderSegments = () => (
    <div style={{ ...S.segWrap, overflowX: 'auto' }}>
      {VIEWS.map(v => (
        <button key={v} onClick={() => { setActiveView(v); if (v === 'Check-in') setStep(1); }}
          style={{ ...S.segBtn, ...(activeView === v ? S.segOn : {}), whiteSpace: 'nowrap', minWidth: 0 }}
        >{v}</button>
      ))}
    </div>
  );

  /* ============================================================
     TIMELINE VIEW
     ============================================================ */

  const renderTimeline = () => {
    const trajectory = checkins.length >= 5 && calculateTrajectory ? calculateTrajectory(checkins, profile?.targetWeight || 170, profile?.targetWaist || 26) : null;
    const showTrajectory = trajectory && (trajectory.daysToTargetWeight !== null || trajectory.daysToTargetWaist !== null);
    const milestones = detectMilestones ? detectMilestones(checkins) : [];
    const recentMilestones = milestones.slice(-3).reverse();

    return (
      <div style={{ animation: 'fadeUp .5s ease both' }}>
        {showTrajectory && (
          <div style={goldCard}>
            <div style={sectionLabel}>Projected trajectory</div>
            {trajectory.daysToTargetWeight !== null && (
              <p style={{ fontSize: 13, color: T.t1, fontFamily: T.fb, lineHeight: 1.5, marginBottom: 4 }}>
                At current rate: <span style={{ color: T.gold, fontWeight: 600, fontFamily: T.fm }}>{trajectory.projectedWeightDate}</span>
                <span style={{ color: T.t3, fontSize: 11 }}> ({trajectory.daysToTargetWeight} days)</span>
              </p>
            )}
            {trajectory.daysToTargetWaist !== null && (
              <p style={{ fontSize: 13, color: T.t1, fontFamily: T.fb, lineHeight: 1.5 }}>
                Waist target: <span style={{ color: T.gold, fontWeight: 600, fontFamily: T.fm }}>{trajectory.projectedWaistDate}</span>
                <span style={{ color: T.t3, fontSize: 11 }}> ({trajectory.daysToTargetWaist} days)</span>
              </p>
            )}
            {trajectory.weightTrend !== null && (
              <p style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginTop: 6 }}>
                Trend: {trajectory.weightTrend > 0 ? '+' : ''}{trajectory.weightTrend} lbs/wk
                {trajectory.waistTrend !== null && ` | ${trajectory.waistTrend > 0 ? '+' : ''}${trajectory.waistTrend}"/wk`}
              </p>
            )}
          </div>
        )}

        {recentMilestones.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {recentMilestones.map((m, i) => (
              <div key={i} style={{ border: `1px solid ${T.goldM}`, borderRadius: 8, padding: '8px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: T.gold, fontFamily: T.fb, fontWeight: 500 }}>{m.label}</span>
                <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>{m.date}</span>
              </div>
            ))}
          </div>
        )}

        {/* Streak / Consistency Nudge */}
        {(() => {
          if (checkins.length === 0) return null;
          const sorted = [...checkins].sort((a, b) => new Date(b.date) - new Date(a.date));
          const lastDate = sorted[0]?.date;
          const daysSinceLast = lastDate ? Math.round((Date.now() - new Date(lastDate + 'T12:00:00').getTime()) / 86400000) : null;
          // Calculate weekly streak: how many consecutive 7-day windows have a checkin
          let streak = 0;
          if (sorted.length > 0) {
            const now = new Date();
            for (let w = 0; w < 52; w++) {
              const weekEnd = new Date(now.getTime() - w * 7 * 86400000);
              const weekStart = new Date(weekEnd.getTime() - 7 * 86400000);
              const hasCheckin = sorted.some(c => { const d = new Date(c.date + 'T12:00:00'); return d >= weekStart && d <= weekEnd; });
              if (hasCheckin) streak++;
              else break;
            }
          }
          if (daysSinceLast !== null && daysSinceLast >= 5) {
            return (
              <div style={{ border: `1px solid ${T.goldM}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, background: T.goldS, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>{'\u23F0'}</span>
                <div>
                  <p style={{ fontSize: 12, color: T.gold, fontFamily: T.fb, fontWeight: 500 }}>{daysSinceLast} days since last check-in</p>
                  <p style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>Consistent tracking drives better results. Tap Check-in to log today.</p>
                </div>
              </div>
            );
          }
          if (streak >= 2) {
            return (
              <div style={{ border: `1px solid rgba(0,210,180,0.2)`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, background: 'rgba(0,210,180,0.03)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>{'\uD83D\uDD25'}</span>
                <div>
                  <p style={{ fontSize: 12, color: T.teal, fontFamily: T.fb, fontWeight: 500 }}>{streak}-week streak</p>
                  <p style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>Consistent weekly check-ins. Keep it going.</p>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {checkins.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <SamsaraSymbol size={56} detail="full" />
            <p style={{ fontFamily: T.fd, fontSize: 20, fontWeight: 300, color: T.t2, marginTop: 16, letterSpacing: 1 }}>Begin the record</p>
            <p style={{ fontFamily: T.fb, fontSize: 12, color: T.t3, marginTop: 8 }}>Tap Check-in to begin</p>
          </div>
        ) : (
          <div>
            <div style={sectionLabel}>Timeline</div>
            {[...checkins].reverse().map((ci, idx) => {
              const isExpanded = expandedId === ci.id;
              const a = ci.analysis || {};
              const rate = parseFloat(a.rateScore) || 0;
              const isMostRecent = idx === 0;
              const photoW = isMostRecent ? 60 : 36;
              const photoH = isMostRecent ? 80 : 48;
              const reversedCheckins = [...checkins].reverse();
              const nextCi = reversedCheckins[idx + 1];
              const daysBetween = nextCi ? Math.round((new Date(ci.date) - new Date(nextCi.date)) / 86400000) : null;

              return (
                <div key={ci.id}>
                  {idx > 0 && daysBetween !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0' }}>
                      <div style={{ width: 1, height: 12, background: T.border }} />
                      <span style={{ fontSize: 8, color: T.t3, fontFamily: T.fm, letterSpacing: 1, margin: '0 6px' }}>{daysBetween}d</span>
                      <div style={{ width: 1, height: 12, background: T.border }} />
                    </div>
                  )}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : ci.id)}
                    onTouchStart={e => e.currentTarget.style.background = 'rgba(255,255,255,0.035)'}
                    onTouchEnd={e => e.currentTarget.style.background = ''}
                    style={{ ...S.trackRow, marginBottom: 0, borderColor: isExpanded ? T.goldM : T.border, ...(isMostRecent ? { borderLeft: `3px solid ${T.gold}` } : {}) }}
                  >
                    {ci.thumbFront && (
                      <img src={'data:image/jpeg;base64,' + ci.thumbFront} alt="" style={{ width: photoW, height: photoH, objectFit: 'cover', borderRadius: 6, border: `1px solid ${T.border}`, boxShadow: isMostRecent ? '0 2px 8px rgba(0,0,0,0.4)' : 'none' }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: T.t1, fontFamily: T.fb }}>Day {ci.day} {'\u00B7'} {ci.date}</div>
                      <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>{ci.weight} lbs {'\u00B7'} {ci.waist}" {'\u00B7'} {a.bodyFatEstimate || '-'}</div>
                      {a.keyObservation && a.keyObservation !== 'Manual entry' && !a.keyObservation.startsWith('Analysis parse failed') && (
                        <p style={{ fontSize: 11, color: T.gold, fontFamily: T.fb, marginTop: 4, lineHeight: 1.3 }}>{a.keyObservation}</p>
                      )}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: scoreColor(rate), fontFamily: T.fm }}>{rate || '-'}</span>
                  </div>

                  {isExpanded && (
                    <div style={{ background: 'rgba(201,168,76,0.02)', border: `1px solid ${T.goldM}`, borderTop: 'none', borderRadius: '0 0 11px 11px', padding: '12px 14px' }}>
                      {a.comparedToLast && a.comparedToLast !== 'First check-in' && a.comparedToLast !== 'Baseline established' && (
                        <p style={{ fontSize: 12, color: T.gold, fontFamily: T.fd, fontStyle: 'italic', lineHeight: 1.5, marginBottom: 10, fontWeight: 400 }}>{a.comparedToLast}</p>
                      )}
                      {renderRegionalRows(a, true)}
                      {a.injectionSites && a.injectionSites !== 'none visible' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
                          <span style={{ fontSize: 11, color: T.t3, fontFamily: T.fm }}>Injection Sites</span>
                          <span style={{ fontSize: 11, color: T.amber, fontFamily: T.fm, textAlign: 'right', maxWidth: '60%' }}>{a.injectionSites}</span>
                        </div>
                      )}
                      {Array.isArray(a.flags) && a.flags.length > 0 && (
                        <div style={{ marginTop: 8 }}>{a.flags.map((f, i) => <div key={i} style={{ ...S.warning, marginBottom: 4 }}>{'\u26A0'} {f}</div>)}</div>
                      )}
                      {a.stackAssessment && (
                        <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(0,210,180,0.04)', border: 'rgba(0,210,180,0.15)', borderRadius: 8 }}>
                          <span style={{ fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>Stack</span>
                          <p style={{ fontSize: 11, color: T.teal, fontFamily: T.fb, marginTop: 2, lineHeight: 1.4 }}>{a.stackAssessment}</p>
                        </div>
                      )}
                      {Array.isArray(a.peptideRecommendations) && a.peptideRecommendations.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <span style={{ fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>Recommendations</span>
                          {a.peptideRecommendations.map((rec, ri) => (
                            <div key={ri} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: ri < a.peptideRecommendations.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                              <span style={{ fontSize: 11, color: T.t1, fontFamily: T.fb, fontWeight: 500 }}>{rec.compound}{rec.alreadyInStack ? ' \u2713' : ''}</span>
                              <span style={{ fontSize: 9, color: rec.priority === 'high' ? T.gold : rec.priority === 'medium' ? T.teal : T.t3, fontFamily: T.fm, textTransform: 'uppercase', letterSpacing: 0.8 }}>{rec.priority}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {ci.hasPhotos && (
                        <button onClick={(e) => { e.stopPropagation(); openLightbox(ci.id); }}
                          style={{ ...S.newVialBtn, width: '100%', marginTop: 10, fontSize: 11, textAlign: 'center', padding: '8px' }}>
                          View Full Photos
                        </button>
                      )}
                      {/* Edit / Delete */}
                      {editingId === ci.id ? (
                        <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            {[['Day', 'day'], ['Weight', 'weight'], ['Waist', 'waist']].map(([l, k]) => (
                              <div key={k} style={{ flex: 1 }}>
                                <label style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, letterSpacing: 1 }}>{l}</label>
                                <input type="number" inputMode="decimal" value={editData[k]} onChange={e => setEditData(p => ({ ...p, [k]: e.target.value }))}
                                  style={{ ...S.input, width: '100%', padding: '6px 8px', fontSize: 12, marginTop: 2 }} />
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={(e) => { e.stopPropagation(); saveEdit(); }} style={{ ...S.logBtn, flex: 1, padding: '6px', fontSize: 11, textAlign: 'center' }}>Save</button>
                            <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} style={{ ...S.newVialBtn, flex: 1, padding: '6px', fontSize: 11, textAlign: 'center' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                          <button onClick={(e) => { e.stopPropagation(); startEdit(ci); }}
                            style={{ ...S.newVialBtn, flex: 1, fontSize: 10, padding: '6px', textAlign: 'center', color: T.t2 }}>
                            {'\u270E'} Edit
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteCheckin(ci.id); }}
                            style={{ ...S.newVialBtn, flex: 1, fontSize: 10, padding: '6px', textAlign: 'center', color: confirmDeleteId === ci.id ? 'rgba(220,80,80,0.9)' : T.t3, borderColor: confirmDeleteId === ci.id ? 'rgba(220,80,80,0.4)' : T.border }}>
                            {confirmDeleteId === ci.id ? '\u26A0 Confirm Delete' : '\u2715 Delete'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  /* ============================================================
     CHECK-IN VIEW
     ============================================================ */

  const renderCheckin = () => {
    const photoCount = ['front', 'side', 'back', 'flex'].filter(k => photos[k]).length;
    return (
      <div style={{ animation: 'fadeUp .4s ease both' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button onClick={() => { setActiveView('Timeline'); setStep(1); }} style={{ background: 'none', border: 'none', color: T.t2, fontFamily: T.fm, fontSize: 12, cursor: 'pointer' }}>{'\u2190'} Back</button>
          <span style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>Step {step} of 3</span>
        </div>

        {step === 1 && (
          <div>
            <h2 style={{ fontFamily: T.fd, fontSize: 22, fontWeight: 300, color: T.t1, marginBottom: 16 }}>Stats</h2>
            {/* Quick pre-fill from last check-in */}
            {hasLastStats && !stats.weight && !stats.waist && (
              <button onClick={() => { prefillFromLast(); }} style={{ ...S.card, padding: '12px 14px', marginBottom: 14, width: '100%', border: '1px solid ' + T.goldM, background: T.goldS, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>{'\u21BB'}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.gold, fontFamily: T.fb }}>Same as last time?</div>
                  <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>{lastCheckin.weight} lbs {'\u00B7'} {lastCheckin.waist}" waist {'\u00B7'} Day {(parseInt(lastCheckin.day) || 0) + 7}</div>
                </div>
              </button>
            )}
            {/* First check-in guidance */}
            {checkins.length === 0 && !stats.weight && (
              <div style={{ ...S.card, padding: '12px 14px', marginBottom: 14, borderColor: 'rgba(0,210,180,0.15)', background: 'rgba(0,210,180,0.04)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.teal, fontFamily: T.fb, marginBottom: 4 }}>{'\u2139'} Your Day 1 Baseline</div>
                <div style={{ fontSize: 12, color: T.t2, fontFamily: T.fm, lineHeight: 1.6 }}>This first check-in establishes your starting point. Weigh yourself in the morning before eating, and measure your waist at the navel.</div>
              </div>
            )}
            {[['Day Number', 'day'], ['Weight (lbs)', 'weight'], ['Waist (inches)', 'waist']].map(([l, k]) => (
              <div key={k} style={{ marginBottom: 14 }}>
                <label style={S.label}>{l}</label>
                <input type="number" inputMode="decimal" value={stats[k]} onChange={e => setStats(p => ({ ...p, [k]: e.target.value }))} style={{ ...S.input, width: '100%' }} />
              </div>
            ))}
            {hasLastStats && stats.weight && stats.waist ? (
              <button onClick={() => setStep(2)}
                style={{ ...S.logBtn, width: '100%', padding: '12px', textAlign: 'center' }}>
                Skip to Photos {'\u2192'}
              </button>
            ) : (
              <button onClick={() => setStep(2)} disabled={!stats.weight || !stats.waist}
                style={{ ...S.logBtn, width: '100%', padding: '12px', textAlign: 'center', opacity: stats.weight && stats.waist ? 1 : 0.4 }}>
                Next: Photos {'\u2192'}
              </button>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{ fontFamily: T.fd, fontSize: 22, fontWeight: 300, color: T.t1, marginBottom: 6 }}>Photos</h2>
            <p style={{ fontSize: 11, color: T.t3, fontFamily: T.fb, marginBottom: 16, lineHeight: 1.5 }}>
              Use Camera for a live shot or Upload a saved photo. Front is required; additional angles improve analysis accuracy.
            </p>
            {error && !analyzing && <div style={{ ...S.warning, marginBottom: 14, marginTop: 0 }}>{error.title}: {error.detail}</div>}
            {PHOTO_SLOTS.map(slot => <PhotoSlot key={slot.key} slot={slot} photo={photos[slot.key]} thumb={thumbs[slot.key]} compressing={compressing} onCapture={handlePhoto} onRemove={removePhoto} />)}
            {photoCount > 0 && <div style={{ textAlign: 'center', padding: '8px 0', marginBottom: 8, fontSize: 11, color: T.gold, fontFamily: T.fm }}>{photoCount} photo{photoCount !== 1 ? 's' : ''} ready for analysis</div>}
            {showAIDisclaimer ? (
              <AIDisclaimer onProceed={handleDisclaimerProceed} onCancel={handleDisclaimerCancel} />
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setStep(1); setError(null); }} style={{ ...S.newVialBtn, flex: 1 }}>{'\u2190'} Back</button>
                  <button onClick={handleAnalyzeClick} disabled={!photos.front || !!compressing}
                    style={{ ...S.logBtn, flex: 2, padding: '12px', textAlign: 'center', opacity: photos.front && !compressing ? 1 : 0.4 }}>
                    Analyze {'\u2192'}
                  </button>
                </div>
                <button onClick={saveManual} style={{ ...S.newVialBtn, width: '100%', marginTop: 8, fontSize: 11 }}>Skip AI — Save Stats Only</button>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            {analyzing ? <AnalysisLoader onCancel={cancelAnalysis} />
            : error ? (
              <div>
                <div style={{ ...S.card, padding: 16, marginBottom: 12, borderColor: 'rgba(220,80,80,0.3)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.red, fontFamily: T.fb, marginBottom: 6 }}>{error.title || 'Error'}</div>
                  <p style={{ fontSize: 12, color: T.t2, fontFamily: T.fb, lineHeight: 1.5 }}>{error.detail || String(error)}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {error.retryable !== false && lastPayload && <button onClick={retryAnalysis} style={{ ...S.logBtn, flex: 1, padding: '12px', textAlign: 'center' }}>Retry Analysis</button>}
                  <button onClick={saveManual} style={{ ...S.newVialBtn, flex: 1, padding: '12px', textAlign: 'center' }}>Save Stats Only</button>
                </div>
                <button onClick={resetForm} style={{ ...S.newVialBtn, width: '100%', marginTop: 8, fontSize: 11 }}>Cancel</button>
              </div>
            ) : analysis ? (
              <div>
                {/* ── Hero: Score Ring + Key Observation ── */}
                <FadeSection delay={0}>
                  <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                      <ScoreRing value={analysis.rateScore} color={scoreColor(analysis.rateScore)} size={140} />
                    </div>
                    <h2 style={{ fontFamily: T.fd, fontSize: 26, fontWeight: 300, color: T.t1, letterSpacing: 1, margin: '0 0 14px' }}>Analysis Complete</h2>
                    {/* Pull-quote key observation */}
                    <div style={{ position: 'relative', padding: '16px 18px', background: 'rgba(201,168,76,0.03)', borderRadius: 14, borderLeft: `3px solid ${T.gold}` }}>
                      <p style={{ fontSize: 14, color: T.gold, fontFamily: T.fd, lineHeight: 1.6, margin: 0, fontWeight: 400, fontStyle: 'italic' }}>{analysis.keyObservation}</p>
                    </div>
                  </div>
                </FadeSection>

                {/* ── Compared to Last ── */}
                {analysis.comparedToLast && analysis.comparedToLast !== 'First check-in' && analysis.comparedToLast !== 'Baseline established' && (
                  <FadeSection delay={0.1}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', marginBottom: 16, background: 'linear-gradient(135deg, rgba(201,168,76,0.04), rgba(0,210,180,0.03))', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12 }}>
                      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{'\u2192'}</span>
                      <p style={{ fontSize: 13, color: T.t1, fontFamily: T.fb, lineHeight: 1.55, fontWeight: 400, margin: 0 }}>{analysis.comparedToLast}</p>
                    </div>
                  </FadeSection>
                )}

                {parseWarning && <div style={{ ...S.infoBox, marginBottom: 14, marginTop: 0 }}>{parseWarning}</div>}

                {/* ── Regional Assessment Cards ── */}
                <FadeSection delay={0.15}>
                  <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 10, paddingLeft: 2 }}>Regional Assessment</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
                    {REGION_FIELDS.map(([label, key]) => [label, analysis[key]]).filter(([, v]) => v && v !== 'not visible').map(([label, value], idx) => {
                      const sc = sentimentColor(value);
                      const isPositive = sc === T.teal;
                      const isConcern = sc === T.amber;
                      const accentColor = isPositive ? 'rgba(0,210,180,0.4)' : isConcern ? 'rgba(255,180,50,0.4)' : 'rgba(240,236,228,0.08)';
                      const bgColor = isPositive ? 'rgba(0,210,180,0.03)' : isConcern ? 'rgba(255,180,50,0.03)' : 'rgba(255,255,255,0.015)';
                      // Body Fat and Muscle Status get full-width
                      const isWide = label === 'Body Fat' || label === 'Muscle Status';
                      return (
                        <div key={label} style={{
                          gridColumn: isWide ? '1 / -1' : undefined,
                          padding: '10px 12px', background: bgColor,
                          border: `1px solid ${isPositive ? 'rgba(0,210,180,0.12)' : isConcern ? 'rgba(255,180,50,0.12)' : T.border}`,
                          borderRadius: 10, borderLeft: `3px solid ${accentColor}`,
                        }}>
                          <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: 12, color: sc, fontFamily: T.fb, lineHeight: 1.45 }}>{value}</div>
                        </div>
                      );
                    })}
                  </div>
                </FadeSection>

                {/* ── Injection Sites ── */}
                {analysis.injectionSites && analysis.injectionSites !== 'none visible' && (
                  <FadeSection delay={0.2}>
                    <div style={{ padding: '12px 14px', marginBottom: 16, background: 'rgba(255,180,50,0.03)', border: '1px solid rgba(255,180,50,0.12)', borderRadius: 12, borderLeft: '3px solid rgba(255,180,50,0.4)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                        <span style={{ fontSize: 12 }}>{'\uD83D\uDC89'}</span>
                        <span style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>Injection Sites</span>
                      </div>
                      <p style={{ fontSize: 12, color: T.amber, fontFamily: T.fb, marginTop: 0, lineHeight: 1.5, margin: 0 }}>{analysis.injectionSites}</p>
                    </div>
                  </FadeSection>
                )}

                {/* ── Flags ── */}
                {Array.isArray(analysis.flags) && analysis.flags.length > 0 && (
                  <FadeSection delay={0.25}>
                    <div style={{ marginBottom: 16 }}>
                      {analysis.flags.map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', marginBottom: 4, background: 'rgba(220,80,80,0.04)', border: '1px solid rgba(220,80,80,0.15)', borderRadius: 10 }}>
                          <span style={{ fontSize: 13, flexShrink: 0 }}>{'\u26A0'}</span>
                          <span style={{ fontSize: 12, color: 'rgba(220,80,80,0.85)', fontFamily: T.fb, lineHeight: 1.45 }}>{f}</span>
                        </div>
                      ))}
                    </div>
                  </FadeSection>
                )}

                {/* ── Stack Assessment ── */}
                {analysis.stackAssessment && (
                  <FadeSection delay={0.3}>
                    <div style={{ padding: '14px 16px', marginBottom: 16, background: 'rgba(0,210,180,0.025)', border: '1px solid rgba(0,210,180,0.12)', borderRadius: 12, borderLeft: '3px solid rgba(0,210,180,0.4)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 12 }}>{'\u2261'}</span>
                        <span style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>Stack Assessment</span>
                      </div>
                      <p style={{ fontSize: 13, color: T.teal, fontFamily: T.fb, marginTop: 0, lineHeight: 1.55, margin: 0 }}>{analysis.stackAssessment}</p>
                    </div>
                  </FadeSection>
                )}

                {/* ── Peptide Recommendations ── */}
                {Array.isArray(analysis.peptideRecommendations) && analysis.peptideRecommendations.length > 0 && (
                  <FadeSection delay={0.35}>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 10, paddingLeft: 2 }}>Recommendations</div>
                      {analysis.peptideRecommendations.map((rec, i) => {
                        const priorityColor = rec.priority === 'high' ? T.gold : rec.priority === 'medium' ? T.teal : T.t3;
                        const dotColor = rec.priority === 'high' ? T.gold : rec.priority === 'medium' ? T.teal : 'rgba(140,160,180,0.4)';
                        const borderColor = rec.priority === 'high' ? 'rgba(201,168,76,0.15)' : rec.priority === 'medium' ? 'rgba(0,210,180,0.12)' : T.border;
                        const bgColor = rec.priority === 'high' ? 'rgba(201,168,76,0.025)' : rec.priority === 'medium' ? 'rgba(0,210,180,0.02)' : 'rgba(255,255,255,0.015)';
                        return (
                          <div key={i} style={{
                            padding: '12px 14px', marginBottom: 8, background: bgColor,
                            border: `1px solid ${borderColor}`, borderRadius: 12,
                            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0, boxShadow: `0 0 6px ${dotColor}` }} />
                              <span style={{ fontSize: 14, fontWeight: 600, color: T.t1, fontFamily: T.fb, flex: 1 }}>{rec.compound}</span>
                              {rec.alreadyInStack && <span style={{ fontSize: 9, color: T.teal, fontFamily: T.fm, letterSpacing: 1, textTransform: 'uppercase' }}>In Stack</span>}
                            </div>
                            {rec.category && (
                              <div style={{ display: 'inline-block', padding: '2px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, marginBottom: 6 }}>
                                <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>{rec.category}</span>
                              </div>
                            )}
                            <p style={{ fontSize: 12, color: T.t2, fontFamily: T.fb, marginTop: 2, lineHeight: 1.5, margin: 0 }}>{rec.rationale}</p>
                          </div>
                        );
                      })}
                    </div>
                  </FadeSection>
                )}

                <FadeSection delay={0.4}>
                  <button onClick={resetForm} style={{ ...S.logBtn, width: '100%', padding: '14px', textAlign: 'center', fontSize: 14, borderRadius: 12, marginTop: 4 }}>Done</button>
                </FadeSection>
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  /* ============================================================
     INSIGHTS VIEW (with Progress Charts)
     ============================================================ */

  const renderInsights = () => {
    const latest = checkins.length > 0 ? checkins[checkins.length - 1] : null;
    const latestA = latest ? (latest.analysis || {}) : {};
    const first = checkins.length > 0 ? checkins[0] : null;
    const daysSinceFirst = first ? Math.round((Date.now() - (first.timestamp || Date.now())) / 86400000) : 0;
    const bestScore = checkins.reduce((best, ci) => { const s = parseFloat((ci.analysis || {}).rateScore) || 0; return s > best ? s : best; }, 0);

    // Deltas for trend indicators
    const prev = checkins.length > 1 ? checkins[checkins.length - 2] : null;
    const weightDelta = latest && prev ? (latest.weight - prev.weight).toFixed(1) : null;
    const waistDelta = latest && prev ? (latest.waist - prev.waist).toFixed(1) : null;

    return (
      <div style={{ animation: 'fadeUp .5s ease both' }}>
        {/* Weekly AI Summary */}
        <div style={sectionLabel}>Weekly AI Summary</div>
        {summaryData && summaryData.summary && (
          <div style={{ ...goldCard, marginBottom: 10 }}>
            <p style={{ fontSize: 13, color: T.t1, fontFamily: T.fb, lineHeight: 1.6 }}>{summaryData.summary}</p>
            <p style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 8 }}>Generated {summaryData.date}</p>
          </div>
        )}
        {summaryLoading ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ animation: 'spin 2s linear infinite', display: 'inline-block' }}><Enso size={32} /></div>
            <p style={{ fontFamily: T.fb, fontSize: 12, color: T.t2, marginTop: 10 }}>Generating summary...</p>
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <button onClick={handleGenerateSummary} style={{ ...S.logBtn, width: '100%', padding: '12px', textAlign: 'center' }}>Generate This Week's Summary</button>
            {!isSunday && <p style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 6, textAlign: 'center' }}>Best used on Sundays for a full-week view</p>}
          </div>
        )}

        {/* Body Stats Dashboard */}
        <div style={sectionLabel}>Body Stats</div>
        {checkins.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <p style={{ fontFamily: T.fb, fontSize: 13, color: T.t3, lineHeight: 1.6 }}>No check-in data yet. Complete your first check-in to see stats here.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              <div style={statCard}>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.t1, fontFamily: T.fm }}>{latest ? latest.weight : '-'}</div>
                <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 4 }}>Weight lbs</div>
                {weightDelta && <div style={{ fontSize: 9, color: parseFloat(weightDelta) <= 0 ? T.teal : T.amber, fontFamily: T.fm, marginTop: 2 }}>{parseFloat(weightDelta) > 0 ? '+' : ''}{weightDelta}</div>}
              </div>
              <div style={statCard}>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.t1, fontFamily: T.fm }}>{latest ? latest.waist : '-'}</div>
                <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 4 }}>Waist in</div>
                {waistDelta && <div style={{ fontSize: 9, color: parseFloat(waistDelta) <= 0 ? T.teal : T.amber, fontFamily: T.fm, marginTop: 2 }}>{parseFloat(waistDelta) > 0 ? '+' : ''}{waistDelta}</div>}
              </div>
              <div style={statCard}>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.t1, fontFamily: T.fm }}>{latestA.bodyFatEstimate || '-'}</div>
                <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 4 }}>Body Fat</div>
              </div>
              <div style={statCard}>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.t1, fontFamily: T.fm }}>{checkins.length}</div>
                <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 4 }}>Check-ins</div>
              </div>
              <div style={statCard}>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.t1, fontFamily: T.fm }}>{daysSinceFirst}</div>
                <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 4 }}>Days</div>
              </div>
              <div style={statCard}>
                <div style={{ fontSize: 20, fontWeight: 700, color: scoreColor(bestScore), fontFamily: T.fm }}>{bestScore || '-'}</div>
                <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 4 }}>Best Score</div>
              </div>
            </div>

            {/* ── Progress Charts ── */}
            {checkins.length >= 2 && (
              <>
                <div style={{ ...sectionLabel, marginTop: 8 }}>Progress Charts</div>
                <ChartCard title="Weight + Waist Over Time">
                  <WeightWaistChart checkins={checkins} />
                </ChartCard>
                <ChartCard title="Rate Score History" height={160}>
                  <ScoreChart checkins={checkins} height={160} />
                </ChartCard>
                {checkins.filter(c => c.analysis?.bodyFatEstimate).length >= 2 && (
                  <ChartCard title="Body Fat Trend (AI Estimated)" height={160}>
                    <BodyFatChart checkins={checkins} height={160} />
                  </ChartCard>
                )}
              </>
            )}
          </>
        )}
      </div>
    );
  };

  /* ============================================================
     COMPARE VIEW
     ============================================================ */

  const renderCompare = () => {
    const withPhotos = checkins.filter(c => c.hasPhotos || c.thumbFront);
    if (withPhotos.length < 2) {
      return (
        <div style={{ animation: 'fadeUp .5s ease both', textAlign: 'center', padding: '60px 0' }}>
          <SamsaraSymbol size={48} />
          <p style={{ fontFamily: T.fd, fontSize: 18, fontWeight: 300, color: T.t2, marginTop: 16, letterSpacing: 1 }}>Need 2+ check-ins with photos</p>
          <p style={{ fontFamily: T.fb, fontSize: 12, color: T.t3, marginTop: 8 }}>Complete more check-ins to compare your progress side by side.</p>
        </div>
      );
    }

    const ciA = withPhotos.find(c => c.id === compareA);
    const ciB = withPhotos.find(c => c.id === compareB);

    // Auto-select first and last if not set
    if (!compareA && !compareB && withPhotos.length >= 2) {
      setTimeout(() => {
        setCompareA(withPhotos[0].id);
        setCompareB(withPhotos[withPhotos.length - 1].id);
      }, 0);
    }

    const photoA = comparePhotosA?.[compareSlot];
    const photoB = comparePhotosB?.[compareSlot];

    // Stats delta
    const delta = ciA && ciB ? {
      weight: (ciB.weight - ciA.weight).toFixed(1),
      waist: (ciB.waist - ciA.waist).toFixed(1),
      score: ((parseFloat(ciB.analysis?.rateScore) || 0) - (parseFloat(ciA.analysis?.rateScore) || 0)).toFixed(1),
      days: Math.round((new Date(ciB.date) - new Date(ciA.date)) / 86400000),
    } : null;

    const selectStyle = {
      width: '100%', padding: '8px', background: 'rgba(0,0,0,0.4)',
      border: `1px solid ${T.border}`, borderRadius: 6, color: T.t1,
      fontFamily: T.fm, fontSize: 11, outline: 'none',
    };

    return (
      <div style={{ animation: 'fadeUp .5s ease both' }}>
        <div style={sectionLabel}>Before / After Comparison</div>

        {/* Slot toggle */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: 'rgba(0,0,0,0.3)', padding: 3, borderRadius: 6 }}>
          {['front', 'side', 'back', 'flex'].map(s => (
            <button key={s} onClick={() => setCompareSlot(s)}
              style={{ flex: 1, padding: '6px 0', background: compareSlot === s ? 'rgba(201,168,76,0.15)' : 'transparent', border: 'none', color: compareSlot === s ? T.gold : T.t3, fontFamily: T.fm, fontSize: 10, borderRadius: 4, cursor: 'pointer', textTransform: 'capitalize' }}>
              {s}
            </button>
          ))}
        </div>

        {/* Side by side photos */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <select value={compareA || ''} onChange={e => setCompareA(e.target.value)} style={selectStyle}>
              <option value="">Select before...</option>
              {withPhotos.map(c => <option key={c.id} value={c.id}>Day {c.day} - {c.date}</option>)}
            </select>
            <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.border}`, background: 'rgba(0,0,0,0.3)', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {loadingPhotos ? (
                <div style={{ animation: 'spin 2s linear infinite' }}><Enso size={24} /></div>
              ) : photoA ? (
                <img src={'data:image/jpeg;base64,' + photoA} alt="Before" style={{ width: '100%', objectFit: 'contain' }} />
              ) : ciA?.thumbFront && compareSlot === 'front' ? (
                <img src={'data:image/jpeg;base64,' + ciA.thumbFront} alt="Before (thumb)" style={{ width: '100%', objectFit: 'contain', opacity: 0.7 }} />
              ) : (
                <span style={{ fontSize: 11, color: T.t3, fontFamily: T.fm }}>{compareA ? 'No ' + compareSlot + ' photo' : 'Select a date'}</span>
              )}
            </div>
            {ciA && <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 4, textAlign: 'center' }}>{ciA.weight} lbs {'\u00B7'} {ciA.waist}"</div>}
          </div>

          <div style={{ flex: 1 }}>
            <select value={compareB || ''} onChange={e => setCompareB(e.target.value)} style={selectStyle}>
              <option value="">Select after...</option>
              {withPhotos.map(c => <option key={c.id} value={c.id}>Day {c.day} - {c.date}</option>)}
            </select>
            <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.border}`, background: 'rgba(0,0,0,0.3)', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {loadingPhotos ? (
                <div style={{ animation: 'spin 2s linear infinite' }}><Enso size={24} /></div>
              ) : photoB ? (
                <img src={'data:image/jpeg;base64,' + photoB} alt="After" style={{ width: '100%', objectFit: 'contain' }} />
              ) : ciB?.thumbFront && compareSlot === 'front' ? (
                <img src={'data:image/jpeg;base64,' + ciB.thumbFront} alt="After (thumb)" style={{ width: '100%', objectFit: 'contain', opacity: 0.7 }} />
              ) : (
                <span style={{ fontSize: 11, color: T.t3, fontFamily: T.fm }}>{compareB ? 'No ' + compareSlot + ' photo' : 'Select a date'}</span>
              )}
            </div>
            {ciB && <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 4, textAlign: 'center' }}>{ciB.weight} lbs {'\u00B7'} {ciB.waist}"</div>}
          </div>
        </div>

        {/* Delta stats */}
        {delta && (
          <div style={{ ...goldCard, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: parseFloat(delta.weight) <= 0 ? T.teal : T.amber, fontFamily: T.fm }}>
                  {parseFloat(delta.weight) > 0 ? '+' : ''}{delta.weight}
                </div>
                <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 2 }}>lbs</div>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: parseFloat(delta.waist) <= 0 ? T.teal : T.amber, fontFamily: T.fm }}>
                  {parseFloat(delta.waist) > 0 ? '+' : ''}{delta.waist}
                </div>
                <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 2 }}>waist</div>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: parseFloat(delta.score) >= 0 ? T.teal : T.amber, fontFamily: T.fm }}>
                  {parseFloat(delta.score) > 0 ? '+' : ''}{delta.score}
                </div>
                <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 2 }}>score</div>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.t1, fontFamily: T.fm }}>{delta.days}</div>
                <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 2 }}>days</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ============================================================
     PHOTO LIGHTBOX
     ============================================================ */

  const renderLightbox = () => {
    if (!lightboxPhotos) return null;
    const slots = Object.keys(lightboxPhotos);
    return (
      <div onClick={() => setLightboxPhotos(null)} style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
        <button onClick={() => setLightboxPhotos(null)} style={{
          position: 'absolute', top: 16, right: 16,
          width: 32, height: 32, borderRadius: 16,
          background: 'rgba(255,255,255,0.1)', border: 'none',
          color: T.t1, fontSize: 16, cursor: 'pointer',
        }}>{'\u2715'}</button>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', maxWidth: '100%', padding: '8px 0' }} onClick={e => e.stopPropagation()}>
          {slots.map(slot => (
            <div key={slot} style={{ flexShrink: 0 }}>
              <img src={'data:image/jpeg;base64,' + lightboxPhotos[slot]} alt={slot}
                style={{ maxHeight: 'calc(100vh - 120px)', maxWidth: '90vw', borderRadius: 8, objectFit: 'contain' }} />
              <div style={{ textAlign: 'center', fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 6, textTransform: 'capitalize' }}>{slot}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div>
      <header style={{ ...S.header, marginBottom: 14 }}>
        <h1 style={{ ...S.brand, fontSize: 20 }}>BODY</h1>
        <p style={S.sub}>Composition Analysis</p>
      </header>

      {renderSegments()}

      {activeView === 'Timeline' && renderTimeline()}
      {activeView === 'Check-in' && renderCheckin()}
      {activeView === 'Insights' && renderInsights()}
      {activeView === 'Compare' && renderCompare()}

      {renderLightbox()}
    </div>
  );
}
