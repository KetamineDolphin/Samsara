/* SAMSARA v3.6 - Shared Components */
import T from '../utils/tokens';
import { SITE_COLORS } from '../utils/tokens';

// Samsara symbol — Ouroboros (serpent cycle) + DNA Double Helix
// detail: "full" = all layers, "medium" = serpent + helix, "minimal" = serpent only
export function SamsaraSymbol({ size = 44, detail = "auto", animate = true }) {
  const d = detail === "auto" ? (size >= 64 ? "full" : size >= 40 ? "medium" : "minimal") : detail;
  const anim = (name, dur, delay = 0, extra = "") =>
    animate ? `${name} ${dur}s ease-in-out ${delay}s infinite${extra ? " " + extra : ""}` : "none";

  return (
    <div style={{ position: "relative", width: size, height: size, display: "inline-block" }}>
      {/* Ambient glow */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: size * 1.4, height: size * 1.4, borderRadius: "50%", background: "radial-gradient(circle,rgba(201,168,76,0.06) 0%,transparent 70%)", pointerEvents: "none" }} />
      <svg width={size} height={size} viewBox="0 0 400 400" fill="none" style={{ position: "relative", display: "block" }}>
        <defs>
          <linearGradient id="soBodyG" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.85"/>
            <stop offset="40%" stopColor="#e8d48a" stopOpacity="1"/>
            <stop offset="100%" stopColor="#c9a84c" stopOpacity="0.25"/>
          </linearGradient>
          <linearGradient id="soHeadG" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e8d48a" stopOpacity="0.95"/>
            <stop offset="100%" stopColor="#c9a84c" stopOpacity="0.75"/>
          </linearGradient>
          <linearGradient id="soHelixG" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.25"/>
            <stop offset="50%" stopColor="#e8d48a" stopOpacity="0.7"/>
            <stop offset="100%" stopColor="#c9a84c" stopOpacity="0.25"/>
          </linearGradient>
          <radialGradient id="soInnerG" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.05"/>
            <stop offset="100%" stopColor="#c9a84c" stopOpacity="0"/>
          </radialGradient>
          <filter id="soGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="soSoft"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        {/* === LAYER 0: Outer measurement ring + data dots (full only) === */}
        {d === "full" && (
          <g style={{ animation: anim("samsaraOuterPulse", 12) }}>
            <circle cx="200" cy="200" r="172" fill="none" stroke="rgba(201,168,76,0.05)" strokeWidth="0.6" strokeDasharray="2 6">
              {animate && <animate attributeName="stroke-dashoffset" from="0" to="-32" dur="18s" repeatCount="indefinite"/>}
            </circle>
            {[[200,28],[256,42],[302,74],[332,120],[344,174],[338,230],[316,280],[280,320],[236,346],[188,352],[140,336],[100,304],[72,260],[60,208],[66,154],[88,106],[124,68],[166,44]].map(([cx,cy],i) =>
              <circle key={i} cx={cx} cy={cy} r="1.3" fill="#c9a84c" opacity="0.3"/>
            )}
          </g>
        )}

        {/* === LAYER 1: Inner space glow === */}
        <circle cx="200" cy="200" r="105" fill="url(#soInnerG)" />

        {/* === LAYER 2: The Ouroboros (serpent body + head + eye) === */}
        <g style={{ animation: anim("samsaraBreathe", 8), transformOrigin: "200px 200px" }}>
          {/* Serpent body — organic ensō-style path */}
          <path
            d="M 185 72 C 240 65, 310 100, 318 165 C 326 230, 290 310, 220 325 C 150 340, 72 305, 68 235 C 64 165, 100 100, 148 80"
            fill="none" stroke="url(#soBodyG)" strokeWidth="7" strokeLinecap="round"
            strokeDasharray="4 0 16 0 32 0 16 0 4"
            filter="url(#soGlow)"
          />
          {/* Subtle scale marks along body */}
          {d !== "minimal" && (
            <path
              d="M 185 72 C 240 65, 310 100, 318 165 C 326 230, 290 310, 220 325 C 150 340, 72 305, 68 235 C 64 165, 100 100, 148 80"
              fill="none" stroke="rgba(201,168,76,0.07)" strokeWidth="11"
              strokeLinecap="butt" strokeDasharray="1 14"
            />
          )}
          {/* Serpent head — flared shape at path start, pointing toward tail */}
          <path
            d="M 174 73 C 177 64, 184 58, 192 61 L 190 67 L 190 77 L 192 83 C 184 86, 177 82, 174 73 Z"
            fill="url(#soHeadG)" filter="url(#soGlow)"
          />
          {/* Eye */}
          <circle cx="184" cy="69" r="2.5" fill="#e8d48a" opacity="0.9" filter="url(#soSoft)">
            {animate && <animate attributeName="opacity" values="0.5;1;0.5" dur="4s" repeatCount="indefinite"/>}
          </circle>
          <circle cx="183.5" cy="69" r="1" fill="rgba(15,17,20,0.6)"/>
          {/* Tail tip accent */}
          <circle cx="148" cy="80" r="1.5" fill="#c9a84c" opacity="0.3"/>
        </g>

        {/* === LAYER 3: DNA Double Helix (medium + full) === */}
        {d !== "minimal" && (
          <g style={{ animation: anim("breathe", 7) }} filter="url(#soSoft)">
            {/* Strand A */}
            <path
              d="M 222 118 C 222 146, 178 146, 178 174 S 222 202, 222 230 S 178 258, 178 286"
              stroke="url(#soHelixG)" strokeWidth="2" strokeLinecap="round" fill="none"
            />
            {/* Strand B */}
            <path
              d="M 178 118 C 178 146, 222 146, 222 174 S 178 202, 178 230 S 222 258, 222 286"
              stroke="url(#soHelixG)" strokeWidth="2" strokeLinecap="round" fill="none"
            />
            {/* Base pair rungs */}
            <line x1="192" y1="132" x2="208" y2="132" stroke="#c9a84c" strokeWidth="1" opacity="0.2"/>
            <line x1="180" y1="160" x2="220" y2="160" stroke="#c9a84c" strokeWidth="1" opacity="0.3"/>
            <line x1="180" y1="244" x2="220" y2="244" stroke="#c9a84c" strokeWidth="1" opacity="0.3"/>
            <line x1="192" y1="272" x2="208" y2="272" stroke="#c9a84c" strokeWidth="1" opacity="0.2"/>
            {/* Base pair dots (full only) */}
            {d === "full" && <>
              <circle cx="192" cy="132" r="1.5" fill="#c9a84c" opacity="0.25"/>
              <circle cx="208" cy="132" r="1.5" fill="#c9a84c" opacity="0.25"/>
              <circle cx="180" cy="160" r="1.8" fill="#c9a84c" opacity="0.35"/>
              <circle cx="220" cy="160" r="1.8" fill="#c9a84c" opacity="0.35"/>
              <circle cx="220" cy="244" r="1.8" fill="#c9a84c" opacity="0.35"/>
              <circle cx="180" cy="244" r="1.8" fill="#c9a84c" opacity="0.35"/>
              <circle cx="208" cy="272" r="1.5" fill="#c9a84c" opacity="0.25"/>
              <circle cx="192" cy="272" r="1.5" fill="#c9a84c" opacity="0.25"/>
            </>}
            {/* Crossing point accents */}
            <circle cx="200" cy="146" r="1.5" fill="#e8d48a" opacity="0.4"/>
            <circle cx="200" cy="202" r="1.5" fill="#e8d48a" opacity="0.4"/>
            <circle cx="200" cy="258" r="1.5" fill="#e8d48a" opacity="0.4"/>
          </g>
        )}

        {/* === LAYER 4: Orbiting particle (medium + full) === */}
        {d !== "minimal" && (
          <g style={{ animation: anim("samsaraSpin", 20, 0, "linear"), transformOrigin: "200px 200px" }}>
            <circle cx="200" cy="56" r="2.5" fill="#e8d48a" opacity="0.8" filter="url(#soSoft)"/>
            <circle cx="207" cy="57" r="1" fill="#e8d48a" opacity="0.3"/>
          </g>
        )}
      </svg>
    </div>
  );
}

// Backward compat alias
export function Enso({ size = 44 }) {
  return <SamsaraSymbol size={size} />;
}

export function SyringeVis({ u, max = 100 }) {
  const cl = Math.min(Math.max(u || 0, 0), max), pct = cl / max;
  const bT = 36, bB = 248, bH = bB - bT, fH = pct * bH, fY = bB - fH;
  const ins = fH >= 24, lY = ins ? fY + fH / 2 + 4.5 : fY - 8, lC = ins ? T.t1 : T.gold;
  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const y = bB - (i / 10) * bH, m = i % 5 === 0;
    ticks.push(
      <g key={i}>
        <line x1={m ? 54 : 59} y1={y} x2={68} y2={y} stroke={m ? "rgba(201,168,76,0.22)" : "rgba(240,236,228,0.06)"} strokeWidth={m ? 1.2 : 0.6} />
        {m && <text x={48} y={y + 3.5} textAnchor="end" fill={T.t3} fontSize="10" fontFamily={T.fm}>{i * 10}</text>}
      </g>
    );
  }
  return (
    <svg viewBox="0 0 130 300" style={{ width: "100%", maxWidth: 110, height: "auto" }}>
      <defs>
        <linearGradient id="syF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.amber} stopOpacity="0.85" /><stop offset="100%" stopColor={T.gold} stopOpacity="0.4" /></linearGradient>
        <filter id="syG"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect x="68" y={bT - 3} width="24" height={bH + 6} rx="3" fill="none" stroke="rgba(240,236,228,0.07)" strokeWidth="1.5" />
      <rect x="70" y={bT} width="20" height={bH} rx="1" fill="rgba(255,255,255,0.012)" />
      <rect x="70" y={fY} width="20" height={fH} rx="1" fill="url(#syF)" filter={cl > 0 ? "url(#syG)" : undefined} style={{ transition: "y .5s cubic-bezier(.22,1,.36,1),height .5s cubic-bezier(.22,1,.36,1)" }} />
      <rect x="78" y="6" width="4" height={Math.max(fY - 8, 0)} rx="2" fill="rgba(240,236,228,0.08)" />
      <rect x="70" y="0" width="20" height="8" rx="2.5" fill="rgba(240,236,228,0.1)" />
      <rect x="70" y={Math.max(fY - 3, bT - 3)} width="20" height="5" rx="1.5" fill="rgba(240,236,228,0.13)" style={{ transition: "y .5s cubic-bezier(.22,1,.36,1)" }} />
      {ticks}
      <path d={`M76 ${bB + 3}L84 ${bB + 3}L82 ${bB + 15}L78 ${bB + 15}Z`} fill="rgba(240,236,228,0.06)" />
      <line x1="80" y1={bB + 15} x2="80" y2="292" stroke="rgba(201,168,76,0.2)" strokeWidth="1" strokeLinecap="round" />
      {cl > 0 && <text x="80" y={lY} textAnchor="middle" fill={lC} fontSize="11" fontWeight="500" fontFamily={T.fm} style={{ transition: "y .5s cubic-bezier(.22,1,.36,1)" }}>{cl.toFixed(1)}u</text>}
    </svg>
  );
}

// Injection site body map - front view SVG
export function BodyMap({ siteHistory, onTapSite, suggestedSite, siteAnalysis }) {
  const recentCounts = {};
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  (siteHistory || []).filter(s => s.date >= cutoffStr).forEach(s => {
    recentCounts[s.siteId] = (recentCounts[s.siteId] || 0) + 1;
  });

  const getAnalysisColor = (id) => {
    if (!siteAnalysis || !siteAnalysis[id]) return SITE_COLORS[id] || T.gold;
    const a = siteAnalysis[id];
    if (a.status === 'rest' || a.avgQuality <= 1) return 'rgba(220,80,80,0.7)';
    if (a.avgQuality <= 2) return 'rgba(255,180,50,0.7)';
    if (a.avgQuality <= 3) return 'rgba(201,168,76,0.7)';
    return 'rgba(0,210,180,0.7)';
  };

  const siteOpacity = (id) => {
    if (siteAnalysis && siteAnalysis[id]) {
      const uses = siteAnalysis[id].recentUses || 0;
      if (uses >= 5) return 1.0;
      if (uses >= 3) return 0.7;
      if (uses >= 1) return 0.4;
      return 0.15;
    }
    const count = recentCounts[id] || 0;
    if (count >= 5) return 1.0;
    if (count >= 3) return 0.7;
    if (count >= 1) return 0.4;
    return 0.15;
  };

  const siteStroke = (id) => {
    if (suggestedSite && suggestedSite.id === id) return T.gold;
    if (siteAnalysis && siteAnalysis[id] && siteAnalysis[id].status === 'rest') return 'rgba(220,80,80,0.8)';
    const count = recentCounts[id] || 0;
    if (count >= 5) return 'rgba(220,80,80,0.8)';
    return 'transparent';
  };

  const siteStrokeWidth = (id) => {
    if (suggestedSite && suggestedSite.id === id) return 2;
    if (siteAnalysis && siteAnalysis[id] && siteAnalysis[id].status === 'rest') return 2.5;
    return 1;
  };

  const sites = [
    { id: 'abdomen_left', cx: 78, cy: 155, rx: 18, ry: 14 },
    { id: 'abdomen_right', cx: 122, cy: 155, rx: 18, ry: 14 },
    { id: 'delt_left', cx: 52, cy: 85, rx: 12, ry: 10 },
    { id: 'delt_right', cx: 148, cy: 85, rx: 12, ry: 10 },
    { id: 'thigh_left', cx: 82, cy: 220, rx: 16, ry: 20 },
    { id: 'thigh_right', cx: 118, cy: 220, rx: 16, ry: 20 },
    { id: 'love_handle_left', cx: 62, cy: 145, rx: 10, ry: 12 },
    { id: 'love_handle_right', cx: 138, cy: 145, rx: 10, ry: 12 },
  ];

  const isSuggested = (id) => suggestedSite && suggestedSite.id === id;

  return (
    <svg viewBox="0 0 200 280" style={{ width: '100%', maxWidth: 260, height: 'auto' }}>
      <defs>
        <style>{`
          @keyframes pulseGlow {
            0%, 100% { opacity: 0.18; }
            50% { opacity: 0.38; }
          }
        `}</style>
      </defs>
      {/* Body outline */}
      <ellipse cx="100" cy="30" rx="18" ry="22" fill="none" stroke="rgba(240,236,228,0.1)" strokeWidth="1.5" />
      <path d="M82 50 L70 80 L55 75 L50 90 L60 95 L65 110 L62 180 L70 260 L90 260 L95 180 L100 170 L105 180 L110 260 L130 260 L138 180 L135 110 L140 95 L150 90 L145 75 L130 80 L118 50 Z"
        fill="none" stroke="rgba(240,236,228,0.08)" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Injection sites */}
      {sites.map(s => (
        <g key={s.id}>
          {/* Pulsing glow behind suggested site */}
          {isSuggested(s.id) && (
            <ellipse cx={s.cx} cy={s.cy} rx={s.rx + 6} ry={s.ry + 6}
              fill={T.gold} opacity="0.18"
              style={{ animation: 'pulseGlow 2s ease-in-out infinite', pointerEvents: 'none' }} />
          )}
          <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry}
            fill={getAnalysisColor(s.id)} opacity={siteOpacity(s.id)}
            stroke={siteStroke(s.id)} strokeWidth={siteStrokeWidth(s.id)}
            style={{ cursor: 'pointer', transition: 'all .3s' }}
            onClick={() => onTapSite && onTapSite(s.id)} />
        </g>
      ))}
      {/* Legend: count labels */}
      {sites.map(s => {
        const count = (siteAnalysis && siteAnalysis[s.id])
          ? (siteAnalysis[s.id].recentUses || 0)
          : (recentCounts[s.id] || 0);
        if (count === 0) return null;
        return (
          <text key={s.id + '_label'} x={s.cx} y={s.cy + 4} textAnchor="middle"
            fill={count >= 5 ? 'rgba(220,80,80,0.9)' : T.t1} fontSize="10" fontWeight="600" fontFamily={T.fm}
            style={{ pointerEvents: 'none' }}>
            {count}
          </text>
        );
      })}
    </svg>
  );
}

export const TabIcons = {
  CALC: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="10" y2="10" /><line x1="14" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="10" y2="14" /><line x1="14" y1="14" x2="16" y2="14" /><line x1="8" y1="18" x2="16" y2="18" /></svg>,
  TRACK: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /><circle cx="12" cy="12" r="3" /></svg>,
  BODY: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="5" r="3" /><path d="M12 8v5M8 21l2-8M16 21l-2-8M7 11h10" /></svg>,
  METRICS: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12" /></svg>,
  PROFILE: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0112 0v1" /></svg>,
};

// Icons for timing groups (morning / midday / evening / weekly) —
// Replace the old Unicode glyphs that rendered inconsistently across platforms.
export const TimingIcons = {
  morning: (c = 'currentColor', size = 14) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  midday: (c = 'currentColor', size = 14) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 3v1M12 20v1M3 12h1M20 12h1M5.6 5.6l.7.7M17.7 17.7l.7.7M5.6 18.4l.7-.7M17.7 6.3l.7-.7" />
    </svg>
  ),
  evening: (c = 'currentColor', size = 14) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  weekly: (c = 'currentColor', size = 14) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
};
