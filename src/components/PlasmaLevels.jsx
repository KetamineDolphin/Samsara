/* SAMSARA v4.0 — Plasma Levels
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Surfaces the pharmacokinetics engine: for each compound in the
   active stack, shows the idealized steady-state plasma curve
   (relative concentration), accumulation stats, and — when real
   doses are logged — a live "on-board" estimate from the actual log.

   Concentrations are RELATIVE (fraction of one dose's peak), derived
   from published half-life + time-to-peak. We never claim absolute
   ng/mL — bioavailability isn't known for research compounds — but
   the shape, accumulation, and trough/peak are meaningful and
   reproducible.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import { useMemo } from 'react';
import T from '../utils/tokens';
import S from '../utils/styles';
import LIB, { FREQ_META } from '../data/library';
import { CAT_C } from '../utils/tokens';
import {
  simulateSchedule,
  steadyState,
  currentOnBoard,
  intervalHours,
} from '../data/pharmacokinetics';

const TREND_META = {
  rising: { label: 'Rising', color: T.teal, arrow: '↗' },
  stable: { label: 'At plateau', color: T.gold, arrow: '→' },
  clearing: { label: 'Clearing', color: 'rgba(230,140,60,0.9)', arrow: '↘' },
};

/* Relative-concentration area chart (idealized schedule). */
function PlasmaChart({ points, accent, height = 84 }) {
  if (!points || points.length < 2) return null;
  const w = 300;
  const maxC = Math.max(...points.map((p) => p.conc), 0.001);
  const maxDay = points[points.length - 1].day || 1;
  const xy = points.map((p) => [
    (p.day / maxDay) * w,
    height - (p.conc / maxC) * (height - 8) - 4,
  ]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const area = `${line}L${w},${height}L0,${height}Z`;
  const gid = 'pf' + Math.round(maxDay * 100);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.30" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={accent} strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Stat({ value, label, color }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || T.t1, fontFamily: T.fm, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 7.5, letterSpacing: 1, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginTop: 3 }}>{label}</div>
    </div>
  );
}

function CompoundPlasma({ item, logs }) {
  const lib = LIB.find((l) => l.id === item.libId);
  const accent = CAT_C[lib?.category] || T.gold;
  const freqLabel = (FREQ_META[item.frequency] || {}).label || item.frequency;

  const { sim, ss, onBoard, scheduled } = useMemo(() => {
    if (!lib || !lib.halfLifeHours) return { sim: null, ss: null, onBoard: null, scheduled: false };
    const pk = { halfLifeHours: lib.halfLifeHours, peakPlasmaMinutes: lib.peakPlasmaMinutes, frequency: item.frequency };
    const scheduled = intervalHours(item.frequency) != null;
    const ssv = scheduled ? steadyState(lib.halfLifeHours, item.frequency) : null;
    // Window: ~1.3x time-to-steady-state, clamped to a readable 7–60 days.
    const days = ssv ? Math.min(60, Math.max(7, Math.ceil(ssv.timeToSteadyStateDays * 1.3))) : 14;
    const simv = scheduled ? simulateSchedule(pk, days, 8) : null;
    const cLogs = (logs || []).filter((l) => l.cid === item.id);
    const ob = currentOnBoard(cLogs, pk);
    return { sim: simv, ss: ssv, onBoard: ob, scheduled };
  }, [lib, item.libId, item.id, item.frequency, logs]);

  if (!lib || !lib.halfLifeHours) return null;

  const trend = onBoard ? TREND_META[onBoard.trend] || TREND_META.clearing : null;

  return (
    <div style={{ ...S.card, padding: '13px 14px', marginBottom: 12, borderLeft: `3px solid ${accent}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.t1, fontFamily: T.fb }}>{item.name}</span>
        <span style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, letterSpacing: 0.5 }}>
          t½ {lib.halfLifeHours < 1 ? Math.round(lib.halfLifeHours * 60) + ' min' : lib.halfLifeHours + ' h'} {'·'} {freqLabel}
        </span>
      </div>

      {scheduled && sim && sim.points.length > 1 ? (
        <>
          <PlasmaChart points={sim.points} accent={accent} />
          <div style={{ fontSize: 7.5, color: T.t3, fontFamily: T.fm, textAlign: 'right', marginTop: 2, letterSpacing: 0.5 }}>
            RELATIVE PLASMA {'·'} {sim.points[sim.points.length - 1].day}-DAY VIEW
          </div>
          {ss && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
              <Stat value={ss.plateaus ? ss.accumulationRatio.toFixed(1) + '×' : 'None'} label="Accumulation" color={ss.plateaus ? accent : T.t2} />
              <Stat value={ss.plateaus ? ss.timeToSteadyStateDays < 1 ? '<1d' : Math.round(ss.timeToSteadyStateDays) + 'd' : '—'} label="To steady state" />
              <Stat value={Math.round(ss.fluctuationPct) + '%'} label="Peak–trough swing" />
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fb, lineHeight: 1.5, padding: '4px 0' }}>
          As-needed / no fixed schedule — steady-state accumulation doesn't apply. Log doses to see a live on-board estimate below.
        </div>
      )}

      {onBoard && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>On board now</span>
            <span style={{ fontSize: 10, color: trend.color, fontFamily: T.fm, fontWeight: 600 }}>{trend.arrow} {trend.label}</span>
          </div>
          {onBoard.pctOfSteadyPeak != null && scheduled ? (
            <>
              <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: Math.min(100, onBoard.pctOfSteadyPeak) + '%', background: accent, borderRadius: 4, boxShadow: `0 0 6px ${accent}`, transition: 'width .8s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                <span style={{ fontSize: 10, color: T.t2, fontFamily: T.fm }}>{'≈'} {Math.min(100, onBoard.pctOfSteadyPeak)}% of steady-state peak</span>
                <span style={{ fontSize: 9, color: T.t3, fontFamily: T.fm }}>last dose {onBoard.lastDoseHoursAgo < 1 ? '<1h' : Math.round(onBoard.lastDoseHoursAgo) + 'h'} ago</span>
              </div>
            </>
          ) : (
            <span style={{ fontSize: 10, color: T.t2, fontFamily: T.fm }}>Last dose {onBoard.lastDoseHoursAgo < 1 ? '<1h' : Math.round(onBoard.lastDoseHoursAgo) + 'h'} ago {'·'} still active</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlasmaLevels({ stack, logs }) {
  const active = (stack || []).filter((item) => {
    const lib = LIB.find((l) => l.id === item.libId);
    return lib && lib.halfLifeHours > 0;
  });

  if (active.length === 0) {
    return (
      <div style={{ animation: 'fadeUp .4s ease both', textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ fontFamily: T.fd, fontSize: 20, fontWeight: 300, color: T.t2, letterSpacing: 1, margin: '0 0 8px' }}>No compounds yet</p>
        <p style={{ fontFamily: T.fb, fontSize: 12, color: T.t3, lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>
          Add compounds to your protocol to see modeled plasma levels, accumulation, and a live on-board estimate from your dose log.
        </p>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeUp .4s ease both' }}>
      <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fb, lineHeight: 1.5, marginBottom: 12 }}>
        Modeled from each compound's half-life and time-to-peak (one-compartment Bateman model). Values are relative and educational — not absolute blood levels.
      </div>
      {active.map((item) => (
        <CompoundPlasma key={item.id} item={item} logs={logs} />
      ))}
    </div>
  );
}
