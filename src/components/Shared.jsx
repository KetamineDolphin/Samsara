/* SAMSARA v3.0 - Shared Components */
import T from '../utils/tokens';
import { SITE_COLORS } from '../utils/tokens';

// Unified Samsara symbol — Living Enso + Eternal Wheel + Lotus Mandala
// detail: "full" = all layers, "medium" = enso + petals + center, "minimal" = enso + center
export function SamsaraSymbol({ size = 44, detail = "auto", animate = true }) {
  const d = detail === "auto" ? (size >= 64 ? "full" : size >= 40 ? "medium" : "minimal") : detail;
  const anim = (name, dur, delay = 0, extra = "") =>
    animate ? `${name} ${dur}s ease-in-out ${delay}s infinite${extra ? " " + extra : ""}` : "none";

  return (
    <div style={{ position: "relative", width: size, height: size, display: "inline-block" }}>
      {/* Ambient glow */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: size * 1.5, height: size * 1.5, borderRadius: "50%", background: "radial-gradient(circle,rgba(201,168,76,0.07) 0%,transparent 70%)", pointerEvents: "none" }} />
      <svg width={size} height={size} viewBox="0 0 400 400" fill="none" style={{ position: "relative", display: "block" }}>
        <defs>
          <linearGradient id="sEnsoG" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.85"/>
            <stop offset="45%" stopColor="#e8d48a" stopOpacity="1"/>
            <stop offset="100%" stopColor="#c9a84c" stopOpacity="0.3"/>
          </linearGradient>
          <linearGradient id="sSpokeG" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.05"/>
            <stop offset="50%" stopColor="#c9a84c" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="#c9a84c" stopOpacity="0.05"/>
          </linearGradient>
          <radialGradient id="sCenterG" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.18"/>
            <stop offset="60%" stopColor="#c9a84c" stopOpacity="0.04"/>
            <stop offset="100%" stopColor="#c9a84c" stopOpacity="0"/>
          </radialGradient>
          <filter id="sGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="sSoftGlow"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        {/* === LAYER 0: Outer data-point ring (full only) === */}
        {d === "full" && (
          <g style={{ animation: anim("samsaraOuterPulse", 10) }}>
            {[[200,38],[234,42],[266,52],[294,70],[316,94],[330,122],[338,152],[338,184],[332,216],[318,244],[298,268],[272,288],[244,300],[214,306],[184,306],[156,300],[130,286],[108,266],[90,242],[78,214],[72,184],[72,152],[80,122],[92,96],[110,72],[134,54],[162,42]].map(([cx,cy],i) =>
              <circle key={i} cx={cx} cy={cy} r="1.2" fill="#c9a84c"/>
            )}
          </g>
        )}

        {/* === LAYER 1: Sacred geometry (full only) === */}
        {d === "full" && (
          <g>
            <polygon points="200,110 278,155 278,245 200,290 122,245 122,155" fill="none" stroke="rgba(201,168,76,0.04)" strokeWidth="0.6"/>
            <polygon points="200,130 258,165 258,235 200,270 142,235 142,165" fill="none" stroke="rgba(201,168,76,0.03)" strokeWidth="0.5"/>
          </g>
        )}

        {/* === LAYER 2: Eternal Wheel spokes (full + medium) === */}
        {d !== "minimal" && (
          <g style={{ animation: anim("samsaraSpin", 90, 0, "linear"), transformOrigin: "200px 200px" }}>
            {/* 8 spokes */}
            <line x1="200" y1="80"  x2="200" y2="148" stroke="url(#sSpokeG)" strokeWidth="1"/>
            <line x1="200" y1="252" x2="200" y2="320" stroke="url(#sSpokeG)" strokeWidth="1"/>
            <line x1="80"  y1="200" x2="148" y2="200" stroke="url(#sSpokeG)" strokeWidth="1"/>
            <line x1="252" y1="200" x2="320" y2="200" stroke="url(#sSpokeG)" strokeWidth="1"/>
            <line x1="115" y1="115" x2="158" y2="158" stroke="url(#sSpokeG)" strokeWidth="1"/>
            <line x1="242" y1="242" x2="285" y2="285" stroke="url(#sSpokeG)" strokeWidth="1"/>
            <line x1="285" y1="115" x2="242" y2="158" stroke="url(#sSpokeG)" strokeWidth="1"/>
            <line x1="158" y1="242" x2="115" y2="285" stroke="url(#sSpokeG)" strokeWidth="1"/>
            {/* 8 nodes */}
            <circle cx="200" cy="76"  r="2.5" fill="#c9a84c" opacity="0.45"/>
            <circle cx="200" cy="324" r="2.5" fill="#c9a84c" opacity="0.45"/>
            <circle cx="76"  cy="200" r="2.5" fill="#c9a84c" opacity="0.45"/>
            <circle cx="324" cy="200" r="2.5" fill="#c9a84c" opacity="0.45"/>
            <circle cx="112" cy="112" r="2" fill="#c9a84c" opacity="0.3"/>
            <circle cx="288" cy="112" r="2" fill="#c9a84c" opacity="0.3"/>
            <circle cx="112" cy="288" r="2" fill="#c9a84c" opacity="0.3"/>
            <circle cx="288" cy="288" r="2" fill="#c9a84c" opacity="0.3"/>
          </g>
        )}

        {/* === LAYER 3: The Living Enso === */}
        <g style={{ animation: anim("samsaraBreathe", 7), transformOrigin: "200px 200px" }} filter="url(#sGlow)">
          <path d="M 185 72 C 240 65, 310 100, 318 165 C 326 230, 290 310, 220 325 C 150 340, 72 305, 68 235 C 64 165, 100 100, 148 80"
            fill="none" stroke="url(#sEnsoG)" strokeWidth="5.5" strokeLinecap="round"
            strokeDasharray="3 0 12 0 25 0 12 0 3"/>
          {/* Brush tail */}
          <line x1="150" y1="79" x2="156" y2="74" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
          {/* Brush head */}
          <line x1="183" y1="73" x2="178" y2="69" stroke="#e8d48a" strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
        </g>

        {/* Whisper echo ring */}
        {d !== "minimal" && (
          <circle cx="200" cy="200" r="136" fill="none" stroke="rgba(201,168,76,0.04)" strokeWidth="0.6" strokeDasharray="4 8">
            {animate && <animate attributeName="stroke-dashoffset" from="0" to="-48" dur="20s" repeatCount="indefinite"/>}
          </circle>
        )}

        {/* === LAYER 4: Orbiting particle === */}
        {d !== "minimal" && (
          <g style={{ animation: anim("samsaraSpin", 15, 0, "linear"), transformOrigin: "200px 200px" }}>
            <circle cx="200" cy="64" r="2.2" fill="#e8d48a" opacity="0.9" filter="url(#sSoftGlow)"/>
            <circle cx="212" cy="65" r="1" fill="#e8d48a" opacity="0.4"/>
            <circle cx="188" cy="66" r="0.7" fill="#e8d48a" opacity="0.25"/>
          </g>
        )}

        {/* === LAYER 5: Lotus petals === */}
        {d !== "minimal" && (
          <g filter="url(#sSoftGlow)">
            <path d="M 200 186 Q 196 155 200 128 Q 204 155 200 186" fill="none" stroke="#c9a84c" strokeWidth="1.3" opacity="0.6" style={{ animation: anim("samsaraPetal", 9), transformOrigin: "200px 200px" }}/>
            <path d="M 212 192 Q 236 168 260 148 Q 240 172 212 192" fill="none" stroke="#c9a84c" strokeWidth="1.3" opacity="0.5" style={{ animation: anim("samsaraPetal", 9, 1.5), transformOrigin: "200px 200px" }}/>
            <path d="M 212 208 Q 238 228 258 252 Q 236 232 212 208" fill="none" stroke="#c9a84c" strokeWidth="1.3" opacity="0.45" style={{ animation: anim("samsaraPetal", 9, 3), transformOrigin: "200px 200px" }}/>
            <path d="M 200 214 Q 204 245 200 272 Q 196 245 200 214" fill="none" stroke="#c9a84c" strokeWidth="1.3" opacity="0.45" style={{ animation: anim("samsaraPetal", 9, 4.5), transformOrigin: "200px 200px" }}/>
            <path d="M 188 208 Q 164 228 142 252 Q 162 232 188 208" fill="none" stroke="#c9a84c" strokeWidth="1.3" opacity="0.5" style={{ animation: anim("samsaraPetal", 9, 6), transformOrigin: "200px 200px" }}/>
            <path d="M 188 192 Q 164 168 140 148 Q 160 172 188 192" fill="none" stroke="#c9a84c" strokeWidth="1.3" opacity="0.6" style={{ animation: anim("samsaraPetal", 9, 7.5), transformOrigin: "200px 200px" }}/>
          </g>
        )}

        {/* === LAYER 6: The Bindu (center seed) === */}
        <circle cx="200" cy="200" r="44" fill="url(#sCenterG)"/>
        {d !== "minimal" && <circle cx="200" cy="200" r="10" fill="none" stroke="rgba(201,168,76,0.2)" strokeWidth="0.8"/>}
        {/* Breathing halo */}
        <circle cx="200" cy="200" r="8" fill="none" stroke="rgba(201,168,76,0.12)" strokeWidth="0.5">
          {animate && <><animate attributeName="r" values="8;14;8" dur="6s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0;1" dur="6s" repeatCount="indefinite"/></>}
        </circle>
        {/* Seed pulse */}
        <circle cx="200" cy="200" r="3" fill="#c9a84c" opacity="0.7">
          {animate && <><animate attributeName="r" values="2.5;4;2.5" dur="5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0.9;0.5" dur="5s" repeatCount="indefinite"/></>}
        </circle>
        <circle cx="200" cy="200" r="1.2" fill="#e8d48a" opacity="0.95"/>
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
