/* SAMSARA v3.2 - TrackTab with timing groups, sites, vial freshness, escalation, tissue quality, timeline */
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import T from '../utils/tokens';
import S from '../utils/styles';
import { CAT_C } from '../utils/tokens';
import { TIMING_GROUPS, FREQ_META } from '../data/library';
import { getToday, getNow, fmtDose, daysNextWeekly, getWeekStart, concOf, unitsOf, usableDoses, vialAge, vialFreshness, suggestNextSite, getEscalationStatus, makeId, SITE_LIST } from '../utils/helpers';
import { BodyMap } from '../components/Shared';
import BodyModel3D from '../components/BodyModel3D';
import LIB from '../data/library';
import { analyzeStack } from '../data/interactions';
import { getAdherenceStats } from '../data/analytics';

/* ── Tissue quality analysis ─────────────────────────── */
function analyzeSites(siteHistory) {
  const result = {};
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  SITE_LIST.forEach(site => {
    const siteLogs = (siteHistory || []).filter(s => s.siteId === site.id);
    const recent = siteLogs.filter(s => s.date >= cutoffStr);
    const recentUses = recent.length;

    // Avg quality from last 5 entries
    const lastFive = [...siteLogs].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)).slice(0, 5);
    const avgQuality = lastFive.length > 0
      ? lastFive.reduce((sum, l) => sum + (l.tissueQuality || 3), 0) / lastFive.length
      : 3;

    // Trend: compare last 3 vs previous 3
    const last3 = lastFive.slice(0, 3);
    const prev3 = lastFive.slice(3);
    let qualityTrend = 'stable';
    if (last3.length >= 2 && prev3.length >= 1) {
      const recentAvg = last3.reduce((s, l) => s + (l.tissueQuality || 3), 0) / last3.length;
      const prevAvg = prev3.reduce((s, l) => s + (l.tissueQuality || 3), 0) / prev3.length;
      if (recentAvg > prevAvg + 0.3) qualityTrend = 'improving';
      else if (recentAvg < prevAvg - 0.3) qualityTrend = 'declining';
    }

    // Status
    let status = 'ok', label = 'OK', color = T.t2, message = 'Normal tissue quality.';
    if (avgQuality < 2.5 || (avgQuality < 3 && recentUses >= 4)) {
      status = 'rest'; label = 'Rest Required'; color = 'rgba(220,80,80,0.8)';
      message = 'Tissue quality poor. Rest this site for at least 7 days.';
    } else if (recentUses >= 5) {
      status = 'overused'; label = 'Overused'; color = T.amber;
      message = 'High frequency use. Rotate to other sites.';
    } else if (avgQuality >= 4 && recentUses <= 2) {
      status = 'fresh'; label = 'Fresh'; color = T.green;
      message = 'Good tissue quality. Optimal for injection.';
    }

    // Last used
    const lastLog = siteLogs.length > 0 ? [...siteLogs].sort((a, b) => b.date.localeCompare(a.date))[0] : null;
    const daysSinceLast = lastLog ? Math.floor((new Date() - new Date(lastLog.date + 'T12:00:00')) / 86400000) : null;

    result[site.id] = { status, label, color, message, avgQuality, recentUses, qualityTrend, daysSinceLast, lastLog };
  });
  return result;
}

/* ── Quality rating config ─────────────────────────── */
const QUALITY_OPTIONS = [
  { value: 1, label: 'Painful/Lump', color: 'rgba(220,80,80,0.8)' },
  { value: 2, label: 'Tender', color: T.amber },
  { value: 3, label: 'Normal', color: T.t2 },
  { value: 4, label: 'Good', color: T.green },
  { value: 5, label: 'Perfect', color: T.teal },
];

const TREND_ARROWS = { improving: '\u2191', declining: '\u2193', stable: '\u2192' };
const TREND_COLORS = { improving: T.green, declining: 'rgba(220,80,80,0.8)', stable: T.t3 };

/* ── RetaCard (unchanged) ─────────────────────────── */
function RetaCard({ compound, logged, onLog }) {
  const dn = daysNextWeekly();
  const dayOfWeek = new Date().getDay();
  const esc = compound.escalation;
  const escStatus = getEscalationStatus(compound);
  const history = esc ? esc.protocol.slice(0, esc.currentStep + 1) : [];

  return (
    <div style={{ ...S.card, borderColor: logged ? 'rgba(92,184,112,0.15)' : T.goldM + '30', padding: '16px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: T.t1, fontFamily: T.fb }}>Retatrutide</span>
        <span style={{ fontSize: 10, color: T.gold, fontFamily: T.fm, letterSpacing: 1 }}>WEEKLY</span>
      </div>
      <div style={{ fontSize: 13, color: T.t2, fontFamily: T.fm, marginBottom: 10 }}>Current dose: <span style={{ color: T.gold }}>{compound.dose} {compound.unit}</span></div>
      {/* Week progress */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>{[0, 1, 2, 3, 4, 5, 6].map(d => <div key={d} style={{ flex: 1, height: 6, borderRadius: 3, background: d < dayOfWeek ? 'rgba(201,168,76,0.3)' : d === dayOfWeek ? T.gold : 'rgba(255,255,255,0.04)' }} />)}</div>
      <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginBottom: 10 }}>{dayOfWeek} of 7 days</div>
      {/* Escalation timeline */}
      {history.length > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {history.map((s, i) => <span key={i} style={{ fontSize: 11, fontFamily: T.fm, color: i === history.length - 1 ? T.gold : T.t3 }}>{s}{i === history.length - 1 ? ' \u2190 NOW' : ''}{i < history.length - 1 ? ' \u2192' : ''}</span>)}
      </div>}
      {/* Escalation status */}
      {escStatus && <div style={{ fontSize: 11, color: escStatus.canStep ? T.amber : T.t3, fontFamily: T.fm, marginBottom: 8 }}>
        {escStatus.canStep ? '\u2191 Ready to escalate to ' + escStatus.nextDose + ' ' + compound.unit : escStatus.label}
      </div>}
      {compound.nextPlanned && <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginBottom: 12 }}>Next planned: <span style={{ color: T.amber }}>{compound.nextPlanned} {compound.unit}</span></div>}
      <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginBottom: 12 }}>Next: <span style={{ color: T.t2 }}>Sunday</span> {'\u00B7'} {dn}d away</div>
      {logged ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '8px 0' }}><span style={{ color: '#5cb870', fontSize: 18, animation: 'checkSpring .4s cubic-bezier(.34,1.56,.64,1) both', display: 'inline-block' }}>{'\u2713'}</span><span style={{ fontSize: 12, color: '#5cb870', fontFamily: T.fm }}>Logged {logged.time}</span></div>
        : <button onClick={() => { if (navigator.vibrate) navigator.vibrate(40); onLog(compound); }} style={{ ...S.logBtn, width: '100%', padding: '10px', textAlign: 'center' }} onTouchStart={e => e.currentTarget.style.animation = 'logPress .3s ease both'} onAnimationEnd={e => e.currentTarget.style.animation = ''}>Log This Week's Dose</button>}
    </div>
  );
}

/* ── TodayView with site alert banners ─────────────────────────── */
const ROUTE_LABELS = { subq: 'SubQ', im: 'IM', oral: 'Oral', topical: 'Topical', intranasal: 'Nasal', iv: 'IV' };
const ROUTE_ICONS = { subq: '\uD83D\uDC89', im: '\uD83D\uDC89', oral: '\uD83D\uDC8A', topical: '\u2728', intranasal: '\uD83D\uDCA8', iv: '\uD83C\uDFE5' };

function TodayView({ logs, onLog, stack, onOpenSites, siteAnalysis, onQuickCheckin }) {
  const t = getToday();
  const [routePickerId, setRoutePickerId] = useState(null);
  const [now, setNow] = useState(Date.now());
  // Refresh timers every 60s
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(iv); }, []);
  // Streak + adherence
  const adherence = useMemo(() => getAdherenceStats(logs, stack, 90), [logs, stack]);
  // Half-life helper: time since last dose for each compound
  const lastDoseMap = useMemo(() => {
    const map = {};
    stack.forEach(c => {
      const cLogs = logs.filter(l => l.cid === c.id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
      if (cLogs.length > 0) {
        const last = cLogs[0];
        const dt = new Date(last.date + 'T' + (last.time || '12:00') + ':00');
        if (!isNaN(dt.getTime())) map[c.id] = dt.getTime();
      }
    });
    return map;
  }, [logs, stack, now]);
  const groups = {};
  TIMING_GROUPS.forEach(g => { groups[g.id] = []; });
  stack.forEach(c => {
    const group = c.timingGroup || 'morning';
    if (!groups[group]) groups[group] = [];
    groups[group].push(c);
  });

  // Compute interaction insights for the whole stack
  const stackAnalysis = useMemo(() => stack.length > 1 ? analyzeStack(stack, LIB) : null, [stack]);
  // Build per-compound interaction map: compoundLibId → relevant notes
  const interactionMap = useMemo(() => {
    if (!stackAnalysis) return {};
    const map = {};
    const addNote = (libId, item) => { if (!map[libId]) map[libId] = []; map[libId].push(item); };
    stackAnalysis.synergies.forEach(s => { addNote(s.from, { type: 'synergy', note: s.note }); });
    stackAnalysis.warnings.forEach(w => { addNote(w.from, { type: w.type, severity: w.severity, note: w.note }); });
    stackAnalysis.timingNotes.forEach(t => { addNote(t.from, { type: 'timing', note: t.note }); });
    return map;
  }, [stackAnalysis]);

  // Derive site alerts from analysis
  const restSites = [];
  const overusedSites = [];
  let suggestedSite = null;
  if (siteAnalysis) {
    SITE_LIST.forEach(s => {
      const a = siteAnalysis[s.id];
      if (!a) return;
      if (a.status === 'rest') restSites.push(s);
      else if (a.status === 'overused') overusedSites.push(s);
      if (!suggestedSite && a.status === 'fresh') suggestedSite = s;
    });
    if (!suggestedSite) {
      // Fallback: pick first ok site
      const okSite = SITE_LIST.find(s => siteAnalysis[s.id] && siteAnalysis[s.id].status === 'ok');
      suggestedSite = okSite || null;
    }
  }

  return (
    <div style={{ animation: 'fadeUp .4s ease both' }}>
      {/* Site alert banners */}
      {restSites.length > 0 && (
        <div style={{ background: 'rgba(220,80,80,0.1)', border: '1px solid rgba(220,80,80,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>{'\u26A0'}</span>
          <span style={{ fontSize: 11, color: 'rgba(220,80,80,0.9)', fontFamily: T.fm }}>Rest required: {restSites.map(s => s.label).join(', ')}</span>
        </div>
      )}
      {overusedSites.length > 0 && (
        <div style={{ background: 'rgba(255,180,50,0.08)', border: '1px solid rgba(255,180,50,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>{'\u21BB'}</span>
          <span style={{ fontSize: 11, color: T.amber, fontFamily: T.fm }}>Overused: {overusedSites.map(s => s.label).join(', ')}</span>
        </div>
      )}
      {suggestedSite && (
        <div style={{ background: T.goldS, border: '1px solid ' + T.goldM, borderRadius: 8, padding: '8px 12px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>{'\u2736'}</span>
          <span style={{ fontSize: 11, color: T.gold, fontFamily: T.fm }}>Suggested site today: <span style={{ fontWeight: 600 }}>{suggestedSite.label}</span></span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontFamily: T.fd, fontSize: 18, fontWeight: 300, color: T.t2, letterSpacing: 1 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <div style={{ display: 'flex', gap: 6 }}>
          {onQuickCheckin && <button onClick={onQuickCheckin} style={{ ...S.pill, fontSize: 10, padding: '4px 10px', borderColor: 'rgba(0,210,180,0.3)', color: T.teal }}>Check-in {'\u2192'}</button>}
          <button onClick={onOpenSites} style={{ ...S.pill, fontSize: 10, padding: '4px 10px', borderColor: T.goldM, color: T.gold }}>Sites</button>
        </div>
      </div>

      {/* Streak banner */}
      {adherence.currentStreak > 0 && (
        <div style={{ ...S.card, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderColor: adherence.currentStreak >= 7 ? 'rgba(201,168,76,0.25)' : 'rgba(92,184,112,0.15)', background: adherence.currentStreak >= 7 ? 'rgba(201,168,76,0.04)' : 'rgba(92,184,112,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{adherence.currentStreak >= 30 ? '\uD83D\uDD25' : adherence.currentStreak >= 7 ? '\uD83D\uDD25' : '\u2B50'}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.t1, fontFamily: T.fb }}>{adherence.currentStreak} day streak</div>
              <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>{adherence.overallPct}% adherence {'\u00B7'} Best: {adherence.longestStreak}d</div>
            </div>
          </div>
          {adherence.currentStreak >= 7 && (
            <div style={{ fontSize: 9, color: T.gold, fontFamily: T.fm, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
              {adherence.currentStreak >= 30 ? 'Legendary' : adherence.currentStreak >= 14 ? 'On Fire' : 'Consistent'}
            </div>
          )}
        </div>
      )}

      {/* Empty state for first-time users */}
      {stack.length === 0 && (
        <div style={{ ...S.card, padding: '20px 16px', textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>{'\u2295'}</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.t1, fontFamily: T.fb, marginBottom: 6 }}>Add Your First Compound</div>
          <div style={{ fontSize: 12, color: T.t3, fontFamily: T.fm, lineHeight: 1.6 }}>Head to the Profile tab and browse the library to add compounds to your stack. They'll appear here ready to log.</div>
        </div>
      )}

      {/* First dose guidance */}
      {stack.length > 0 && logs.length === 0 && (
        <div style={{ ...S.card, padding: '12px 14px', marginBottom: 12, borderColor: 'rgba(0,210,180,0.15)', background: 'rgba(0,210,180,0.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.teal, fontFamily: T.fb, marginBottom: 4 }}>{'\u2139'} Log Your First Dose</div>
          <div style={{ fontSize: 12, color: T.t2, fontFamily: T.fm, lineHeight: 1.6 }}>Tap "Log" after each injection to build your protocol history. Samsara tracks streaks, adherence, and helps you stay consistent.</div>
        </div>
      )}

      {TIMING_GROUPS.map(g => {
        const compounds = groups[g.id];
        if (!compounds || compounds.length === 0) return null;
        return (
          <div key={g.id}>
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 6, marginTop: 8 }}>{g.icon} {g.label}</div>
            {compounds.map(c => {
              const isW = c.frequency === 'weekly';
              const logged = isW ? logs.find(l => l.cid === c.id && l.date >= getWeekStart()) : logs.find(l => l.cid === c.id && l.date === t);
              const cNotes = interactionMap[c.libId] || [];
              if (isW) return <RetaCard key={c.id} compound={c} logged={logged} onLog={onLog} />;
              // Look up library entry for administrationOptions
              const libEntry = LIB.find(l => l.id === c.libId) || {};
              const routes = libEntry.administrationOptions || [];
              const hasMultiRoute = routes.length > 1;
              const showingRoutes = routePickerId === c.id;
              const halfLife = libEntry.halfLifeHours || 0;
              const lastDoseTs = lastDoseMap[c.id];
              const hoursSince = lastDoseTs ? (now - lastDoseTs) / 3600000 : null;
              // Status: active (< 1 half-life), clearing (1-2), cleared (>2)
              const doseStatus = hoursSince != null && halfLife > 0
                ? hoursSince < halfLife ? 'active' : hoursSince < halfLife * 2 ? 'clearing' : 'cleared'
                : null;
              const peakMin = libEntry.peakPlasmaMinutes || 0;
              const minSince = hoursSince != null ? hoursSince * 60 : null;
              const isPeaking = peakMin > 0 && minSince != null && minSince < peakMin * 1.5 && minSince > 0 && logged;
              return (
                <div key={c.id}>
                  <div style={{ ...S.trackRow, ...(logged ? { borderColor: 'rgba(92,184,112,0.15)' } : {}) }} onTouchStart={e => e.currentTarget.style.background = 'rgba(255,255,255,0.035)'} onTouchEnd={e => e.currentTarget.style.background = ''}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.trackName}>{c.name}</div>
                      <div style={S.trackMeta}>
                        {fmtDose(c)} {'\u00B7'} {unitsOf(c).toFixed(1)}u
                        {logged && logged.route ? ` \u00B7 ${ROUTE_LABELS[logged.route] || logged.route}` : ''}
                        {logged && isPeaking && <span style={{ color: T.teal }}> {'\u00B7'} peaking</span>}
                        {logged && doseStatus === 'active' && !isPeaking && <span style={{ color: '#5cb870' }}> {'\u00B7'} active</span>}
                        {!logged && hoursSince != null && <span style={{ color: doseStatus === 'cleared' ? T.t3 : T.amber }}> {'\u00B7'} {hoursSince < 1 ? Math.round(hoursSince * 60) + 'm ago' : hoursSince < 24 ? Math.round(hoursSince) + 'h ago' : Math.round(hoursSince / 24) + 'd ago'}</span>}
                      </div>
                    </div>
                    {logged ? (
                      <div style={S.loggedBadge}>
                        <span style={{ animation: 'checkSpring .4s cubic-bezier(.34,1.56,.64,1) both', display: 'inline-block', color: '#5cb870', fontSize: 18 }}>{'\u2713'}</span>
                        <span style={{ fontSize: 9, color: '#5cb870', fontFamily: T.fm }}>{logged.time}</span>
                      </div>
                    ) : (
                      <button onClick={() => {
                        if (hasMultiRoute) { setRoutePickerId(showingRoutes ? null : c.id); }
                        else { if (navigator.vibrate) navigator.vibrate(40); onLog(c); }
                      }} style={S.logBtn} onTouchStart={e => e.currentTarget.style.animation = 'logPress .3s ease both'} onAnimationEnd={e => e.currentTarget.style.animation = ''}>
                        Log
                      </button>
                    )}
                  </div>
                  {/* Route picker for multi-route compounds */}
                  {showingRoutes && !logged && (
                    <div style={{ display: 'flex', gap: 6, padding: '6px 12px 10px', animation: 'fadeUp .2s ease both' }}>
                      {routes.map(route => (
                        <button key={route} onClick={() => {
                          if (navigator.vibrate) navigator.vibrate(40);
                          onLog(c, route);
                          setRoutePickerId(null);
                        }} style={{
                          flex: 1, padding: '8px 6px', background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${T.goldM}`, borderRadius: 10, cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                        }}>
                          <span style={{ fontSize: 14 }}>{ROUTE_ICONS[route] || '\uD83D\uDC89'}</span>
                          <span style={{ fontSize: 11, color: T.gold, fontFamily: T.fm, fontWeight: 500 }}>{ROUTE_LABELS[route] || route}</span>
                        </button>
                      ))}
                      <button onClick={() => setRoutePickerId(null)} style={{
                        padding: '8px 10px', background: 'rgba(255,255,255,0.02)',
                        border: `1px solid ${T.border}`, borderRadius: 10, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 12, color: T.t3 }}>{'\u2715'}</span>
                      </button>
                    </div>
                  )}
                  {/* Interaction notes shown at log time */}
                  {!logged && cNotes.length > 0 && (
                    <div style={{ marginTop: -4, marginBottom: 8, paddingLeft: 12, paddingRight: 12 }}>
                      {cNotes.slice(0, 2).map((n, i) => {
                        const isGood = n.type === 'synergy';
                        const isDanger = n.severity === 'danger' || n.type === 'conflict';
                        const icon = isGood ? '\u25CF' : isDanger ? '\u25CF' : '\u25CF';
                        const color = isGood ? '#5cb870' : isDanger ? 'rgba(220,80,80,0.85)' : T.amber;
                        return <div key={i} style={{ fontSize: 11, color, fontFamily: T.fm, lineHeight: 1.5, padding: '2px 0', display: 'flex', gap: 6, alignItems: 'flex-start' }}><span style={{ fontSize: 6, marginTop: 5, flexShrink: 0 }}>{icon}</span><span>{n.note}</span></div>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ── VialsView (unchanged) ─────────────────────────── */
function VialsView({ vials, logs, onNewVial, stack }) {
  const [confirmId, setConfirmId] = useState(null);
  const timerRef = useRef(null);
  const handleNew = (id) => {
    if (confirmId === id) { onNewVial(id); setConfirmId(null); clearTimeout(timerRef.current); return; }
    setConfirmId(id); timerRef.current = setTimeout(() => setConfirmId(null), 3000);
  };
  return (
    <div style={{ animation: 'fadeUp .4s ease both' }}>{stack.map(c => {
      const cn = concOf(c), tot = usableDoses(c), vial = vials[c.id] || { startDate: getToday(), reconDate: getToday() };
      const used = logs.filter(l => l.cid === c.id && l.date >= vial.startDate).length;
      const rem = Math.max(tot - used, 0), pct = tot > 0 ? used / tot : 0;
      const pd = c.frequency === 'weekly' ? 1 / 7 : c.frequency === '2x_week' ? 2 / 7 : 1;
      const dl = pd > 0 ? rem / pd : 0; const isConf = confirmId === c.id;
      const fresh = vialFreshness(vial);
      return (
        <div key={c.id} style={S.vialCard}>
          <div style={S.vialHeader}><span style={S.vialName}>{c.name}</span><span style={S.vialConc}>{cn.toFixed(1)} mg/ml</span></div>
          {/* Freshness indicator */}
          <div style={{ fontSize: 10, color: fresh.color, fontFamily: T.fm, marginBottom: 8 }}>{fresh.label}</div>
          <div style={S.barTrack}><div style={{ ...S.barFill, width: `${Math.min(pct * 100, 100)}%`, background: pct > 0.85 ? 'rgba(196,92,74,0.7)' : `linear-gradient(90deg,${T.gold},${T.amber})` }} /></div>
          <div style={S.vialStats}><span>{unitsOf(c).toFixed(1)}u/dose</span><span>{rem.toFixed(0)} left (~5% waste)</span><span>{Math.floor(dl)}d</span></div>
          <button onClick={() => handleNew(c.id)} style={{ ...S.newVialBtn, ...(isConf ? { borderColor: 'rgba(220,80,80,0.5)', color: 'rgba(220,80,80,0.8)' } : {}) }}>{isConf ? '\u26A0 Confirm Reset?' : '\u21BB New Vial'}</button>
        </div>
      );
    })}</div>
  );
}

/* ── SitesView (upgraded with analysis, detail cards, rotation plan) ─────────────────────────── */
function SitesView({ siteHistory, onLogSite, stack, siteAnalysis, siteLogStep, siteLogData, onSiteLogStepAction }) {
  const [expandedSite, setExpandedSite] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const suggested = suggestNextSite(siteHistory);
  const suggestedAnalysis = siteAnalysis ? siteAnalysis[suggested.id] : null;

  // Rotation health: count how many sites are in bad shape
  const restCount = SITE_LIST.filter(s => siteAnalysis && siteAnalysis[s.id]?.status === 'rest').length;
  const overusedCount = SITE_LIST.filter(s => siteAnalysis && siteAnalysis[s.id]?.status === 'overused').length;
  const healthColor = restCount > 0 ? 'rgba(220,80,80,0.8)' : overusedCount >= 3 ? T.amber : T.green;

  // 7-day rotation plan
  const rotationPlan = useMemo(() => {
    if (!siteAnalysis) return [];
    const dailyInjections = stack.filter(c => c.frequency === 'daily' || c.frequency === '2x_day').length || 1;
    const available = SITE_LIST.filter(s => siteAnalysis[s.id]?.status !== 'rest')
      .sort((a, b) => {
        const aA = siteAnalysis[a.id], bA = siteAnalysis[b.id];
        const aScore = (aA?.avgQuality || 3) - (aA?.recentUses || 0) * 0.5;
        const bScore = (bA?.avgQuality || 3) - (bA?.recentUses || 0) * 0.5;
        return bScore - aScore;
      });
    const plan = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayIdx = new Date().getDay();
    for (let d = 0; d < 7; d++) {
      const dayIdx = (todayIdx + d) % 7;
      const sites = [];
      for (let inj = 0; inj < dailyInjections; inj++) {
        const pick = available[(d * dailyInjections + inj) % available.length];
        if (pick) sites.push(pick);
      }
      plan.push({ day: days[dayIdx], isToday: d === 0, sites });
    }
    return plan;
  }, [siteAnalysis, stack]);

  // Quality dots renderer
  const renderQualityDots = (avg) => {
    const dots = [];
    for (let i = 1; i <= 5; i++) {
      const filled = i <= Math.round(avg);
      dots.push(
        <div key={i} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: filled
            ? (avg >= 4 ? T.green : avg >= 3 ? T.gold : avg >= 2 ? T.amber : 'rgba(220,80,80,0.8)')
            : 'rgba(255,255,255,0.06)',
          transition: 'background 0.2s',
        }} />
      );
    }
    return dots;
  };

  return (
    <div style={{ animation: 'fadeUp .4s ease both' }}>
      {/* Header with rotation health */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>Injection Sites</div>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: healthColor, boxShadow: '0 0 6px ' + healthColor }} />
        </div>
        <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>{SITE_LIST.length - restCount} active</span>
      </div>

      {/* Inline site log flow */}
      {siteLogStep && siteLogData && (
        <div style={{ ...S.card, padding: '14px', marginBottom: 12, borderColor: T.goldM + '50' }}>
          <div style={{ fontSize: 11, color: T.gold, fontFamily: T.fm, marginBottom: 8 }}>
            Logging: {SITE_LIST.find(s => s.id === siteLogData.siteId)?.label || siteLogData.siteId}
          </div>

          {siteLogStep === 'compound' && (
            <div>
              <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginBottom: 6 }}>Which compound?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {stack.map(c => (
                  <button key={c.id} onClick={() => onSiteLogStepAction('selectCompound', c.name)} style={{ ...S.pill, fontSize: 10, padding: '5px 10px', borderColor: T.goldM, color: T.t1 }}>{c.name}</button>
                ))}
                <button onClick={() => onSiteLogStepAction('selectCompound', '')} style={{ ...S.pill, fontSize: 10, padding: '5px 10px', borderColor: T.border, color: T.t3 }}>Skip</button>
              </div>
            </div>
          )}

          {siteLogStep === 'quality' && (
            <div>
              <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginBottom: 6 }}>Tissue quality?</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {QUALITY_OPTIONS.map(q => (
                  <button key={q.value} onClick={() => onSiteLogStepAction('selectQuality', q.value)} style={{
                    flex: 1, padding: '8px 2px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid ' + q.color,
                    color: q.color, fontSize: 9, fontFamily: T.fm, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  }}>
                    <span style={{ fontSize: 16 }}>{q.value}</span>
                    <span>{q.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {siteLogStep === 'notes' && (
            <div>
              <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginBottom: 6 }}>Notes (optional)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type='text'
                  placeholder=''
                  value={siteLogData.notes || ''}
                  onChange={e => onSiteLogStepAction('updateNotes', e.target.value)}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid ' + T.border,
                    borderRadius: 6, padding: '8px 10px', color: T.t1, fontSize: 12, fontFamily: T.fm,
                    outline: 'none',
                  }}
                />
                <button onClick={() => onSiteLogStepAction('save')} style={{ ...S.logBtn, padding: '8px 16px' }}>Save</button>
              </div>
            </div>
          )}

          <button onClick={() => onSiteLogStepAction('cancel')} style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Cancel</button>
        </div>
      )}

      {/* Suggested site card */}
      <div style={{ ...S.card, padding: '12px', marginBottom: 12, borderColor: T.goldM + '40' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.gold, fontFamily: T.fb }}>{suggested.label}</div>
            <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginTop: 4 }}>
              {suggestedAnalysis?.daysSinceLast != null ? suggestedAnalysis.daysSinceLast + 'd since last use' : 'Never used'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {suggestedAnalysis && (
              <span style={{
                fontSize: 9, fontFamily: T.fm, padding: '3px 8px', borderRadius: 10,
                background: suggestedAnalysis.color + '18', color: suggestedAnalysis.color, border: '1px solid ' + suggestedAnalysis.color + '30',
              }}>{suggestedAnalysis.label}</span>
            )}
          </div>
        </div>
      </div>

      {/* Body map */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <BodyModel3D
          siteHistory={siteHistory}
          siteAnalysis={siteAnalysis}
          suggestedSite={suggested ? suggested.id : null}
          selectedSite={selectedSite}
          onSiteSelect={(id) => { setSelectedSite(id); onLogSite(id); }}
          width={400}
          height={320}
        />
      </div>

      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 4 }}>Tap a site on the body map to log it</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
        {SITE_LIST.map(s => {
          const a = siteAnalysis ? siteAnalysis[s.id] : null;
          const bc = a ? a.color + '40' : T.border;
          return <button key={s.id} onClick={() => onLogSite(s.id)} style={{ ...S.pill, fontSize: 10, padding: '4px 8px', borderColor: bc }}>{s.label}</button>;
        })}
      </div>

      {/* Site detail cards */}
      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 8, marginTop: 8 }}>All Sites</div>
      {SITE_LIST.map(site => {
        const a = siteAnalysis ? siteAnalysis[site.id] : null;
        if (!a) return null;
        const isExpanded = expandedSite === site.id;
        const isRest = a.status === 'rest';
        const siteLogs = [...(siteHistory || [])].filter(s => s.siteId === site.id).sort((x, y) => y.date.localeCompare(x.date) || y.time.localeCompare(x.time)).slice(0, 10);

        return (
          <div key={site.id} onClick={() => setExpandedSite(isExpanded ? null : site.id)} style={{
            ...S.card, padding: '10px 12px', marginBottom: 6, cursor: 'pointer',
            borderColor: isRest ? 'rgba(220,80,80,0.3)' : T.border,
            ...(isRest ? { background: 'rgba(220,80,80,0.04)' } : {}),
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.t1, fontFamily: T.fb }}>{site.label}</span>
                <span style={{
                  fontSize: 9, fontFamily: T.fm, padding: '2px 7px', borderRadius: 10,
                  background: a.color + '18', color: a.color, border: '1px solid ' + a.color + '30',
                }}>{a.label}</span>
              </div>
              <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>{isExpanded ? '\u25B2' : '\u25BC'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
              <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>
                {a.daysSinceLast != null ? a.daysSinceLast + 'd ago' : 'Never'}
              </span>
              <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>{a.recentUses} in 14d</span>
              <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>{renderQualityDots(a.avgQuality)}</div>
              <span style={{ fontSize: 12, color: TREND_COLORS[a.qualityTrend], fontFamily: T.fm }}>{TREND_ARROWS[a.qualityTrend]}</span>
            </div>

            {isRest && (
              <div style={{ fontSize: 10, color: 'rgba(220,80,80,0.8)', fontFamily: T.fm, marginTop: 6 }}>
                {'\u26A0'} {a.message}
                {a.daysSinceLast != null && a.daysSinceLast < 7 && (
                  <span> ({7 - a.daysSinceLast}d rest remaining)</span>
                )}
              </div>
            )}

            {/* Expanded: last 10 logs */}
            {isExpanded && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid ' + T.border }}>
                <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 6 }}>Recent Logs</div>
                {siteLogs.length === 0 ? (
                  <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm }}>No logs for this site</div>
                ) : siteLogs.map((log, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                    <span style={{ fontSize: 11, color: T.t2, fontFamily: T.fm }}>{log.date}</span>
                    <span style={{ fontSize: 11, color: T.t3, fontFamily: T.fm }}>{log.time}</span>
                    <div style={{ display: 'flex', gap: 2 }}>{renderQualityDots(log.tissueQuality || 3)}</div>
                    {log.compound && <span style={{ fontSize: 9, color: T.gold, fontFamily: T.fm }}>{log.compound}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* 7-day rotation plan */}
      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 8, marginTop: 20 }}>7-Day Rotation Plan</div>
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 8 }}>
        {rotationPlan.map((day, i) => (
          <div key={i} style={{
            ...S.card, padding: '8px 10px', minWidth: 72, textAlign: 'center', flexShrink: 0,
            borderColor: day.isToday ? T.goldM : T.border,
            background: day.isToday ? T.goldS : 'transparent',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: day.isToday ? T.gold : T.t2, fontFamily: T.fm, marginBottom: 4 }}>
              {day.day}{day.isToday ? ' \u2022' : ''}
            </div>
            {day.sites.map((s, j) => (
              <div key={j} style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>{s.label}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Timeline helpers ─────────────────────────── */
function addDaysISO(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
}

function fmtShortDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDayOfWeek(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

/* ── TimelineView ─────────────────────────── */
function TimelineView({ logs, stack, checkins, profile }) {
  const safeLogs = logs || [];
  const safeCheckins = checkins || [];
  const [selectedDay, setSelectedDay] = useState(null);
  const [viewMode, setViewMode] = useState('timeline'); // timeline | heatmap | schedule
  const scrollRef = useRef(null);
  const today = getToday();

  // Build 90-day range centered on today (60 back, 30 forward)
  const timeRange = useMemo(() => {
    const start = addDaysISO(today, -60);
    const end = addDaysISO(today, 30);
    const days = [];
    let cur = start;
    while (cur <= end) {
      days.push(cur);
      cur = addDaysISO(cur, 1);
    }
    return { start, end, days };
  }, [today]);

  // Build log index: date -> [logs]
  const logIndex = useMemo(() => {
    const idx = {};
    safeLogs.forEach(l => {
      if (!idx[l.date]) idx[l.date] = [];
      idx[l.date].push(l);
    });
    return idx;
  }, [safeLogs]);

  // Build checkin index: date -> checkin
  const checkinIndex = useMemo(() => {
    const idx = {};
    safeCheckins.forEach(c => {
      const d = typeof c.date === 'string' ? c.date.slice(0, 10) : '';
      if (d) idx[d] = c;
    });
    return idx;
  }, [safeCheckins]);

  // Expected daily compounds
  const expectedDaily = useMemo(() => {
    return stack.filter(c => c.frequency === 'daily' || c.frequency === '2x_day' || c.frequency === '2x_week');
  }, [stack]);

  const expectedWeekly = useMemo(() => {
    return stack.filter(c => c.frequency === 'weekly');
  }, [stack]);

  // Adherence per day
  const adherenceMap = useMemo(() => {
    const map = {};
    timeRange.days.forEach(day => {
      if (day > today) { map[day] = null; return; } // future
      const dayLogs = logIndex[day] || [];
      const loggedIds = new Set(dayLogs.map(l => l.cid));
      // Daily compounds expected
      const dailyExpected = expectedDaily.filter(c => {
        if (c.frequency === 'weekly') return false;
        if (c.frequency === '2x_week') {
          // Rough: expect on 2 days per week, check if logged this week
          return true;
        }
        return true;
      });
      // Weekly compounds - only expected on their typical day
      const dayOfWeek = new Date(day + 'T12:00:00').getDay();
      const weeklyExpected = dayOfWeek === 0 ? expectedWeekly : [];
      const allExpected = [...dailyExpected, ...weeklyExpected];
      if (allExpected.length === 0) { map[day] = dayLogs.length > 0 ? 1 : null; return; }
      const logged = allExpected.filter(c => loggedIds.has(c.id)).length;
      map[day] = allExpected.length > 0 ? logged / allExpected.length : 0;
    });
    return map;
  }, [timeRange.days, today, logIndex, expectedDaily, expectedWeekly]);

  // Event markers (checkins, vial resets, milestones)
  const events = useMemo(() => {
    const evts = [];
    safeCheckins.forEach(c => {
      const d = typeof c.date === 'string' ? c.date.slice(0, 10) : '';
      if (d && d >= timeRange.start && d <= timeRange.end) {
        evts.push({ date: d, type: 'checkin', label: 'Body check-in', icon: '\u2606' });
      }
    });
    // Detect first log per compound (start events)
    const firstLogByCompound = {};
    safeLogs.forEach(l => {
      if (!firstLogByCompound[l.cid] || l.date < firstLogByCompound[l.cid]) {
        firstLogByCompound[l.cid] = l.date;
      }
    });
    Object.entries(firstLogByCompound).forEach(([cid, date]) => {
      if (date >= timeRange.start && date <= timeRange.end) {
        const c = stack.find(s => s.id === cid);
        evts.push({ date, type: 'start', label: (c ? c.name : cid) + ' started', icon: '\u25B6' });
      }
    });
    return evts;
  }, [safeCheckins, safeLogs, stack, timeRange]);

  // Event index
  const eventIndex = useMemo(() => {
    const idx = {};
    events.forEach(e => {
      if (!idx[e.date]) idx[e.date] = [];
      idx[e.date].push(e);
    });
    return idx;
  }, [events]);

  // Cycle tracker: weeks since profile.startDate
  const cycleWeek = useMemo(() => {
    if (!profile?.startDate) return null;
    const days = daysBetween(profile.startDate, today);
    return Math.floor(days / 7) + 1;
  }, [profile, today]);

  // Scroll to today on mount
  useEffect(() => {
    if (scrollRef.current && viewMode === 'timeline') {
      const todayIdx = timeRange.days.indexOf(today);
      if (todayIdx >= 0) {
        const scrollPos = todayIdx * 44 - 150; // center-ish
        scrollRef.current.scrollLeft = Math.max(0, scrollPos);
      }
    }
  }, [viewMode]);

  // 14-day schedule
  const scheduleRange = useMemo(() => {
    const days = [];
    for (let i = 0; i < 14; i++) {
      days.push(addDaysISO(today, i));
    }
    return days;
  }, [today]);

  // Get adherence color
  const adherenceColor = (val) => {
    if (val === null) return 'rgba(255,255,255,0.03)';
    if (val >= 1) return 'rgba(92,184,112,0.7)';
    if (val >= 0.75) return 'rgba(92,184,112,0.4)';
    if (val >= 0.5) return 'rgba(201,168,76,0.5)';
    if (val > 0) return 'rgba(201,168,76,0.3)';
    return 'rgba(220,80,80,0.3)';
  };

  // Streak calculation
  const streak = useMemo(() => {
    let count = 0;
    let d = today;
    while (true) {
      const adh = adherenceMap[d];
      if (adh === null || adh === undefined) break;
      if (adh >= 0.75) { count++; d = addDaysISO(d, -1); }
      else break;
    }
    return count;
  }, [adherenceMap, today]);

  // Selected day detail
  const dayDetail = selectedDay ? {
    logs: logIndex[selectedDay] || [],
    checkin: checkinIndex[selectedDay],
    events: eventIndex[selectedDay] || [],
    adherence: adherenceMap[selectedDay],
  } : null;

  const DAY_W = 44;

  return (
    <div style={{ animation: 'fadeUp .4s ease both' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <p style={{ fontFamily: T.fd, fontSize: 18, fontWeight: 300, color: T.t2, letterSpacing: 1 }}>Protocol Timeline</p>
          {cycleWeek && <p style={{ fontSize: 10, color: T.gold, fontFamily: T.fm, marginTop: 2 }}>Week {cycleWeek}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {streak > 0 && <span style={{ fontSize: 10, color: T.green, fontFamily: T.fm }}>{streak}d streak</span>}
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: 3, marginBottom: 16, border: '1px solid ' + T.border }}>
        {[{ k: 'timeline', l: '90-Day' }, { k: 'heatmap', l: 'Heatmap' }, { k: 'schedule', l: '14-Day' }].map(v => (
          <button key={v.k} onClick={() => setViewMode(v.k)} style={{ ...S.segBtn, flex: 1, fontSize: 10, padding: '6px 0', ...(viewMode === v.k ? S.segOn : {}) }}>{v.l}</button>
        ))}
      </div>

      {/* ── 90-Day Timeline ─── */}
      {viewMode === 'timeline' && (
        <div>
          {/* Horizontal scroll container */}
          <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'hidden', paddingBottom: 8, WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'flex', minWidth: timeRange.days.length * DAY_W }}>
              {/* Day columns */}
              {timeRange.days.map((day, i) => {
                const isToday = day === today;
                const isFuture = day > today;
                const isSelected = day === selectedDay;
                const dayLogs = logIndex[day] || [];
                const dayEvents = eventIndex[day] || [];
                const adh = adherenceMap[day];
                const isWeekend = [0, 6].includes(new Date(day + 'T12:00:00').getDay());
                const isMonthStart = day.endsWith('-01');

                return (
                  <div key={day} onClick={() => !isFuture && setSelectedDay(isSelected ? null : day)} style={{
                    width: DAY_W, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    padding: '4px 0', cursor: isFuture ? 'default' : 'pointer', position: 'relative',
                    borderLeft: isMonthStart ? '1px solid ' + T.border : 'none',
                    background: isSelected ? 'rgba(201,168,76,0.06)' : isToday ? 'rgba(201,168,76,0.03)' : 'transparent',
                    borderRadius: isSelected ? 6 : 0,
                    opacity: isFuture ? 0.3 : 1,
                  }}>
                    {/* Month label */}
                    {(i === 0 || isMonthStart) && (
                      <div style={{ fontSize: 8, color: T.t3, fontFamily: T.fm, letterSpacing: 1, position: 'absolute', top: -14, left: 2 }}>
                        {new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                      </div>
                    )}

                    {/* Day number */}
                    <div style={{
                      fontSize: 9, fontFamily: T.fm, fontWeight: isToday ? 700 : 400,
                      color: isToday ? T.gold : isWeekend ? T.t3 : T.t2,
                      width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isToday ? T.goldS : 'transparent',
                      border: isToday ? '1px solid ' + T.goldM : 'none',
                    }}>
                      {new Date(day + 'T12:00:00').getDate()}
                    </div>

                    {/* Compound dot grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: stack.length * 8 }}>
                      {stack.map(c => {
                        const logged = dayLogs.some(l => l.cid === c.id);
                        const catColor = CAT_C[c.category] || T.gold;
                        return (
                          <div key={c.id} style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: logged ? catColor : isFuture ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
                            border: logged ? 'none' : '1px solid rgba(255,255,255,0.06)',
                            transition: 'background 0.2s',
                          }} />
                        );
                      })}
                    </div>

                    {/* Event marker */}
                    {dayEvents.length > 0 && (
                      <div style={{ fontSize: 8, color: T.teal, lineHeight: 1 }}>
                        {dayEvents[0].icon}
                      </div>
                    )}

                    {/* Adherence bar */}
                    <div style={{
                      width: 28, height: 3, borderRadius: 1.5,
                      background: adherenceColor(adh),
                      marginTop: 2,
                    }} />

                    {/* Today marker line */}
                    {isToday && <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: T.goldM, zIndex: -1 }} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compound legend (fixed sidebar equivalent) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, marginBottom: 8 }}>
            {stack.map(c => {
              const catColor = CAT_C[c.category] || T.gold;
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: catColor }} />
                  <span style={{ fontSize: 9, color: T.t3, fontFamily: T.fm }}>{c.name}</span>
                </div>
              );
            })}
          </div>

          {/* Day detail slide-up panel */}
          {selectedDay && dayDetail && (
            <div style={{
              ...S.card, padding: '14px', marginTop: 8, borderColor: T.goldM + '40',
              animation: 'fadeUp .2s ease both',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <span style={{ fontFamily: T.fd, fontSize: 16, fontWeight: 300, color: T.t1 }}>
                    {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </span>
                  {dayDetail.adherence !== null && (
                    <span style={{ fontSize: 10, color: adherenceColor(dayDetail.adherence), fontFamily: T.fm, marginLeft: 8 }}>
                      {Math.round((dayDetail.adherence || 0) * 100)}%
                    </span>
                  )}
                </div>
                <button onClick={() => setSelectedDay(null)} style={{ background: 'none', border: 'none', color: T.t3, cursor: 'pointer', fontSize: 14, fontFamily: T.fm }}>{'\u2715'}</button>
              </div>

              {/* Events */}
              {dayDetail.events.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {dayDetail.events.map((e, i) => (
                    <div key={i} style={{ fontSize: 10, color: T.teal, fontFamily: T.fm, marginBottom: 2 }}>
                      {e.icon} {e.label}
                    </div>
                  ))}
                </div>
              )}

              {/* Logged compounds */}
              {dayDetail.logs.length > 0 ? (
                <div>
                  <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 6 }}>Logged</div>
                  {dayDetail.logs.map((l, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: CAT_C[stack.find(c => c.id === l.cid)?.category] || T.gold }} />
                        <span style={{ fontSize: 12, color: T.t1, fontFamily: T.fb }}>{l.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, color: T.t2, fontFamily: T.fm }}>{l.doseLabel}</span>
                        <span style={{ fontSize: 9, color: T.t3, fontFamily: T.fm }}>{l.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm }}>No doses logged</div>
              )}

              {/* Missed compounds */}
              {selectedDay <= today && (() => {
                const loggedIds = new Set(dayDetail.logs.map(l => l.cid));
                const missed = stack.filter(c => {
                  if (c.frequency === 'weekly') {
                    return new Date(selectedDay + 'T12:00:00').getDay() === 0 && !loggedIds.has(c.id);
                  }
                  return (c.frequency === 'daily' || c.frequency === '2x_day') && !loggedIds.has(c.id);
                });
                if (missed.length === 0) return null;
                return (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(220,80,80,0.6)', fontFamily: T.fm, marginBottom: 4 }}>Missed</div>
                    {missed.map(c => (
                      <div key={c.id} style={{ fontSize: 11, color: 'rgba(220,80,80,0.6)', fontFamily: T.fm, padding: '2px 0' }}>
                        {'\u2022'} {c.name}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Checkin data */}
              {dayDetail.checkin && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid ' + T.border }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 4 }}>Body Check-in</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {dayDetail.checkin.weight && <div><span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>Weight </span><span style={{ fontSize: 12, color: T.t1, fontFamily: T.fm }}>{dayDetail.checkin.weight}</span></div>}
                    {dayDetail.checkin.waist && <div><span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>Waist </span><span style={{ fontSize: 12, color: T.t1, fontFamily: T.fm }}>{dayDetail.checkin.waist}</span></div>}
                    {dayDetail.checkin.bf && <div><span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>BF </span><span style={{ fontSize: 12, color: T.t1, fontFamily: T.fm }}>{dayDetail.checkin.bf}</span></div>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Adherence Heatmap ─── */}
      {viewMode === 'heatmap' && (
        <div>
          <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 8 }}>Last 90 Days Adherence</div>
          {/* Heatmap grid: 7 rows (days of week) x ~13 columns (weeks) */}
          {(() => {
            // Build weeks array going back 90 days
            const startDay = addDaysISO(today, -89);
            const startDow = new Date(startDay + 'T12:00:00').getDay();
            // Pad to start on Sunday
            const gridStart = addDaysISO(startDay, -startDow);
            const weeks = [];
            let cur = gridStart;
            while (cur <= today) {
              const week = [];
              for (let d = 0; d < 7; d++) {
                week.push(cur);
                cur = addDaysISO(cur, 1);
              }
              weeks.push(week);
            }
            const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
            const cellSize = 12;
            const gap = 3;

            return (
              <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
                <div style={{ display: 'flex', gap }}>
                  {/* Day-of-week labels */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap, marginRight: 4, paddingTop: cellSize + gap }}>
                    {dayLabels.map((l, i) => (
                      <div key={i} style={{ width: 12, height: cellSize, fontSize: 8, color: T.t3, fontFamily: T.fm, display: 'flex', alignItems: 'center' }}>{i % 2 === 1 ? l : ''}</div>
                    ))}
                  </div>
                  {/* Week columns */}
                  {weeks.map((week, wi) => (
                    <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap }}>
                      {/* Month label on first week or new month */}
                      <div style={{ height: cellSize, fontSize: 7, color: T.t3, fontFamily: T.fm, display: 'flex', alignItems: 'center' }}>
                        {week[0].endsWith('-01') || (wi === 0 && week[0] <= today) ? new Date(week[0] + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase().slice(0, 3) : ''}
                      </div>
                      {week.map((day, di) => {
                        const adh = adherenceMap[day];
                        const inRange = day >= addDaysISO(today, -89) && day <= today;
                        return (
                          <div key={di} onClick={() => inRange && setSelectedDay(selectedDay === day ? null : day)} title={day} style={{
                            width: cellSize, height: cellSize, borderRadius: 2,
                            background: !inRange ? 'transparent' : adherenceColor(adh),
                            border: selectedDay === day ? '1px solid ' + T.gold : '1px solid rgba(255,255,255,0.03)',
                            cursor: inRange ? 'pointer' : 'default',
                            transition: 'background 0.15s',
                          }} />
                        );
                      })}
                    </div>
                  ))}
                </div>
                {/* Legend */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                  <span style={{ fontSize: 8, color: T.t3, fontFamily: T.fm }}>Less</span>
                  {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
                    <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: adherenceColor(v) }} />
                  ))}
                  <span style={{ fontSize: 8, color: T.t3, fontFamily: T.fm }}>More</span>
                </div>
              </div>
            );
          })()}

          {/* Summary stats */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {[
              { label: 'Current Streak', value: streak + 'd', color: T.green },
              { label: '30-Day Avg', value: (() => {
                const last30 = timeRange.days.filter(d => d >= addDaysISO(today, -29) && d <= today);
                const vals = last30.map(d => adherenceMap[d]).filter(v => v !== null && v !== undefined);
                return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 100) + '%' : '--';
              })(), color: T.gold },
              { label: 'Perfect Days', value: (() => {
                const last30 = timeRange.days.filter(d => d >= addDaysISO(today, -29) && d <= today);
                return last30.filter(d => adherenceMap[d] >= 1).length;
              })(), color: T.teal },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, ...S.card, padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 300, color: s.color, fontFamily: T.fd }}>{s.value}</div>
                <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Day detail (reused from timeline view) */}
          {selectedDay && dayDetail && (
            <div style={{
              ...S.card, padding: '14px', marginTop: 12, borderColor: T.goldM + '40',
              animation: 'fadeUp .2s ease both',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontFamily: T.fd, fontSize: 14, fontWeight: 300, color: T.t1 }}>
                  {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <button onClick={() => setSelectedDay(null)} style={{ background: 'none', border: 'none', color: T.t3, cursor: 'pointer', fontSize: 12, fontFamily: T.fm }}>{'\u2715'}</button>
              </div>
              {dayDetail.logs.length > 0 ? dayDetail.logs.map((l, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span style={{ fontSize: 11, color: T.t1, fontFamily: T.fb }}>{l.name}</span>
                  <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>{l.time}</span>
                </div>
              )) : <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm }}>No doses logged</div>}
            </div>
          )}
        </div>
      )}

      {/* ── 14-Day Schedule ─── */}
      {viewMode === 'schedule' && (
        <div>
          <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 12 }}>Upcoming 14-Day Schedule</div>
          {scheduleRange.map((day, i) => {
            const isToday = day === today;
            const dayLogs = logIndex[day] || [];
            const loggedIds = new Set(dayLogs.map(l => l.cid));
            const dayOfWeek = new Date(day + 'T12:00:00').getDay();

            // Determine which compounds are scheduled
            const scheduled = stack.filter(c => {
              if (c.frequency === 'daily' || c.frequency === '2x_day') return true;
              if (c.frequency === 'weekly') return dayOfWeek === 0; // Sunday
              if (c.frequency === '2x_week') return [1, 4].includes(dayOfWeek); // Mon, Thu
              if (c.frequency === 'intermittent') return [1, 3, 5].includes(dayOfWeek); // MWF
              return false;
            });

            const isPast = day < today;
            const allLogged = isPast && scheduled.length > 0 && scheduled.every(c => loggedIds.has(c.id));

            return (
              <div key={day} style={{
                ...S.card, padding: '10px 12px', marginBottom: 6,
                borderColor: isToday ? T.goldM : allLogged ? 'rgba(92,184,112,0.15)' : T.border,
                background: isToday ? T.goldS : allLogged ? 'rgba(92,184,112,0.03)' : 'transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: scheduled.length > 0 ? 8 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? T.gold : T.t1, fontFamily: T.fm }}>
                      {getDayOfWeek(day)}
                    </span>
                    <span style={{ fontSize: 11, color: T.t2, fontFamily: T.fm }}>{fmtShortDate(day)}</span>
                    {isToday && <span style={{ fontSize: 8, color: T.gold, fontFamily: T.fm, letterSpacing: 1, textTransform: 'uppercase' }}>Today</span>}
                  </div>
                  {isPast && scheduled.length > 0 && (
                    <span style={{ fontSize: 10, color: allLogged ? T.green : 'rgba(220,80,80,0.6)', fontFamily: T.fm }}>
                      {allLogged ? '\u2713' : loggedIds.size + '/' + scheduled.length}
                    </span>
                  )}
                </div>
                {scheduled.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {scheduled.map(c => {
                      const logged = loggedIds.has(c.id);
                      const catColor = CAT_C[c.category] || T.gold;
                      return (
                        <span key={c.id} style={{
                          fontSize: 9, fontFamily: T.fm, padding: '3px 8px', borderRadius: 10,
                          background: logged ? catColor + '20' : 'rgba(255,255,255,0.03)',
                          color: logged ? catColor : T.t3,
                          border: '1px solid ' + (logged ? catColor + '40' : 'rgba(255,255,255,0.06)'),
                          textDecoration: logged ? 'none' : 'none',
                          opacity: isPast && !logged ? 0.5 : 1,
                        }}>
                          {logged && '\u2713 '}{c.name}
                        </span>
                      );
                    })}
                  </div>
                )}
                {scheduled.length === 0 && (
                  <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>Rest day</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cycle tracker footer */}
      {cycleWeek && profile?.startDate && (
        <div style={{ ...S.card, padding: '10px 12px', marginTop: 16, borderColor: T.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>Protocol Cycle</div>
              <div style={{ fontSize: 14, fontWeight: 300, color: T.gold, fontFamily: T.fd, marginTop: 2 }}>Week {cycleWeek}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm }}>Started {fmtShortDate(profile.startDate)}</div>
              <div style={{ fontSize: 10, color: T.t2, fontFamily: T.fm }}>{daysBetween(profile.startDate, today)} days in</div>
            </div>
          </div>
          {/* Mini progress bar for current week */}
          <div style={{ display: 'flex', gap: 2, marginTop: 8 }}>
            {[0, 1, 2, 3, 4, 5, 6].map(d => {
              const dayInWeek = new Date(today + 'T12:00:00').getDay();
              return <div key={d} style={{ flex: 1, height: 3, borderRadius: 1.5, background: d <= dayInWeek ? T.gold : 'rgba(255,255,255,0.04)' }} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── LogView (unchanged) ─────────────────────────── */
function LogView({ logs: rawLogs }) {
  const safe = rawLogs || [];
  const sorted = [...safe].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  const grouped = sorted.reduce((a, l) => { (a[l.date] = a[l.date] || []).push(l); return a; }, {});
  if (!sorted.length) return <div style={{ textAlign: 'center', padding: '50px 0' }}><div style={{ fontSize: 28, opacity: 0.15, marginBottom: 8 }}>{'\u25CB'}</div><p style={{ fontFamily: T.fd, fontSize: 18, fontWeight: 300, color: T.t2 }}>The log is empty</p><p style={{ fontFamily: T.fb, fontSize: 12, color: T.t3, marginTop: 6 }}>Each dose you log writes a line in the story</p></div>;
  return (
    <div style={{ animation: 'fadeUp .4s ease both' }}>{Object.entries(grouped).map(([date, entries]) => <div key={date} style={{ marginBottom: 20 }}><div style={S.logDate}>{new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>{entries.map((e, i) => <div key={i} style={S.logRow}><span style={S.logName}>{e.name}</span><span style={S.logDose}>{e.doseLabel}{e.route ? ` \u00B7 ${ROUTE_LABELS[e.route] || e.route}` : ''}</span><span style={S.logTime}>{e.time}</span></div>)}</div>)}</div>
  );
}

/* ── TrackTab root with multi-step site log flow ─────────────────────────── */
export default function TrackTab({ logs, setLogs, vials, setVials, stack, siteHistory, setSiteHistory, subjective, setSubjective, checkins, profile, onNavigate }) {
  const [sv, setSv] = useState('today');
  const [siteLogStep, setSiteLogStep] = useState(null);
  const [siteLogData, setSiteLogData] = useState({ siteId: null, compound: '', tissueQuality: 3, notes: '' });

  const siteAnalysis = useMemo(() => analyzeSites(siteHistory), [siteHistory]);

  const handleLog = useCallback((c, route) => {
    const entry = { cid: c.id, name: c.name, date: getToday(), time: getNow(), doseLabel: fmtDose(c) };
    if (route) entry.route = route;
    setLogs(p => [...p, entry]);
  }, [setLogs]);
  const handleNewVial = useCallback(id => { setVials(p => ({ ...p, [id]: { startDate: getToday(), reconDate: getToday() } })); }, [setVials]);

  // Multi-step site log: initiate
  const handleLogSite = useCallback(siteId => {
    setSiteLogData({ siteId, compound: '', tissueQuality: 3, notes: '' });
    setSiteLogStep('compound');
  }, []);

  // Multi-step site log: step actions
  const handleSiteLogStepAction = useCallback((action, value) => {
    if (action === 'cancel') {
      setSiteLogStep(null);
      setSiteLogData({ siteId: null, compound: '', tissueQuality: 3, notes: '' });
      return;
    }
    if (action === 'selectCompound') {
      setSiteLogData(prev => ({ ...prev, compound: value || '' }));
      setSiteLogStep('quality');
      return;
    }
    if (action === 'selectQuality') {
      setSiteLogData(prev => ({ ...prev, tissueQuality: value }));
      setSiteLogStep('notes');
      return;
    }
    if (action === 'updateNotes') {
      setSiteLogData(prev => ({ ...prev, notes: value }));
      return;
    }
    if (action === 'save') {
      setSiteHistory(p => [...p, {
        siteId: siteLogData.siteId,
        date: getToday(),
        time: getNow(),
        tissueQuality: siteLogData.tissueQuality,
        notes: siteLogData.notes || '',
        compound: siteLogData.compound || '',
      }]);
      setSiteLogStep(null);
      setSiteLogData({ siteId: null, compound: '', tissueQuality: 3, notes: '' });
      if (navigator.vibrate) navigator.vibrate(40);
    }
  }, [siteLogData, setSiteHistory]);

  return (
    <div>
      <header style={{ ...S.header, marginBottom: 12 }}><h1 style={{ ...S.brand, fontSize: 20 }}>TRACK</h1><p style={S.sub}>Protocol Management</p></header>
      <div style={S.segWrap}>{[{ k: 'today', l: 'Today' }, { k: 'vials', l: 'Vials' }, { k: 'timeline', l: 'Timeline' }, { k: 'sites', l: 'Sites' }, { k: 'log', l: 'Log' }].map(s => <button key={s.k} onClick={() => setSv(s.k)} style={{ ...S.segBtn, ...(sv === s.k ? S.segOn : {}) }}>{s.l}</button>)}</div>
      {sv === 'today' && <TodayView logs={logs} onLog={handleLog} stack={stack} onOpenSites={() => setSv('sites')} siteAnalysis={siteAnalysis} onQuickCheckin={onNavigate ? () => onNavigate('BODY') : null} />}
      {sv === 'vials' && <VialsView vials={vials} logs={logs} onNewVial={handleNewVial} stack={stack} />}
      {sv === 'timeline' && <TimelineView logs={logs} stack={stack} checkins={checkins} profile={profile} />}
      {sv === 'sites' && <SitesView siteHistory={siteHistory} onLogSite={handleLogSite} stack={stack} siteAnalysis={siteAnalysis} siteLogStep={siteLogStep} siteLogData={siteLogData} onSiteLogStepAction={handleSiteLogStepAction} />}
      {sv === 'log' && <LogView logs={logs} />}
    </div>
  );
}
