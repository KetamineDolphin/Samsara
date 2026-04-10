/* SAMSARA v3.2 - BodyTab: Timeline | Check-in | Insights */
import { useState, useEffect, useRef } from 'react';
import T from '../utils/tokens';
import S from '../utils/styles';
import { getToday, makeId } from '../utils/helpers';
import { SamsaraSymbol, Enso } from '../components/Shared';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SYSTEM PROMPT - the soul of the analysis
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const ANALYSIS_PROMPT = `You are Samsara's body composition analyst - an expert-level physique assessor for users tracking peptide-assisted recomposition protocols. You provide honest, precise, data-driven assessments. Never sugarcoat.

Analyze the uploaded photo(s) and return ONLY a valid JSON object. No markdown, no backticks, no explanation text - raw JSON only.

Required JSON schema:
{
  "bodyFatEstimate": "XX-XX%" (narrow 2% range, e.g. "18-20%"),
  "muscleStatus": "description of overall muscle preservation/growth" ,
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
  "keyObservation": "One powerful, specific sentence - the single most important finding. Not generic. Reference actual visible changes. Be precise, e.g. 'Lower abdominal fat pad has reduced ~0.5 inches since last check-in, serratus anterior now faintly visible on the right side'",
  "comparedToLast": "Specific comparison if previous data provided. Mention exact areas of change. If first check-in, say 'Baseline established'",
  "rateScore": 7.3 (number with one decimal - precise, not rounded. 1-10 scale: 1-3=high body fat/low muscle, 4-5=average, 6-7=lean with muscle, 8-9=very lean/muscular, 9.5+=competition ready),
  "flags": ["array of concerns: injection site reactions, asymmetry, potential gyno, unusual water retention, skin issues worth monitoring"]
}

Assessment principles:
- Be brutally honest. Users want truth, not encouragement.
- Rate score must use decimals (7.3, not 7). Differentiate meaningfully between check-ins.
- keyObservation must be specific and visual - reference what you actually see, not platitudes.
- Note any visible peptide-related changes: GH-related water retention, collagen improvements, injection marks.
- When previous data is provided, focus comparedToLast on measurable visual deltas.
- Flag anything concerning: injection site reactions, unusual swelling, skin changes.`;

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   LOADING TIPS - rotate during analysis
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const LOADING_TIPS = [
  'Analyzing body composition...',
  'Assessing regional fat distribution...',
  'Comparing to previous check-in...',
  'Evaluating muscle preservation...',
  'Checking injection site quality...',
  'Generating regional assessment...',
  'Calculating rate score...',
  'Finalizing analysis...',
];

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ROBUST JSON PARSING
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function parseAnalysisJSON(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim();

  // Strategy 1: direct parse
  try { return JSON.parse(cleaned); } catch {}

  // Strategy 2: extract from markdown code blocks
  const mdMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch) {
    try { return JSON.parse(mdMatch[1].trim()); } catch {}
  }

  // Strategy 3: find outermost { } boundaries
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(cleaned.slice(first, last + 1)); } catch {}
  }

  // Strategy 4: aggressive cleanup - strip common prefixes/suffixes
  const stripped = cleaned
    .replace(/^[^{]*/, '')
    .replace(/[^}]*$/, '');
  if (stripped.length > 2) {
    try { return JSON.parse(stripped); } catch {}
  }

  return null;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SENTIMENT DETECTION for regional colors
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ANIMATED SCORE COUNTER
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function AnimatedScore({ value, color }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const target = parseFloat(value) || 0;
    const duration = 1200;
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(+(eased * target).toFixed(1));
      if (progress < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [value]);

  return (
    <span style={{ fontSize: 42, fontWeight: 800, color, fontFamily: T.fm, lineHeight: 1 }}>
      {display}
    </span>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   LOADING SPINNER with rotating tips
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function AnalysisLoader() {
  const [tipIdx, setTipIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tipInterval = setInterval(() => {
      setTipIdx(i => (i + 1) % LOADING_TIPS.length);
    }, 2800);
    const timeInterval = setInterval(() => {
      setElapsed(e => e + 1);
    }, 1000);
    return () => { clearInterval(tipInterval); clearInterval(timeInterval); };
  }, []);

  return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <div style={{ animation: 'spin 2s linear infinite', display: 'inline-block' }}>
        <SamsaraSymbol size={48} />
      </div>
      <p style={{
        fontFamily: T.fb, fontSize: 13, color: T.t2,
        marginTop: 16, animation: 'pulse 1.5s ease infinite',
        minHeight: 20, transition: 'opacity 0.3s'
      }}>{LOADING_TIPS[tipIdx]}</p>
      <p style={{ fontFamily: T.fm, fontSize: 10, color: T.t3, marginTop: 8 }}>
        {elapsed}s {'\u00B7'} typically 10-15 seconds
      </p>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CONSTANTS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const VIEWS = ['Timeline', 'Check-in', 'Insights'];

const scoreColor = (s) => {
  const n = parseFloat(s) || 0;
  if (n >= 9) return T.gold;
  if (n >= 7) return T.teal;
  if (n >= 5) return T.amber;
  return T.red;
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MAIN COMPONENT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function BodyTab({
  checkins: rawCheckins,
  setCheckins,
  stack: rawStack,
  logs: rawLogs,
  subjective: rawSubjective,
  setSubjective,
  detectMilestones,
  calculateTrajectory,
  generateWeeklySummary,
  profile
}) {
  /* --- safe fallbacks --- */
  const checkins = rawCheckins || [];
  const stack = rawStack || [];
  const logs = (rawLogs || []).map(l => l.compoundId ? l : { ...l, compoundId: l.cid });
  const subjective = rawSubjective || [];

  /* --- top-level view --- */
  const [activeView, setActiveView] = useState('Timeline');

  /* --- check-in flow state --- */
  const [step, setStep] = useState(1);
  const [stats, setStats] = useState({ date: getToday(), day: '', weight: '', waist: '' });
  const [photos, setPhotos] = useState({ front: null, side: null, back: null, flex: null });
  const [thumbs, setThumbs] = useState({ front: null, side: null, back: null, flex: null });
  const [compressing, setCompressing] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [parseWarning, setParseWarning] = useState(null);
  const [lastApiPayload, setLastApiPayload] = useState(null);

  /* --- timeline expand state --- */
  const [expandedId, setExpandedId] = useState(null);

  /* --- insights state --- */
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(() => {
    try {
      const saved = localStorage.getItem('samsara_weekly');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  /* ============================================================
     IMAGE COMPRESSION
     ============================================================ */
  const compressImage = (file, maxDim) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onerror = () => rej(new Error('Failed to read file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => rej(new Error('Failed to load image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          const r = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * r); h = Math.round(h * r);
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        res(canvas.toDataURL('image/jpeg', maxDim > 200 ? 0.85 : 0.6).split(',')[1]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  const handlePhoto = async (key, file) => {
    if (!file) return;
    setCompressing(key);
    try {
      const [full, thumb] = await Promise.all([
        compressImage(file, 1024),
        compressImage(file, 120),
      ]);
      setPhotos(p => ({ ...p, [key]: full }));
      setThumbs(p => ({ ...p, [key]: thumb }));
    } catch (err) {
      setError('Photo compression failed: ' + (err.message || 'unknown'));
    }
    setCompressing(null);
  };

  /* ============================================================
     ERROR CLASSIFICATION
     ============================================================ */
  function classifyError(resp, errText) {
    if (!resp) return { title: 'Network Error', detail: 'Could not reach the API. Check your connection.', retryable: true };
    if (resp.status === 401) return { title: 'Invalid API Key', detail: 'Your Anthropic API key was rejected. Check it in Profile > Settings.', retryable: false };
    if (resp.status === 429) return { title: 'Rate Limited', detail: 'Too many requests. Wait a moment and try again.', retryable: true };
    if (resp.status === 529) return { title: 'API Overloaded', detail: 'Anthropic servers are busy. Try again in a few seconds.', retryable: true };
    if (resp.status >= 500) return { title: 'Server Error (' + resp.status + ')', detail: 'Anthropic API issue. Usually resolves quickly.', retryable: true };
    return { title: 'API Error (' + resp.status + ')', detail: errText ? errText.slice(0, 200) : 'Unknown error', retryable: true };
  }

  /* ============================================================
     RUN ANALYSIS
     ============================================================ */
  const runAnalysis = async () => {
    setAnalyzing(true); setError(null); setParseWarning(null); setStep(3);

    // Build previous context
    const prev = checkins.length > 0
      ? checkins[checkins.length - 1]
      : null;
    const prevContext = prev
      ? 'Previous check-in (Day ' + (prev.day || '?') + ', ' + prev.weight + ' lbs, ' + prev.waist + '" waist): ' + JSON.stringify(prev.analysis || {})
      : 'First check-in - establish baseline.';

    const payload = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: ANALYSIS_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photos.front } },
          ...(photos.side ? [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photos.side } }] : []),
          ...(photos.back ? [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photos.back } }] : []),
          {
            type: 'text',
            text: 'Day ' + (stats.day || '?') + ', ' + stats.weight + ' lbs, ' + stats.waist + '" waist.\n'
              + 'Active peptide stack: ' + (stack.length > 0 ? stack.map(s => s.name).join(', ') : 'none listed') + '.\n'
              + prevContext
          }
        ]
      }]
    };

    setLastApiPayload({ payload });

    let resp = null;
    try {
      resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        const classified = classifyError(resp, errText);
        setError(classified);
        setAnalyzing(false);
        return;
      }

      const data = await resp.json();
      const rawText = (data.content || []).map(i => i.text || '').join('');

      // Robust JSON parsing with fallbacks
      const parsed = parseAnalysisJSON(rawText);

      if (parsed && parsed.rateScore != null) {
        setAnalysis(parsed);
        const checkin = {
          id: makeId(), date: stats.date, day: parseInt(stats.day) || 0,
          weight: parseFloat(stats.weight) || 0, waist: parseFloat(stats.waist) || 0,
          thumbFront: thumbs.front, thumbSide: thumbs.side,
          analysis: parsed, timestamp: Date.now()
        };
        setCheckins(p => [...(p || []), checkin]);
      } else if (parsed) {
        // Parsed but missing rateScore - still usable
        const patched = { ...parsed, rateScore: parsed.rateScore || 0 };
        setAnalysis(patched);
        setParseWarning('Analysis returned but some fields may be incomplete.');
        const checkin = {
          id: makeId(), date: stats.date, day: parseInt(stats.day) || 0,
          weight: parseFloat(stats.weight) || 0, waist: parseFloat(stats.waist) || 0,
          thumbFront: thumbs.front, thumbSide: thumbs.side,
          analysis: patched, timestamp: Date.now()
        };
        setCheckins(p => [...(p || []), checkin]);
      } else {
        // Total parse failure - save stats without analysis
        setError({
          title: 'Analysis Parse Failed',
          detail: 'AI returned a response but it could not be parsed. Your stats have been saved without analysis.',
          retryable: true
        });
        const checkin = {
          id: makeId(), date: stats.date, day: parseInt(stats.day) || 0,
          weight: parseFloat(stats.weight) || 0, waist: parseFloat(stats.waist) || 0,
          thumbFront: thumbs.front, thumbSide: thumbs.side,
          analysis: { rateScore: 0, keyObservation: 'Analysis parse failed - raw: ' + rawText.slice(0, 100) },
          timestamp: Date.now()
        };
        setCheckins(p => [...(p || []), checkin]);
      }
    } catch (e) {
      const classified = classifyError(resp, e.message);
      setError(classified);
    }
    setAnalyzing(false);
  };

  /* ============================================================
     RETRY ANALYSIS
     ============================================================ */
  const retryAnalysis = async () => {
    if (!lastApiPayload) return;
    setAnalyzing(true); setError(null); setParseWarning(null);

    let resp = null;
    try {
      resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lastApiPayload.payload)
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        setError(classifyError(resp, errText));
        setAnalyzing(false);
        return;
      }

      const data = await resp.json();
      const rawText = (data.content || []).map(i => i.text || '').join('');
      const parsed = parseAnalysisJSON(rawText);

      if (parsed) {
        const patched = { ...parsed, rateScore: parsed.rateScore || 0 };
        setAnalysis(patched);
        // Remove the stats-only checkin we saved on first failure and add proper one
        setCheckins(p => {
          const existing = [...(p || [])];
          // Replace last checkin if it was a failed parse from this session
          const lastIdx = existing.length - 1;
          if (lastIdx >= 0 && existing[lastIdx].date === stats.date && existing[lastIdx].analysis?.rateScore === 0) {
            existing[lastIdx] = {
              ...existing[lastIdx],
              analysis: patched
            };
            return existing;
          }
          return p;
        });
        setError(null);
      } else {
        setError({ title: 'Parse Failed Again', detail: 'Retry also failed to parse. Your stats are saved.', retryable: false });
      }
    } catch (e) {
      setError(classifyError(resp, e.message));
    }
    setAnalyzing(false);
  };

  /* ============================================================
     SAVE MANUAL
     ============================================================ */
  const saveManual = () => {
    const checkin = {
      id: makeId(), date: stats.date, day: parseInt(stats.day) || 0,
      weight: parseFloat(stats.weight) || 0, waist: parseFloat(stats.waist) || 0,
      thumbFront: thumbs.front, thumbSide: thumbs.side,
      analysis: analysis || { rateScore: 0, keyObservation: 'Manual entry' },
      timestamp: Date.now()
    };
    setCheckins(p => [...(p || []), checkin]);
    resetForm();
  };

  const resetForm = () => {
    setActiveView('Timeline'); setStep(1);
    setStats({ date: getToday(), day: '', weight: '', waist: '' });
    setPhotos({ front: null, side: null, back: null, flex: null });
    setThumbs({ front: null, side: null, back: null, flex: null });
    setAnalysis(null); setError(null); setParseWarning(null);
    setLastApiPayload(null); setCompressing(null);
  };

  /* ============================================================
     INSIGHTS ACTIONS
     ============================================================ */
  const handleGenerateSummary = async () => {
    if (!generateWeeklySummary) return;
    setSummaryLoading(true);
    try {
      const result = await generateWeeklySummary(logs, checkins, stack);
      const payload = { summary: result.summary, date: result.date || getToday() };
      setSummaryData(payload);
      try { localStorage.setItem('samsara_weekly', JSON.stringify(payload)); } catch {}
    } catch {}
    setSummaryLoading(false);
  };

  const isSunday = new Date().getDay() === 0;

  /* ============================================================
     SHARED STYLES
     ============================================================ */
  const goldCard = {
    background: 'rgba(201,168,76,0.025)',
    border: '1px solid rgba(201,168,76,0.12)',
    borderRadius: 14,
    padding: '16px',
    marginBottom: 14
  };

  const sectionLabel = {
    fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
    color: T.t3, fontFamily: T.fm, marginBottom: 8
  };

  const statCard = {
    background: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: '12px 10px',
    textAlign: 'center'
  };

  /* ============================================================
     SEGMENTED CONTROL
     ============================================================ */
  const renderSegments = () => (
    <div style={S.segWrap}>
      {VIEWS.map(v => (
        <button
          key={v}
          onClick={() => { setActiveView(v); if (v === 'Check-in') setStep(1); }}
          style={{ ...S.segBtn, ...(activeView === v ? S.segOn : {}) }}
        >{v}</button>
      ))}
    </div>
  );

  /* ============================================================
     TIMELINE VIEW
     ============================================================ */
  const renderTimeline = () => {
    /* trajectory */
    const trajectory = checkins.length >= 5 && calculateTrajectory
      ? calculateTrajectory(checkins, profile?.targetWeight || 170, profile?.targetWaist || 26)
      : null;
    const showTrajectory = trajectory &&
      (trajectory.daysToTargetWeight !== null || trajectory.daysToTargetWaist !== null);

    /* milestones */
    const milestones = detectMilestones ? detectMilestones(checkins) : [];
    const recentMilestones = milestones.slice(-3).reverse();

    return (
      <div style={{ animation: 'fadeUp .5s ease both' }}>
        {/* Trajectory card */}
        {showTrajectory && (
          <div style={goldCard}>
            <div style={sectionLabel}>Projected trajectory</div>
            {trajectory.daysToTargetWeight !== null && (
              <p style={{ fontSize: 13, color: T.t1, fontFamily: T.fb, lineHeight: 1.5, marginBottom: 4 }}>
                At current rate: <span style={{ color: T.gold, fontWeight: 600, fontFamily: T.fm }}>
                  {trajectory.projectedWeightDate}
                </span>
                <span style={{ color: T.t3, fontSize: 11 }}> ({trajectory.daysToTargetWeight} days)</span>
              </p>
            )}
            {trajectory.daysToTargetWaist !== null && (
              <p style={{ fontSize: 13, color: T.t1, fontFamily: T.fb, lineHeight: 1.5 }}>
                Waist target: <span style={{ color: T.gold, fontWeight: 600, fontFamily: T.fm }}>
                  {trajectory.projectedWaistDate}
                </span>
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

        {/* Milestones */}
        {recentMilestones.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {recentMilestones.map((m, i) => (
              <div key={i} style={{
                border: `1px solid ${T.goldM}`,
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 6,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: 12, color: T.gold, fontFamily: T.fb, fontWeight: 500 }}>
                  {m.label}
                </span>
                <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>{m.date}</span>
              </div>
            ))}
          </div>
        )}

        {/* Timeline list */}
        {checkins.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <SamsaraSymbol size={56} detail="full" />
            <p style={{ fontFamily: T.fd, fontSize: 20, fontWeight: 300, color: T.t2, marginTop: 16, letterSpacing: 1 }}>
              Begin the record
            </p>
            <p style={{ fontFamily: T.fb, fontSize: 12, color: T.t3, marginTop: 8 }}>
              Tap Check-in to begin
            </p>
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
                <div key={ci.id} style={{ marginBottom: 0 }}>
                  {/* Day elapsed connector */}
                  {idx > 0 && daysBetween !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0' }}>
                      <div style={{ width: 1, height: 12, background: T.border }} />
                      <span style={{ fontSize: 8, color: T.t3, fontFamily: T.fm, letterSpacing: 1, margin: '0 6px' }}>{daysBetween}d</span>
                      <div style={{ width: 1, height: 12, background: T.border }} />
                    </div>
                  )}
                  {/* Summary row */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : ci.id)}
                    onTouchStart={e => e.currentTarget.style.background = 'rgba(255,255,255,0.035)'}
                    onTouchEnd={e => e.currentTarget.style.background = ''}
                    style={{
                      ...S.trackRow,
                      marginBottom: 0,
                      borderColor: isExpanded ? T.goldM : T.border,
                      ...(isMostRecent ? { borderLeft: `3px solid ${T.gold}` } : {})
                    }}
                  >
                    {ci.thumbFront && (
                      <img
                        src={'data:image/jpeg;base64,' + ci.thumbFront}
                        alt=""
                        style={{
                          width: photoW, height: photoH, objectFit: 'cover',
                          borderRadius: 6, border: `1px solid ${T.border}`,
                          boxShadow: isMostRecent ? '0 2px 8px rgba(0,0,0,0.4)' : 'none'
                        }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: T.t1, fontFamily: T.fb }}>
                        Day {ci.day} {'\u00B7'} {ci.date}
                      </div>
                      <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>
                        {ci.weight} lbs {'\u00B7'} {ci.waist}" {'\u00B7'} {a.bodyFatEstimate || '-'}
                      </div>
                      {a.keyObservation && a.keyObservation !== 'Manual entry' && (
                        <p style={{ fontSize: 11, color: T.gold, fontFamily: T.fb, marginTop: 4, lineHeight: 1.3 }}>
                          {a.keyObservation}
                        </p>
                      )}
                    </div>
                    <span style={{
                      fontSize: 14, fontWeight: 700,
                      color: scoreColor(rate), fontFamily: T.fm
                    }}>
                      {rate || '-'}
                    </span>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{
                      background: 'rgba(201,168,76,0.02)',
                      border: `1px solid ${T.goldM}`,
                      borderTop: 'none',
                      borderRadius: '0 0 11px 11px',
                      padding: '12px 14px'
                    }}>
                      {a.comparedToLast && a.comparedToLast !== 'First check-in' && a.comparedToLast !== 'Baseline established' && (
                        <p style={{
                          fontSize: 12, color: T.gold, fontFamily: T.fd,
                          fontStyle: 'italic', lineHeight: 1.5, marginBottom: 10,
                          fontWeight: 400
                        }}>
                          {a.comparedToLast}
                        </p>
                      )}
                      {[
                        ['Body Fat', a.bodyFatEstimate],
                        ['Muscle', a.muscleStatus],
                        ['Lower Abdomen', a.lowerAbdomen],
                        ['Upper Abdomen', a.upperAbdomen],
                        ['Obliques', a.obliques],
                        ['Chest', a.chest],
                        ['Shoulders', a.shoulders],
                        ['Arms', a.arms],
                        ['Back', a.back],
                        ['Skin Quality', a.skinQuality],
                        ['Vascularity', a.vascularity],
                        ['Injection Sites', a.injectionSites]
                      ].filter(([, v]) => v && v !== 'not visible' && v !== 'none visible').map(([k, v]) => (
                        <div key={k} style={{
                          display: 'flex', justifyContent: 'space-between',
                          padding: '6px 0', borderBottom: `1px solid ${T.border}`
                        }}>
                          <span style={{ fontSize: 11, color: T.t3, fontFamily: T.fm }}>{k}</span>
                          <span style={{
                            fontSize: 11, color: sentimentColor(v), fontFamily: T.fm,
                            textAlign: 'right', maxWidth: '60%'
                          }}>{v}</span>
                        </div>
                      ))}
                      {Array.isArray(a.flags) && a.flags.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          {a.flags.map((f, i) => (
                            <div key={i} style={{ ...S.warning, marginBottom: 4 }}>
                              {'\u26A0'} {f}
                            </div>
                          ))}
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
  const renderCheckin = () => (
    <div style={{ animation: 'fadeUp .4s ease both' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button
          onClick={() => { setActiveView('Timeline'); setStep(1); }}
          style={{ background: 'none', border: 'none', color: T.t2, fontFamily: T.fm, fontSize: 12, cursor: 'pointer' }}
        >{'\u2190'} Back</button>
        <span style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>
          Step {step} of 3
        </span>
      </div>

      {/* Step 1: Stats */}
      {step === 1 && (
        <div>
          <h2 style={{ fontFamily: T.fd, fontSize: 22, fontWeight: 300, color: T.t1, marginBottom: 16 }}>Stats</h2>
          {[['Day Number', 'day', '32'], ['Weight (lbs)', 'weight', '181.7'], ['Waist (inches)', 'waist', '27.4']].map(([l, k, ph]) => (
            <div key={k} style={{ marginBottom: 14 }}>
              <label style={S.label}>{l}</label>
              <input
                type="number" inputMode="decimal"
                value={stats[k]}
                onChange={e => setStats(p => ({ ...p, [k]: e.target.value }))}
                placeholder={ph}
                style={{ ...S.input, width: '100%' }}
              />
            </div>
          ))}
          <button
            onClick={() => setStep(2)}
            disabled={!stats.weight || !stats.waist}
            style={{
              ...S.logBtn, width: '100%', padding: '12px', textAlign: 'center',
              opacity: stats.weight && stats.waist ? 1 : 0.4
            }}
          >Next: Photos {'\u2192'}</button>
        </div>
      )}

      {/* Step 2: Photos */}
      {step === 2 && (
        <div>
          <h2 style={{ fontFamily: T.fd, fontSize: 22, fontWeight: 300, color: T.t1, marginBottom: 16 }}>Photos</h2>
          {[['Front Relaxed', 'front', true], ['Side Relaxed', 'side', false], ['Back Relaxed', 'back', false], ['Flexed', 'flex', false]].map(([l, k, req]) => (
            <div key={k} style={{ marginBottom: 12 }}>
              <label style={{ ...S.label, marginBottom: 6 }}>{l}{req ? ' *' : ''}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ ...S.logBtn, padding: '8px 14px', cursor: 'pointer', display: 'inline-block', opacity: compressing === k ? 0.5 : 1 }}>
                  {compressing === k ? 'Compressing...' : photos[k] ? '\u2713 Captured' : 'Choose'}
                  <input
                    type="file" accept="image/*" capture="environment"
                    onChange={e => handlePhoto(k, e.target.files[0])}
                    style={{ display: 'none' }}
                    disabled={compressing === k}
                  />
                </label>
                {thumbs[k] && (
                  <img
                    src={'data:image/jpeg;base64,' + thumbs[k]}
                    alt=""
                    style={{
                      width: 32, height: 42, objectFit: 'cover',
                      borderRadius: 4, border: `1px solid ${T.border}`
                    }}
                  />
                )}
                {photos[k] && !thumbs[k] && <span style={{ fontSize: 11, color: T.green, fontFamily: T.fm }}>Ready</span>}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => setStep(1)} style={{ ...S.newVialBtn, flex: 1 }}>{'\u2190'} Back</button>
            <button
              onClick={runAnalysis}
              disabled={!photos.front || compressing}
              style={{
                ...S.logBtn, flex: 2, padding: '12px', textAlign: 'center',
                opacity: photos.front && !compressing ? 1 : 0.4
              }}
            >Analyze {'\u2192'}</button>
          </div>
          <button
            onClick={saveManual}
            style={{ ...S.newVialBtn, width: '100%', marginTop: 8, fontSize: 11 }}
          >Skip AI - Save Stats Only</button>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && (
        <div>
          {analyzing ? (
            <AnalysisLoader />
          ) : error ? (
            <div>
              <div style={{
                ...S.card, padding: 16, marginBottom: 12,
                borderColor: 'rgba(220,80,80,0.3)'
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.red, fontFamily: T.fb, marginBottom: 6 }}>
                  {error.title || 'Error'}
                </div>
                <p style={{ fontSize: 12, color: T.t2, fontFamily: T.fb, lineHeight: 1.5 }}>
                  {error.detail || error}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(error.retryable !== false) && lastApiPayload && (
                  <button
                    onClick={retryAnalysis}
                    style={{ ...S.logBtn, flex: 1, padding: '12px', textAlign: 'center' }}
                  >Retry Analysis</button>
                )}
                <button
                  onClick={saveManual}
                  style={{ ...S.newVialBtn, flex: 1, padding: '12px', textAlign: 'center' }}
                >Save Stats Only</button>
              </div>
              <button
                onClick={resetForm}
                style={{ ...S.newVialBtn, width: '100%', marginTop: 8, fontSize: 11 }}
              >Cancel</button>
            </div>
          ) : analysis ? (
            <div>
              <h2 style={{ fontFamily: T.fd, fontSize: 22, fontWeight: 300, color: T.t1, marginBottom: 4 }}>Analysis</h2>

              {/* Animated score */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 16 }}>
                <AnimatedScore value={analysis.rateScore} color={scoreColor(analysis.rateScore)} />
                <span style={{ fontSize: 14, color: T.t3, fontFamily: T.fm }}>/10</span>
              </div>

              {/* Key observation */}
              <p style={{ fontSize: 13, color: T.gold, fontFamily: T.fb, lineHeight: 1.5, marginBottom: 12 }}>
                {analysis.keyObservation}
              </p>

              {/* Compared to last - gold italic */}
              {analysis.comparedToLast && analysis.comparedToLast !== 'First check-in' && analysis.comparedToLast !== 'Baseline established' && (
                <div style={{
                  ...goldCard, padding: '12px 14px', marginBottom: 14
                }}>
                  <p style={{
                    fontSize: 12, color: T.gold, fontFamily: T.fd,
                    fontStyle: 'italic', lineHeight: 1.5, fontWeight: 400, margin: 0
                  }}>
                    {analysis.comparedToLast}
                  </p>
                </div>
              )}

              {parseWarning && (
                <div style={{ ...S.infoBox, marginBottom: 12, marginTop: 0 }}>{parseWarning}</div>
              )}

              {/* Regional assessment */}
              <div style={sectionLabel}>Regional Assessment</div>
              {[
                ['Body Fat', analysis.bodyFatEstimate],
                ['Muscle Status', analysis.muscleStatus],
                ['Lower Abdomen', analysis.lowerAbdomen],
                ['Upper Abdomen', analysis.upperAbdomen],
                ['Obliques', analysis.obliques],
                ['Chest', analysis.chest],
                ['Shoulders', analysis.shoulders],
                ['Arms', analysis.arms],
                ['Back', analysis.back],
                ['Skin Quality', analysis.skinQuality],
                ['Vascularity', analysis.vascularity],
              ].filter(([, v]) => v && v !== 'not visible').map(([k, v]) => (
                <div key={k} style={{
                  display: 'flex', justifyContent: 'space-between', gap: 12,
                  padding: '8px 0', borderBottom: `1px solid ${T.border}`
                }}>
                  <span style={{ fontSize: 12, color: T.t3, fontFamily: T.fm, flexShrink: 0 }}>{k}</span>
                  <span style={{
                    fontSize: 12, color: sentimentColor(v), fontFamily: T.fm,
                    textAlign: 'right'
                  }}>{v}</span>
                </div>
              ))}

              {/* Injection sites - always show if present */}
              {analysis.injectionSites && analysis.injectionSites !== 'none visible' && (
                <div style={{
                  marginTop: 10, padding: '10px 12px',
                  background: 'rgba(255,180,50,0.06)',
                  border: '1px solid rgba(255,180,50,0.15)',
                  borderRadius: 9
                }}>
                  <span style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>Injection Sites</span>
                  <p style={{ fontSize: 12, color: T.amber, fontFamily: T.fm, marginTop: 4, lineHeight: 1.4 }}>
                    {analysis.injectionSites}
                  </p>
                </div>
              )}

              {/* Flags */}
              {Array.isArray(analysis.flags) && analysis.flags.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {analysis.flags.map((f, i) => (
                    <div key={i} style={{ ...S.warning, marginBottom: 4, marginTop: 0 }}>{'\u26A0'} {f}</div>
                  ))}
                </div>
              )}

              <button
                onClick={resetForm}
                style={{ ...S.logBtn, width: '100%', padding: '12px', textAlign: 'center', marginTop: 16 }}
              >Done</button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  /* ============================================================
     INSIGHTS VIEW
     ============================================================ */
  const renderInsights = () => {
    const latest = checkins.length > 0 ? checkins[checkins.length - 1] : null;
    const latestA = latest ? (latest.analysis || {}) : {};
    const first = checkins.length > 0 ? checkins[0] : null;
    const daysSinceFirst = first
      ? Math.round((Date.now() - (first.timestamp || Date.now())) / 86400000)
      : 0;
    const bestScore = checkins.reduce((best, ci) => {
      const s = parseFloat((ci.analysis || {}).rateScore) || 0;
      return s > best ? s : best;
    }, 0);

    return (
      <div style={{ animation: 'fadeUp .5s ease both' }}>
        {/* Weekly AI Summary */}
        <div style={sectionLabel}>Weekly AI Summary</div>

        {summaryData && summaryData.summary && (
          <div style={{ ...goldCard, marginBottom: 10 }}>
            <p style={{ fontSize: 13, color: T.t1, fontFamily: T.fb, lineHeight: 1.6 }}>
              {summaryData.summary}
            </p>
            <p style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 8 }}>
              Generated {summaryData.date}
            </p>
          </div>
        )}

        {summaryLoading ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ animation: 'spin 2s linear infinite', display: 'inline-block' }}>
              <Enso size={32} />
            </div>
            <p style={{ fontFamily: T.fb, fontSize: 12, color: T.t2, marginTop: 10 }}>
              Generating summary...
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={handleGenerateSummary}
              style={{ ...S.logBtn, width: '100%', padding: '12px', textAlign: 'center' }}
            >Generate This Week's Summary</button>
            {!isSunday && (
              <p style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 6, textAlign: 'center' }}>
                Best used on Sundays for a full-week view
              </p>
            )}
          </div>
        )}

        {/* Body Stats Dashboard */}
        <div style={sectionLabel}>Body Stats</div>

        {checkins.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <p style={{ fontFamily: T.fb, fontSize: 13, color: T.t3, lineHeight: 1.6 }}>
              No check-in data yet. Complete your first check-in to see stats here.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8, marginBottom: 14
          }}>
            <div style={statCard}>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.t1, fontFamily: T.fm }}>
                {latest ? latest.weight : '-'}
              </div>
              <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 4 }}>
                Weight lbs
              </div>
            </div>
            <div style={statCard}>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.t1, fontFamily: T.fm }}>
                {latest ? latest.waist : '-'}
              </div>
              <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 4 }}>
                Waist in
              </div>
            </div>
            <div style={statCard}>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.t1, fontFamily: T.fm }}>
                {latestA.bodyFatEstimate || '-'}
              </div>
              <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 4 }}>
                Body Fat
              </div>
            </div>
            <div style={statCard}>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.t1, fontFamily: T.fm }}>
                {checkins.length}
              </div>
              <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 4 }}>
                Check-ins
              </div>
            </div>
            <div style={statCard}>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.t1, fontFamily: T.fm }}>
                {daysSinceFirst}
              </div>
              <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 4 }}>
                Days
              </div>
            </div>
            <div style={statCard}>
              <div style={{ fontSize: 20, fontWeight: 700, color: scoreColor(bestScore), fontFamily: T.fm }}>
                {bestScore || '-'}
              </div>
              <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 4 }}>
                Best Score
              </div>
            </div>
          </div>
        )}
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
    </div>
  );
}
