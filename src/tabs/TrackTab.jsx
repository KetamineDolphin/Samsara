/* SAMSARA v4.0 - TrackTab with timing groups, sites, vial freshness, escalation, tissue quality, timeline */
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

/* -- Tissue quality analysis ---------------------------------------- */
function analyzeSites(siteHistory) {
  const result = {};
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  SITE_LIST.forEach(site => {
    const siteLogs = (siteHistory || []).filter(s => s.siteId === site.id);
    const recent = siteLogs.filter(s => s.date >= cutoffStr);
    const recentUses = recent.length;

    const lastFive = [...siteLogs].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)).slice(0, 5);
    const avgQuality = lastFive.length > 0
      ? lastFive.reduce((sum, l) => sum + (l.tissueQuality || 3), 0) / lastFive.length
      : 3;

    const last3 = lastFive.slice(0, 3);
    const prev3 = lastFive.slice(3);
    let qualityTrend = 'stable';
    if (last3.length >= 2 && prev3.length >= 1) {
      const recentAvg = last3.reduce((s, l) => s + (l.tissueQuality || 3), 0) / last3.length;
      const prevAvg = prev3.reduce((s, l) => s + (l.tissueQuality || 3), 0) / prev3.length;
      if (recentAvg > prevAvg + 0.3) qualityTrend = 'improving';
      else if (recentAvg < prevAvg - 0.3) qualityTrend = 'declining';
    }

    let status = 'ok', label = 'OK', color = T.t2, message = 'Normal tissue quality.';
    if (avgQuality < 2.5 || (avgQuality < 3 && recentUses >= 4)) {
      status = 'rest'; label = 'Rest'; color = 'rgba(220,80,80,0.8)';
      message = 'Tissue quality poor. Rest this site for at least 7 days.';
    } else if (recentUses >= 5) {
      status = 'overused'; label = 'Overused'; color = T.amber;
      message = 'High frequency use. Rotate to other sites.';
    } else if (avgQuality >= 4 && recentUses <= 2) {
      status = 'fresh'; label = 'Fresh'; color = T.green;
      message = 'Good tissue quality. Optimal for injection.';
    }

    const lastLog = siteLogs.length > 0 ? [...siteLogs].sort((a, b) => b.date.localeCompare(a.date))[0] : null;
    const daysSinceLast = lastLog ? Math.floor((new Date() - new Date(lastLog.date + 'T12:00:00')) / 86400000) : null;

    result[site.id] = { status, label, color, message, avgQuality, recentUses, qualityTrend, daysSinceLast, lastLog };
  });
  return result;
}

/* -- Quality rating config ---------------------------------------- */
const QUALITY_OPTIONS = [
  { value: 1, label: 'Painful', color: 'rgba(220,80,80,0.8)' },
  { value: 2, label: 'Tender', color: T.amber },
  { value: 3, label: 'Normal', color: T.t2 },
  { value: 4, label: 'Good', color: T.green },
  { value: 5, label: 'Perfect', color: T.teal },
];

const TREND_ARROWS = { improving: '\u2191', declining: '\u2193', stable: '\u2192' };
const TREND_COLORS = { improving: T.green, declining: 'rgba(220,80,80,0.8)', stable: T.t3 };

/* -- RetaCard (weekly compound card) ---------------------------------------- */
function RetaCard({ compound, logged, onLog }) {
  const dn = daysNextWeekly();
  const dayOfWeek = new Date().getDay();
  const esc = compound.escalation;
  const escStatus = getEscalationStatus(compound);
  const history = esc ? esc.protocol.slice(0, esc.currentStep + 1) : [];

  return (
    <div style={{ ...S.card, borderColor: logged ? 'rgba(92,184,112,0.15)' : T.goldM + '30', padding: '12px 14px', marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.t1, fontFamily: T.fb }}>Retatrutide</span>
        <span style={{ fontSize: 9, color: T.gold, fontFamily: T.fm, letterSpacing: 1 }}>WEEKLY</span>
      </div>
      <div style={{ fontSize: 12, color: T.t2, fontFamily: T.fm, marginBottom: 8 }}>Current: <span style={{ color: T.gold }}>{compound.dose} {compound.unit}</span></div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>{[0, 1, 2, 3, 4, 5, 6].map(d => <div key={d} style={{ flex: 1, height: 4, borderRadius: 2, background: d < dayOfWeek ? 'rgba(201,168,76,0.3)' : d === dayOfWeek ? T.gold : 'rgba(255,255,255,0.04)' }} />)}</div>
      <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, marginBottom: 6 }}>{dayOfWeek}/7 days</div>
      {history.length > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
        {history.map((s, i) => <span key={i} style={{ fontSize: 10, fontFamily: T.fm, color: i === history.length - 1 ? T.gold : T.t3 }}>{s}{i === history.length - 1 ? ' \u2190' : ''}{i < history.length - 1 ? ' \u2192' : ''}</span>)}
      </div>}
      {escStatus && <div style={{ fontSize: 10, color: escStatus.canStep ? T.amber : T.t3, fontFamily: T.fm, marginBottom: 6 }}>
        {escStatus.canStep ? '\u2191 Ready: ' + escStatus.nextDose + ' ' + compound.unit : escStatus.label}
      </div>}
      {compound.nextPlanned && <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginBottom: 8 }}>Next planned: <span style={{ color: T.amber }}>{compound.nextPlanned} {compound.unit}</span></div>}
      <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, marginBottom: 8 }}>Next: <span style={{ color: T.t2 }}>Sunday</span> {'\u00B7'} {dn}d</div>
      {logged ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', padding: '6px 0' }}>
          <span style={{ color: '#5cb870', fontSize: 16, animation: 'checkSpring .4s cubic-bezier(.34,1.56,.64,1) both', display: 'inline-block' }}>{'\u2713'}</span>
          <span style={{ fontSize: 10, color: '#5cb870', fontFamily: T.fm }}>{logged.time}</span>
        </div>
      ) : (
        <button onClick={() => { if (navigator.vibrate) navigator.vibrate(40); onLog(compound); }} style={{ ...S.logBtn, width: '100%', padding: '8px', textAlign: 'center', fontSize: 12 }} onTouchStart={e => e.currentTarget.style.animation = 'logPress .3s ease both'} onAnimationEnd={e => e.currentTarget.style.animation = ''}>Log This Week's Dose</button>
      )}
    </div>
  );
}

/* -- TodayView ---------------------------------------- */
const ROUTE_LABELS = { subq: 'SubQ', im: 'IM', oral: 'Oral', topical: 'Topical', intranasal: 'Nasal', iv: 'IV' };
const ROUTE_ICONS = { subq: '\uD83D\uDC89', im: '\uD83D\uDC89', oral: '\uD83D\uDC8A', topical: '\u2728', intranasal: '\uD83D\uDCA8', iv: '\uD83C\uDFE5' };

function TodayView({ logs, onLog, onDeleteLog, stack, onOpenSites, siteAnalysis, onQuickCheckin }) {
  const t = getToday();
  const [routePickerId, setRoutePickerId] = useState(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(iv); }, []);

  const adherence = useMemo(() => getAdherenceStats(logs, stack, 90), [logs, stack]);
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

  const stackAnalysis = useMemo(() => stack.length > 1 ? analyzeStack(stack, LIB) : null, [stack]);
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
  const alerts = useMemo(() => {
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
        const okSite = SITE_LIST.find(s => siteAnalysis[s.id] && siteAnalysis[s.id].status === 'ok');
        suggestedSite = okSite || null;
      }
    }
    return { restSites, overusedSites, suggestedSite };
  }, [siteAnalysis]);

  const hasAlerts = alerts.restSites.length > 0 || alerts.overusedSites.length > 0 || alerts.suggestedSite;

  return (
    <div style={{ animation: 'fadeUp .4s ease both' }}>
      {/* Unified site alert banner -- one compact line with all info */}
      {hasAlerts && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, padding: '6px 10px', marginBottom: 8,
          background: 'rgba(255,255,255,0.02)', border: '1px solid ' + T.border, borderRadius: 8,
          alignItems: 'center',
        }}>
          {alerts.restSites.length > 0 && (
            <span style={{ fontSize: 10, color: 'rgba(220,80,80,0.85)', fontFamily: T.fm }}>
              {'\u26A0'} Rest: {alerts.restSites.map(s => s.label).join(', ')}
            </span>
          )}
          {alerts.overusedSites.length > 0 && (
            <span style={{ fontSize: 10, color: T.amber, fontFamily: T.fm }}>
              {'\u21BB'} Overused: {alerts.overusedSites.map(s => s.label).join(', ')}
            </span>
          )}
          {alerts.suggestedSite && (
            <span style={{ fontSize: 10, color: T.gold, fontFamily: T.fm }}>
              {'\u2736'} Use: <span style={{ fontWeight: 600 }}>{alerts.suggestedSite.label}</span>
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ fontFamily: T.fd, fontSize: 17, fontWeight: 300, color: T.t2, letterSpacing: 1, margin: 0 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <div style={{ display: 'flex', gap: 6 }}>
          {onQuickCheckin && <button onClick={onQuickCheckin} style={{ ...S.pill, fontSize: 9, padding: '3px 8px', borderColor: 'rgba(0,210,180,0.3)', color: T.teal }}>Check-in</button>}
          <button onClick={onOpenSites} style={{ ...S.pill, fontSize: 9, padding: '3px 8px', borderColor: T.goldM, color: T.gold }}>Sites</button>
        </div>
      </div>

      {/* Streak -- compact single line */}
      {adherence.currentStreak > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', marginBottom: 8,
          background: adherence.currentStreak >= 7 ? 'rgba(201,168,76,0.04)' : 'rgba(92,184,112,0.03)',
          border: '1px solid ' + (adherence.currentStreak >= 7 ? 'rgba(201,168,76,0.15)' : 'rgba(92,184,112,0.1)'),
          borderRadius: 8,
        }}>
          <span style={{ fontSize: 14 }}>{adherence.currentStreak >= 7 ? '\uD83D\uDD25' : '\u2B50'}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.t1, fontFamily: T.fb }}>{adherence.currentStreak}d</span>
          <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>{adherence.overallPct}% adherence</span>
          {adherence.currentStreak >= 7 && (
            <span style={{ fontSize: 9, color: T.gold, fontFamily: T.fm, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginLeft: 'auto' }}>
              {adherence.currentStreak >= 30 ? 'Legendary' : adherence.currentStreak >= 14 ? 'On Fire' : 'Consistent'}
            </span>
          )}
        </div>
      )}

      {/* Empty state */}
      {stack.length === 0 && (
        <div style={{ ...S.card, padding: '16px', textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.3 }}>{'\u2295'}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.t1, fontFamily: T.fb, marginBottom: 4 }}>Add Your First Compound</div>
          <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, lineHeight: 1.5 }}>Browse the library in Profile to add compounds to your stack.</div>
        </div>
      )}

      {/* Timing groups */}
      {TIMING_GROUPS.map(g => {
        const compounds = groups[g.id];
        if (!compounds || compounds.length === 0) return null;
        return (
          <div key={g.id}>
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 4, marginTop: 6 }}>{g.icon} {g.label}</div>
            {compounds.map(c => {
              const isW = c.frequency === 'weekly';
              const freqMeta = FREQ_META[c.frequency] || FREQ_META.daily;
              const expectedPerDay = freqMeta.perDay || 1;
              const maxPerDay = freqMeta.maxPerDay || 3;
              const todayLogs = isW
                ? logs.filter(l => l.cid === c.id && l.date >= getWeekStart())
                : logs.filter(l => l.cid === c.id && l.date === t);
              const logged = todayLogs.length > 0 ? todayLogs[todayLogs.length - 1] : null; // most recent
              const dosesDone = todayLogs.length;
              const allDosesDone = isW ? dosesDone >= 1 : dosesDone >= expectedPerDay;
              const atMax = dosesDone >= maxPerDay;
              const cNotes = interactionMap[c.libId] || [];
              if (isW) return <RetaCard key={c.id} compound={c} logged={logged} onLog={onLog} />;
              const libEntry = LIB.find(l => l.id === c.libId) || {};
              const routes = libEntry.administrationOptions || [];
              const hasMultiRoute = routes.length > 1;
              const showingRoutes = routePickerId === c.id;
              const halfLife = libEntry.halfLifeHours || 0;
              const lastDoseTs = lastDoseMap[c.id];
              const hoursSince = lastDoseTs ? (now - lastDoseTs) / 3600000 : null;
              const doseStatus = hoursSince != null && halfLife > 0
                ? hoursSince < halfLife ? 'active' : hoursSince < halfLife * 2 ? 'clearing' : 'cleared'
                : null;
              const peakMin = libEntry.peakPlasmaMinutes || 0;
              const minSince = hoursSince != null ? hoursSince * 60 : null;
              const isPeaking = peakMin > 0 && minSince != null && minSince < peakMin * 1.5 && minSince > 0 && logged;

              // Build clean meta line
              const metaParts = [fmtDose(c)];
              if (maxPerDay > 1) metaParts.push(`${dosesDone}/${maxPerDay}`);
              if (logged && logged.route) metaParts.push(ROUTE_LABELS[logged.route] || logged.route);
              const statusPart = (() => {
                if (logged && isPeaking) return { text: 'peaking', color: T.teal };
                if (logged && doseStatus === 'active') return { text: 'active', color: '#5cb870' };
                if (!logged && hoursSince != null) {
                  const col = doseStatus === 'cleared' ? T.t3 : T.amber;
                  const txt = hoursSince < 1 ? Math.round(hoursSince * 60) + 'm ago' : hoursSince < 24 ? Math.round(hoursSince) + 'h ago' : Math.round(hoursSince / 24) + 'd ago';
                  return { text: txt, color: col };
                }
                return null;
              })();

              return (
                <div key={c.id}>
                  <div style={{ ...S.trackRow, marginBottom: 6, padding: '10px 13px', ...(allDosesDone ? { borderColor: 'rgba(92,184,112,0.15)' } : logged ? { borderColor: 'rgba(201,168,76,0.12)' } : {}) }} onTouchStart={e => e.currentTarget.style.background = 'rgba(255,255,255,0.035)'} onTouchEnd={e => e.currentTarget.style.background = ''}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...S.trackName, fontSize: 13 }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: T.t3, marginTop: 2, fontFamily: T.fm, letterSpacing: 1 }}>
                        {metaParts.join(' \u00B7 ')}
                        {statusPart && <span style={{ color: statusPart.color }}> {'\u00B7'} {statusPart.text}</span>}
                      </div>
                    </div>
                    {logged ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {allDosesDone && (
                          <span style={{ animation: 'checkSpring .4s cubic-bezier(.34,1.56,.64,1) both', display: 'inline-block', color: '#5cb870', fontSize: 14 }}>{'\u2713'}</span>
                        )}
                        <span style={{ fontSize: 9, color: allDosesDone ? '#5cb870' : T.gold, fontFamily: T.fm }}>{dosesDone}{expectedPerDay > 1 ? `/${expectedPerDay}` : ''}</span>
                        {!atMax && (
                          <button onClick={() => {
                            if (hasMultiRoute) { setRoutePickerId(showingRoutes ? null : c.id); }
                            else { if (navigator.vibrate) navigator.vibrate(40); onLog(c); }
                          }} style={{ ...S.logBtn, fontSize: 9, padding: '3px 8px', background: 'rgba(201,168,76,0.06)', borderColor: 'rgba(201,168,76,0.2)' }}>
                            +
                          </button>
                        )}
                      </div>
                    ) : (
                      <button onClick={() => {
                        if (hasMultiRoute) { setRoutePickerId(showingRoutes ? null : c.id); }
                        else { if (navigator.vibrate) navigator.vibrate(40); onLog(c); }
                      }} style={{ ...S.logBtn, fontSize: 12, padding: '6px 12px' }} onTouchStart={e => e.currentTarget.style.animation = 'logPress .3s ease both'} onAnimationEnd={e => e.currentTarget.style.animation = ''}>
                        Log
                      </button>
                    )}
                  </div>
                  {/* Route picker */}
                  {showingRoutes && !atMax && (
                    <div style={{ display: 'flex', gap: 4, padding: '4px 12px 8px', animation: 'fadeUp .2s ease both' }}>
                      {routes.map(route => (
                        <button key={route} onClick={() => {
                          if (navigator.vibrate) navigator.vibrate(40);
                          onLog(c, route);
                          setRoutePickerId(null);
                        }} style={{
                          flex: 1, padding: '6px 4px', background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${T.goldM}`, borderRadius: 8, cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        }}>
                          <span style={{ fontSize: 12 }}>{ROUTE_ICONS[route] || '\uD83D\uDC89'}</span>
                          <span style={{ fontSize: 10, color: T.gold, fontFamily: T.fm }}>{ROUTE_LABELS[route] || route}</span>
                        </button>
                      ))}
                      <button onClick={() => setRoutePickerId(null)} style={{
                        padding: '6px 8px', background: 'rgba(255,255,255,0.02)',
                        border: `1px solid ${T.border}`, borderRadius: 8, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 11, color: T.t3 }}>{'\u2715'}</span>
                      </button>
                    </div>
                  )}
                  {/* Dose detail rows with delete */}
                  {todayLogs.length > 0 && (
                    <div style={{ paddingLeft: 12, paddingRight: 12, marginTop: -2, marginBottom: 4 }}>
                      {todayLogs.map((dl, di) => (
                        <div key={di} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', borderBottom: di < todayLogs.length - 1 ? `1px solid rgba(255,255,255,0.03)` : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 9, color: '#5cb870', fontFamily: T.fm }}>{dl.time}</span>
                            {dl.route && <span style={{ fontSize: 8, color: T.t3, fontFamily: T.fm }}>{ROUTE_LABELS[dl.route] || dl.route}</span>}
                            <span style={{ fontSize: 8, color: T.t3, fontFamily: T.fm }}>{dl.doseLabel || ''}</span>
                          </div>
                          <button onClick={() => { if (navigator.vibrate) navigator.vibrate(20); onDeleteLog(c.id, di); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontSize: 10, color: 'rgba(220,80,80,0.5)' }}>
                            {'\u2715'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Interaction notes */}
                  {!logged && cNotes.length > 0 && (
                    <div style={{ marginTop: -2, marginBottom: 6, paddingLeft: 12, paddingRight: 12 }}>
                      {cNotes.slice(0, 2).map((n, i) => {
                        const isGood = n.type === 'synergy';
                        const isDanger = n.severity === 'danger' || n.type === 'conflict';
                        const color = isGood ? '#5cb870' : isDanger ? 'rgba(220,80,80,0.85)' : T.amber;
                        return <div key={i} style={{ fontSize: 10, color, fontFamily: T.fm, lineHeight: 1.4, padding: '1px 0', display: 'flex', gap: 5, alignItems: 'flex-start' }}><span style={{ fontSize: 5, marginTop: 4, flexShrink: 0 }}>{'\u25CF'}</span><span>{n.note}</span></div>;
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

/* -- VialsView (unchanged) ---------------------------------------- */
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
          <div style={{ fontSize: 10, color: fresh.color, fontFamily: T.fm, marginBottom: 8 }}>{fresh.label}</div>
          <div style={S.barTrack}><div style={{ ...S.barFill, width: `${Math.min(pct * 100, 100)}%`, background: pct > 0.85 ? 'rgba(196,92,74,0.7)' : `linear-gradient(90deg,${T.gold},${T.amber})` }} /></div>
          <div style={S.vialStats}><span>{unitsOf(c).toFixed(1)}u/dose</span><span>{rem.toFixed(0)} left (~5% waste)</span><span>{Math.floor(dl)}d</span></div>
          <button onClick={() => handleNew(c.id)} style={{ ...S.newVialBtn, ...(isConf ? { borderColor: 'rgba(220,80,80,0.5)', color: 'rgba(220,80,80,0.8)' } : {}) }}>{isConf ? '\u26A0 Confirm Reset?' : '\u21BB New Vial'}</button>
        </div>
      );
    })}</div>
  );
}

/* -- SitesView (cleaned up) ---------------------------------------- */
function SitesView({ siteHistory, onLogSite, stack, siteAnalysis, siteLogStep, siteLogData, onSiteLogStepAction }) {
  const [selectedSite, setSelectedSite] = useState(null);
  const [showRotation, setShowRotation] = useState(false);
  const suggested = suggestNextSite(siteHistory);
  const suggestedAnalysis = siteAnalysis ? siteAnalysis[suggested.id] : null;

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

  // Quality dots renderer (compact)
  const renderQualityDots = (avg) => {
    const dots = [];
    for (let i = 1; i <= 5; i++) {
      const filled = i <= Math.round(avg);
      dots.push(
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: filled
            ? (avg >= 4 ? T.green : avg >= 3 ? T.gold : avg >= 2 ? T.amber : 'rgba(220,80,80,0.8)')
            : 'rgba(255,255,255,0.06)',
        }} />
      );
    }
    return dots;
  };

  return (
    <div style={{ animation: 'fadeUp .4s ease both' }}>
      {/* Inline site log flow */}
      {siteLogStep && siteLogData && (
        <div style={{ ...S.card, padding: '12px', marginBottom: 8, borderColor: T.goldM + '50' }}>
          <div style={{ fontSize: 10, color: T.gold, fontFamily: T.fm, marginBottom: 6 }}>
            Logging: {SITE_LIST.find(s => s.id === siteLogData.siteId)?.label || siteLogData.siteId}
          </div>

          {siteLogStep === 'compound' && (
            <div>
              <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, marginBottom: 4 }}>Compound</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {stack.map(c => (
                  <button key={c.id} onClick={() => onSiteLogStepAction('selectCompound', c.name)} style={{ ...S.pill, fontSize: 9, padding: '4px 8px', borderColor: T.goldM, color: T.t1 }}>{c.name}</button>
                ))}
                <button onClick={() => onSiteLogStepAction('selectCompound', '')} style={{ ...S.pill, fontSize: 9, padding: '4px 8px', borderColor: T.border, color: T.t3 }}>Skip</button>
              </div>
            </div>
          )}

          {siteLogStep === 'quality' && (
            <div>
              <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, marginBottom: 4 }}>Tissue quality</div>
              <div style={{ display: 'flex', gap: 3 }}>
                {QUALITY_OPTIONS.map(q => (
                  <button key={q.value} onClick={() => onSiteLogStepAction('selectQuality', q.value)} style={{
                    flex: 1, padding: '6px 2px', borderRadius: 6,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid ' + q.color,
                    color: q.color, fontSize: 9, fontFamily: T.fm, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                  }}>
                    <span style={{ fontSize: 14 }}>{q.value}</span>
                    <span>{q.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {siteLogStep === 'notes' && (
            <div>
              <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, marginBottom: 4 }}>Notes (optional)</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  type='text'
                  placeholder=''
                  value={siteLogData.notes || ''}
                  onChange={e => onSiteLogStepAction('updateNotes', e.target.value)}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid ' + T.border,
                    borderRadius: 6, padding: '6px 8px', color: T.t1, fontSize: 11, fontFamily: T.fm,
                    outline: 'none',
                  }}
                />
                <button onClick={() => onSiteLogStepAction('save')} style={{ ...S.logBtn, padding: '6px 14px', fontSize: 11 }}>Save</button>
              </div>
            </div>
          )}

          <button onClick={() => onSiteLogStepAction('cancel')} style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Cancel</button>
        </div>
      )}

      {/* Suggested site -- compact gold-bordered line */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 10px', marginBottom: 8,
        border: '1px solid ' + T.goldM, borderRadius: 8,
        background: T.goldS,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.gold, fontFamily: T.fb }}>{suggested.label}</span>
          <span style={{ fontSize: 9, color: T.t3, fontFamily: T.fm }}>
            {suggestedAnalysis?.daysSinceLast != null ? suggestedAnalysis.daysSinceLast + 'd ago' : 'Never used'}
          </span>
        </div>
        {suggestedAnalysis && (
          <span style={{
            fontSize: 8, fontFamily: T.fm, padding: '2px 6px', borderRadius: 8,
            background: suggestedAnalysis.color + '18', color: suggestedAnalysis.color,
          }}>{suggestedAnalysis.label}</span>
        )}
      </div>

      {/* Body map */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
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

      {/* Site button grid -- compact pills, no instruction text */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
        {SITE_LIST.map(s => {
          const a = siteAnalysis ? siteAnalysis[s.id] : null;
          const bc = a ? a.color + '40' : T.border;
          return <button key={s.id} onClick={() => onLogSite(s.id)} style={{ ...S.pill, fontSize: 8, padding: '3px 6px', borderColor: bc, borderRadius: 6 }}>{s.label}</button>;
        })}
      </div>

      {/* All Sites -- compact one-line rows */}
      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 4 }}>All Sites</div>
      {SITE_LIST.map(site => {
        const a = siteAnalysis ? siteAnalysis[site.id] : null;
        if (!a) return null;
        const isRest = a.status === 'rest';

        return (
          <div key={site.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', marginBottom: 3,
            background: isRest ? 'rgba(220,80,80,0.04)' : T.card,
            border: '1px solid ' + (isRest ? 'rgba(220,80,80,0.2)' : T.border),
            borderRadius: 8,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.t1, fontFamily: T.fb, minWidth: 90 }}>{site.label}</span>
            <span style={{
              fontSize: 8, fontFamily: T.fm, padding: '1px 5px', borderRadius: 6,
              background: a.color + '18', color: a.color,
            }}>{a.label}</span>
            <div style={{ display: 'flex', gap: 1, alignItems: 'center' }}>{renderQualityDots(a.avgQuality)}</div>
            <span style={{ fontSize: 11, color: TREND_COLORS[a.qualityTrend], fontFamily: T.fm }}>{TREND_ARROWS[a.qualityTrend]}</span>
            <span style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              {a.daysSinceLast != null ? a.daysSinceLast + 'd' : '--'}
              {isRest && a.daysSinceLast != null && a.daysSinceLast < 7 ? ` (${7 - a.daysSinceLast}d rest)` : ''}
            </span>
          </div>
        );
      })}

      {/* 7-day rotation plan -- hidden behind toggle */}
      <button
        onClick={() => setShowRotation(v => !v)}
        style={{
          ...S.pill, fontSize: 9, padding: '4px 10px', marginTop: 8, marginBottom: 4,
          borderColor: showRotation ? T.goldM : T.border,
          color: showRotation ? T.gold : T.t3,
        }}
      >
        {showRotation ? 'Hide rotation plan' : 'View rotation plan'}
      </button>
      {showRotation && (
        <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 4, marginTop: 4 }}>
          {rotationPlan.map((day, i) => (
            <div key={i} style={{
              padding: '6px 8px', minWidth: 64, textAlign: 'center', flexShrink: 0,
              background: day.isToday ? T.goldS : T.card,
              border: '1px solid ' + (day.isToday ? T.goldM : T.border),
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: day.isToday ? T.gold : T.t2, fontFamily: T.fm, marginBottom: 2 }}>
                {day.day}{day.isToday ? ' \u2022' : ''}
              </div>
              {day.sites.map((s, j) => (
                <div key={j} style={{ fontSize: 8, color: T.t3, fontFamily: T.fm, marginTop: 1 }}>{s.label}</div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -- Timeline helpers ---------------------------------------- */
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

/* -- TimelineView ---------------------------------------- */
function TimelineView({ logs, stack, checkins, profile }) {
  const safeLogs = logs || [];
  const safeCheckins = checkins || [];
  const [selectedDay, setSelectedDay] = useState(null);
  const [viewMode, setViewMode] = useState('timeline');
  const scrollRef = useRef(null);
  const today = getToday();

  const timeRange = useMemo(() => {
    const start = addDaysISO(today, -60);
    const end = addDaysISO(today, 30);
    const days = [];
    let cur = start;
    while (cur <= end) { days.push(cur); cur = addDaysISO(cur, 1); }
    return { start, end, days };
  }, [today]);

  const logIndex = useMemo(() => {
    const idx = {};
    safeLogs.forEach(l => { if (!idx[l.date]) idx[l.date] = []; idx[l.date].push(l); });
    return idx;
  }, [safeLogs]);

  const checkinIndex = useMemo(() => {
    const idx = {};
    safeCheckins.forEach(c => { const d = typeof c.date === 'string' ? c.date.slice(0, 10) : ''; if (d) idx[d] = c; });
    return idx;
  }, [safeCheckins]);

  const expectedDaily = useMemo(() => {
    return stack.filter(c => c.frequency === 'daily' || c.frequency === '2x_day' || c.frequency === '2x_week');
  }, [stack]);

  const expectedWeekly = useMemo(() => {
    return stack.filter(c => c.frequency === 'weekly');
  }, [stack]);

  const adherenceMap = useMemo(() => {
    const map = {};
    timeRange.days.forEach(day => {
      if (day > today) { map[day] = null; return; }
      const dayLogs = logIndex[day] || [];
      const dailyExpected = expectedDaily.filter(c => {
        if (c.frequency === 'weekly') return false;
        return true;
      });
      const dayOfWeek = new Date(day + 'T12:00:00').getDay();
      const weeklyExpected = dayOfWeek === 0 ? expectedWeekly : [];
      const allExpected = [...dailyExpected, ...weeklyExpected];
      if (allExpected.length === 0) { map[day] = dayLogs.length > 0 ? 1 : null; return; }
      // Count doses fulfilled (2x_day needs 2 logs, daily needs 1)
      let totalExpected = 0;
      let totalFulfilled = 0;
      allExpected.forEach(c => {
        const perDay = (FREQ_META[c.frequency] || {}).perDay || 1;
        const cLogs = dayLogs.filter(l => l.cid === c.id).length;
        totalExpected += perDay;
        totalFulfilled += Math.min(cLogs, perDay);
      });
      map[day] = totalExpected > 0 ? totalFulfilled / totalExpected : 0;
    });
    return map;
  }, [timeRange.days, today, logIndex, expectedDaily, expectedWeekly]);

  const events = useMemo(() => {
    const evts = [];
    safeCheckins.forEach(c => {
      const d = typeof c.date === 'string' ? c.date.slice(0, 10) : '';
      if (d && d >= timeRange.start && d <= timeRange.end) {
        evts.push({ date: d, type: 'checkin', label: 'Body check-in', icon: '\u2606' });
      }
    });
    const firstLogByCompound = {};
    safeLogs.forEach(l => {
      if (!firstLogByCompound[l.cid] || l.date < firstLogByCompound[l.cid]) firstLogByCompound[l.cid] = l.date;
    });
    Object.entries(firstLogByCompound).forEach(([cid, date]) => {
      if (date >= timeRange.start && date <= timeRange.end) {
        const c = stack.find(s => s.id === cid);
        evts.push({ date, type: 'start', label: (c ? c.name : cid) + ' started', icon: '\u25B6' });
      }
    });
    return evts;
  }, [safeCheckins, safeLogs, stack, timeRange]);

  const eventIndex = useMemo(() => {
    const idx = {};
    events.forEach(e => { if (!idx[e.date]) idx[e.date] = []; idx[e.date].push(e); });
    return idx;
  }, [events]);

  const cycleWeek = useMemo(() => {
    if (!profile?.startDate) return null;
    const days = daysBetween(profile.startDate, today);
    return Math.floor(days / 7) + 1;
  }, [profile, today]);

  useEffect(() => {
    if (scrollRef.current && viewMode === 'timeline') {
      const todayIdx = timeRange.days.indexOf(today);
      if (todayIdx >= 0) scrollRef.current.scrollLeft = Math.max(0, todayIdx * 44 - 150);
    }
  }, [viewMode]);

  const scheduleRange = useMemo(() => {
    const days = [];
    for (let i = 0; i < 14; i++) days.push(addDaysISO(today, i));
    return days;
  }, [today]);

  const adherenceColor = (val) => {
    if (val === null) return 'rgba(255,255,255,0.03)';
    if (val >= 1) return 'rgba(92,184,112,0.7)';
    if (val >= 0.75) return 'rgba(92,184,112,0.4)';
    if (val >= 0.5) return 'rgba(201,168,76,0.5)';
    if (val > 0) return 'rgba(201,168,76,0.3)';
    return 'rgba(220,80,80,0.3)';
  };

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

  const dayDetail = selectedDay ? {
    logs: logIndex[selectedDay] || [],
    checkin: checkinIndex[selectedDay],
    events: eventIndex[selectedDay] || [],
    adherence: adherenceMap[selectedDay],
  } : null;

  const DAY_W = 44;

  // Compact day detail panel (shared between timeline and heatmap)
  const renderDayDetail = () => {
    if (!selectedDay || !dayDetail) return null;
    return (
      <div style={{
        ...S.card, padding: '10px 12px', marginTop: 8, borderColor: T.goldM + '40',
        animation: 'fadeUp .2s ease both',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: T.fd, fontSize: 14, fontWeight: 300, color: T.t1 }}>
              {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            {dayDetail.adherence !== null && (
              <span style={{ fontSize: 9, color: adherenceColor(dayDetail.adherence), fontFamily: T.fm }}>
                {Math.round((dayDetail.adherence || 0) * 100)}%
              </span>
            )}
          </div>
          <button onClick={() => setSelectedDay(null)} style={{ background: 'none', border: 'none', color: T.t3, cursor: 'pointer', fontSize: 12, fontFamily: T.fm }}>{'\u2715'}</button>
        </div>
        {/* Events */}
        {dayDetail.events.length > 0 && dayDetail.events.map((e, i) => (
          <div key={i} style={{ fontSize: 9, color: T.teal, fontFamily: T.fm, marginBottom: 2 }}>{e.icon} {e.label}</div>
        ))}
        {/* Logs */}
        {dayDetail.logs.length > 0 ? dayDetail.logs.map((l, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: CAT_C[stack.find(c => c.id === l.cid)?.category] || T.gold }} />
              <span style={{ fontSize: 11, color: T.t1, fontFamily: T.fb }}>{l.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: T.t2, fontFamily: T.fm }}>{l.doseLabel}</span>
              <span style={{ fontSize: 8, color: T.t3, fontFamily: T.fm }}>{l.time}</span>
            </div>
          </div>
        )) : <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>No doses logged</div>}
        {/* Missed */}
        {selectedDay <= today && (() => {
          const loggedIds = new Set(dayDetail.logs.map(l => l.cid));
          const missed = stack.filter(c => {
            if (c.frequency === 'weekly') return new Date(selectedDay + 'T12:00:00').getDay() === 0 && !loggedIds.has(c.id);
            return (c.frequency === 'daily' || c.frequency === '2x_day') && !loggedIds.has(c.id);
          });
          if (missed.length === 0) return null;
          return (
            <div style={{ marginTop: 4 }}>
              {missed.map(c => (
                <span key={c.id} style={{ fontSize: 9, color: 'rgba(220,80,80,0.6)', fontFamily: T.fm, marginRight: 8 }}>{'\u2022'} {c.name}</span>
              ))}
            </div>
          );
        })()}
        {/* Checkin */}
        {dayDetail.checkin && (
          <div style={{ display: 'flex', gap: 12, marginTop: 4, paddingTop: 4, borderTop: '1px solid ' + T.border }}>
            {dayDetail.checkin.weight && <span style={{ fontSize: 10, fontFamily: T.fm }}><span style={{ color: T.t3 }}>Wt </span><span style={{ color: T.t1 }}>{dayDetail.checkin.weight}</span></span>}
            {dayDetail.checkin.waist && <span style={{ fontSize: 10, fontFamily: T.fm }}><span style={{ color: T.t3 }}>Waist </span><span style={{ color: T.t1 }}>{dayDetail.checkin.waist}</span></span>}
            {dayDetail.checkin.bf && <span style={{ fontSize: 10, fontFamily: T.fm }}><span style={{ color: T.t3 }}>BF </span><span style={{ color: T.t1 }}>{dayDetail.checkin.bf}</span></span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ animation: 'fadeUp .4s ease both' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <p style={{ fontFamily: T.fd, fontSize: 17, fontWeight: 300, color: T.t2, letterSpacing: 1, margin: 0 }}>Protocol Timeline</p>
          {cycleWeek && <p style={{ fontSize: 9, color: T.gold, fontFamily: T.fm, marginTop: 1, marginBottom: 0 }}>Week {cycleWeek}</p>}
        </div>
        {streak > 0 && <span style={{ fontSize: 9, color: T.green, fontFamily: T.fm }}>{streak}d streak</span>}
      </div>

      {/* View toggle -- smaller, more elegant */}
      <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: 2, marginBottom: 12, border: '1px solid ' + T.border }}>
        {[{ k: 'timeline', l: '90-Day' }, { k: 'heatmap', l: 'Heatmap' }, { k: 'schedule', l: '14-Day' }].map(v => (
          <button key={v.k} onClick={() => setViewMode(v.k)} style={{ ...S.segBtn, flex: 1, fontSize: 9, padding: '5px 0', borderRadius: 5, ...(viewMode === v.k ? S.segOn : {}) }}>{v.l}</button>
        ))}
      </div>

      {/* 90-Day Timeline */}
      {viewMode === 'timeline' && (
        <div>
          <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'hidden', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'flex', minWidth: timeRange.days.length * DAY_W }}>
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
                    width: DAY_W, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    padding: '3px 0', cursor: isFuture ? 'default' : 'pointer', position: 'relative',
                    borderLeft: isMonthStart ? '1px solid ' + T.border : 'none',
                    background: isSelected ? 'rgba(201,168,76,0.06)' : isToday ? 'rgba(201,168,76,0.03)' : 'transparent',
                    borderRadius: isSelected ? 6 : 0,
                    opacity: isFuture ? 0.3 : 1,
                  }}>
                    {(i === 0 || isMonthStart) && (
                      <div style={{ fontSize: 7, color: T.t3, fontFamily: T.fm, letterSpacing: 1, position: 'absolute', top: -12, left: 2 }}>
                        {new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                      </div>
                    )}
                    <div style={{
                      fontSize: 9, fontFamily: T.fm, fontWeight: isToday ? 700 : 400,
                      color: isToday ? T.gold : isWeekend ? T.t3 : T.t2,
                      width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isToday ? T.goldS : 'transparent',
                      border: isToday ? '1px solid ' + T.goldM : 'none',
                    }}>
                      {new Date(day + 'T12:00:00').getDate()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minHeight: stack.length * 7 }}>
                      {stack.map(c => {
                        const logged = dayLogs.some(l => l.cid === c.id);
                        const catColor = CAT_C[c.category] || T.gold;
                        return (
                          <div key={c.id} style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: logged ? catColor : isFuture ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
                            border: logged ? 'none' : '1px solid rgba(255,255,255,0.06)',
                          }} />
                        );
                      })}
                    </div>
                    {dayEvents.length > 0 && <div style={{ fontSize: 7, color: T.teal, lineHeight: 1 }}>{dayEvents[0].icon}</div>}
                    <div style={{ width: 24, height: 2, borderRadius: 1, background: adherenceColor(adh), marginTop: 1 }} />
                    {isToday && <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: T.goldM, zIndex: -1 }} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 4 }}>
            {stack.map(c => {
              const catColor = CAT_C[c.category] || T.gold;
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: catColor }} />
                  <span style={{ fontSize: 8, color: T.t3, fontFamily: T.fm }}>{c.name}</span>
                </div>
              );
            })}
          </div>

          {renderDayDetail()}
        </div>
      )}

      {/* Adherence Heatmap */}
      {viewMode === 'heatmap' && (
        <div>
          {(() => {
            const startDay = addDaysISO(today, -89);
            const startDow = new Date(startDay + 'T12:00:00').getDay();
            const gridStart = addDaysISO(startDay, -startDow);
            const weeks = [];
            let cur = gridStart;
            while (cur <= today) {
              const week = [];
              for (let d = 0; d < 7; d++) { week.push(cur); cur = addDaysISO(cur, 1); }
              weeks.push(week);
            }
            const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
            const cellSize = 11;
            const gap = 2;

            return (
              <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
                <div style={{ display: 'flex', gap }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap, marginRight: 3, paddingTop: cellSize + gap }}>
                    {dayLabels.map((l, i) => (
                      <div key={i} style={{ width: 10, height: cellSize, fontSize: 7, color: T.t3, fontFamily: T.fm, display: 'flex', alignItems: 'center' }}>{i % 2 === 1 ? l : ''}</div>
                    ))}
                  </div>
                  {weeks.map((week, wi) => (
                    <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap }}>
                      <div style={{ height: cellSize, fontSize: 7, color: T.t3, fontFamily: T.fm, display: 'flex', alignItems: 'center' }}>
                        {week[0].endsWith('-01') || (wi === 0 && week[0] <= today) ? new Date(week[0] + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase().slice(0, 3) : ''}
                      </div>
                      {week.map((day, di) => {
                        const adh = adherenceMap[day];
                        const inRange = day >= addDaysISO(today, -89) && day <= today;
                        return (
                          <div key={di} onClick={() => inRange && setSelectedDay(selectedDay === day ? null : day)} style={{
                            width: cellSize, height: cellSize, borderRadius: 2,
                            background: !inRange ? 'transparent' : adherenceColor(adh),
                            border: selectedDay === day ? '1px solid ' + T.gold : '1px solid rgba(255,255,255,0.03)',
                            cursor: inRange ? 'pointer' : 'default',
                          }} />
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                  <span style={{ fontSize: 7, color: T.t3, fontFamily: T.fm }}>Less</span>
                  {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
                    <div key={i} style={{ width: 9, height: 9, borderRadius: 2, background: adherenceColor(v) }} />
                  ))}
                  <span style={{ fontSize: 7, color: T.t3, fontFamily: T.fm }}>More</span>
                </div>
              </div>
            );
          })()}

          {/* Summary stats */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {[
              { label: 'Streak', value: streak + 'd', color: T.green },
              { label: '30-Day', value: (() => {
                const last30 = timeRange.days.filter(d => d >= addDaysISO(today, -29) && d <= today);
                const vals = last30.map(d => adherenceMap[d]).filter(v => v !== null && v !== undefined);
                return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 100) + '%' : '--';
              })(), color: T.gold },
              { label: 'Perfect', value: (() => {
                const last30 = timeRange.days.filter(d => d >= addDaysISO(today, -29) && d <= today);
                return last30.filter(d => adherenceMap[d] >= 1).length;
              })(), color: T.teal },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, ...S.card, padding: '8px', textAlign: 'center', marginBottom: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 300, color: s.color, fontFamily: T.fd }}>{s.value}</div>
                <div style={{ fontSize: 7, letterSpacing: 1, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {renderDayDetail()}
        </div>
      )}

      {/* 14-Day Schedule */}
      {viewMode === 'schedule' && (
        <div>
          {scheduleRange.map((day, i) => {
            const isToday = day === today;
            const dayLogs = logIndex[day] || [];
            const loggedIds = new Set(dayLogs.map(l => l.cid));
            const dayOfWeek = new Date(day + 'T12:00:00').getDay();

            const scheduled = stack.filter(c => {
              if (c.frequency === 'daily' || c.frequency === '2x_day') return true;
              if (c.frequency === 'weekly') return dayOfWeek === 0;
              if (c.frequency === '2x_week') return [1, 4].includes(dayOfWeek);
              if (c.frequency === 'intermittent') return [1, 3, 5].includes(dayOfWeek);
              return false;
            });

            const isPast = day < today;
            const allLogged = isPast && scheduled.length > 0 && scheduled.every(c => loggedIds.has(c.id));

            return (
              <div key={day} style={{
                ...S.card, padding: '8px 10px', marginBottom: 4,
                borderColor: isToday ? T.goldM : allLogged ? 'rgba(92,184,112,0.15)' : T.border,
                background: isToday ? T.goldS : allLogged ? 'rgba(92,184,112,0.03)' : 'transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: scheduled.length > 0 ? 4 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? T.gold : T.t1, fontFamily: T.fm }}>{getDayOfWeek(day)}</span>
                    <span style={{ fontSize: 10, color: T.t2, fontFamily: T.fm }}>{fmtShortDate(day)}</span>
                    {isToday && <span style={{ fontSize: 7, color: T.gold, fontFamily: T.fm, letterSpacing: 1, textTransform: 'uppercase' }}>Today</span>}
                  </div>
                  {isPast && scheduled.length > 0 && (
                    <span style={{ fontSize: 9, color: allLogged ? T.green : 'rgba(220,80,80,0.6)', fontFamily: T.fm }}>
                      {allLogged ? '\u2713' : loggedIds.size + '/' + scheduled.length}
                    </span>
                  )}
                </div>
                {scheduled.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {scheduled.map(c => {
                      const logged = loggedIds.has(c.id);
                      const catColor = CAT_C[c.category] || T.gold;
                      return (
                        <span key={c.id} style={{
                          fontSize: 8, fontFamily: T.fm, padding: '2px 6px', borderRadius: 8,
                          background: logged ? catColor + '20' : 'rgba(255,255,255,0.03)',
                          color: logged ? catColor : T.t3,
                          border: '1px solid ' + (logged ? catColor + '40' : 'rgba(255,255,255,0.06)'),
                          opacity: isPast && !logged ? 0.5 : 1,
                        }}>
                          {logged && '\u2713 '}{c.name}
                        </span>
                      );
                    })}
                  </div>
                )}
                {scheduled.length === 0 && <span style={{ fontSize: 9, color: T.t3, fontFamily: T.fm }}>Rest day</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Cycle tracker footer */}
      {cycleWeek && profile?.startDate && (
        <div style={{ ...S.card, padding: '8px 10px', marginTop: 8, borderColor: T.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>Cycle</div>
              <div style={{ fontSize: 13, fontWeight: 300, color: T.gold, fontFamily: T.fd, marginTop: 1 }}>Week {cycleWeek}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 8, color: T.t3, fontFamily: T.fm }}>Started {fmtShortDate(profile.startDate)}</div>
              <div style={{ fontSize: 9, color: T.t2, fontFamily: T.fm }}>{daysBetween(profile.startDate, today)}d in</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
            {[0, 1, 2, 3, 4, 5, 6].map(d => {
              const dayInWeek = new Date(today + 'T12:00:00').getDay();
              return <div key={d} style={{ flex: 1, height: 2, borderRadius: 1, background: d <= dayInWeek ? T.gold : 'rgba(255,255,255,0.04)' }} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* -- LogView (unchanged) ---------------------------------------- */
function LogView({ logs: rawLogs }) {
  const safe = rawLogs || [];
  const sorted = [...safe].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  const grouped = sorted.reduce((a, l) => { (a[l.date] = a[l.date] || []).push(l); return a; }, {});
  if (!sorted.length) return <div style={{ textAlign: 'center', padding: '50px 0' }}><div style={{ fontSize: 28, opacity: 0.15, marginBottom: 8 }}>{'\u25CB'}</div><p style={{ fontFamily: T.fd, fontSize: 18, fontWeight: 300, color: T.t2 }}>The log is empty</p><p style={{ fontFamily: T.fb, fontSize: 12, color: T.t3, marginTop: 6 }}>Each dose you log writes a line in the story</p></div>;
  return (
    <div style={{ animation: 'fadeUp .4s ease both' }}>{Object.entries(grouped).map(([date, entries]) => <div key={date} style={{ marginBottom: 16 }}><div style={S.logDate}>{new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>{entries.map((e, i) => <div key={i} style={S.logRow}><span style={S.logName}>{e.name}</span><span style={S.logDose}>{e.doseLabel}{e.route ? ` \u00B7 ${ROUTE_LABELS[e.route] || e.route}` : ''}</span><span style={S.logTime}>{e.time}</span></div>)}</div>)}</div>
  );
}

/* -- TrackTab root ---------------------------------------- */
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

  const handleDeleteLog = useCallback((cid, todayIndex) => {
    // Delete the Nth log for this compound on today's date
    const today = getToday();
    let count = 0;
    setLogs(p => p.filter(l => {
      if (l.cid === cid && l.date === today) {
        if (count === todayIndex) { count++; return false; }
        count++;
      }
      return true;
    }));
  }, [setLogs]);
  const handleNewVial = useCallback(id => { setVials(p => ({ ...p, [id]: { startDate: getToday(), reconDate: getToday() } })); }, [setVials]);

  const handleLogSite = useCallback(siteId => {
    setSiteLogData({ siteId, compound: '', tissueQuality: 3, notes: '' });
    setSiteLogStep('compound');
  }, []);

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
      <header style={{ ...S.header, marginBottom: 8 }}><h1 style={{ ...S.brand, fontSize: 20 }}>TRACK</h1><p style={S.sub}>Protocol Management</p></header>
      <div style={{ ...S.segWrap, marginBottom: 12 }}>{[{ k: 'today', l: 'Today' }, { k: 'vials', l: 'Vials' }, { k: 'timeline', l: 'Timeline' }, { k: 'sites', l: 'Sites' }, { k: 'log', l: 'Log' }].map(s => <button key={s.k} onClick={() => setSv(s.k)} style={{ ...S.segBtn, ...(sv === s.k ? S.segOn : {}) }}>{s.l}</button>)}</div>
      {sv === 'today' && <TodayView logs={logs} onLog={handleLog} onDeleteLog={handleDeleteLog} stack={stack} onOpenSites={() => setSv('sites')} siteAnalysis={siteAnalysis} onQuickCheckin={onNavigate ? () => onNavigate('BODY') : null} />}
      {sv === 'vials' && <VialsView vials={vials} logs={logs} onNewVial={handleNewVial} stack={stack} />}
      {sv === 'timeline' && <TimelineView logs={logs} stack={stack} checkins={checkins} profile={profile} />}
      {sv === 'sites' && <SitesView siteHistory={siteHistory} onLogSite={handleLogSite} stack={stack} siteAnalysis={siteAnalysis} siteLogStep={siteLogStep} siteLogData={siteLogData} onSiteLogStepAction={handleSiteLogStepAction} />}
      {sv === 'log' && <LogView logs={logs} />}
    </div>
  );
}
