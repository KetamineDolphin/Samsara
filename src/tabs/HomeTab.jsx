import { useMemo } from 'react';
import T from '../utils/tokens';
import S from '../utils/styles';
import { getAdherenceStats } from '../data/analytics';
import { getToday, getWeekStart, localISODate, unitsOf } from '../utils/helpers';
import { FREQ_META } from '../data/library';
import { CAT_C } from '../utils/tokens';
import { SamsaraSymbol } from '../components/Shared';

const DAY = 86400000;

function isDoneToday(compound, logs, today) {
  const compoundLogs = logs.filter(l => l.cid === compound.id || l.compoundId === compound.id);
  const meta = FREQ_META[compound.frequency] || FREQ_META.daily;
  if (meta.perDay === 0) {
    if (compound.frequency === 'intermittent' || compound.frequency === 'as_needed') return true;
    const weekLogs = compoundLogs.filter(l => l.date >= getWeekStart());
    return weekLogs.length >= (meta.perWeek || 1);
  }
  const todayLogs = compoundLogs.filter(l => l.date === today);
  return todayLogs.length >= (meta.perDay || 1);
}

function PulseRing({ score, complete, total }) {
  const hasScore = total > 0 && Number.isFinite(score);
  const safeScore = hasScore ? Math.max(0, Math.min(100, score)) : 0;
  return (
    <div style={{ position: 'relative', width: 148, height: 148, flexShrink: 0 }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: `conic-gradient(${T.gold} ${safeScore * 3.6}deg, rgba(255,255,255,.055) 0deg)`,
        boxShadow: '0 0 50px rgba(201,168,76,.08)',
      }} />
      <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', background: '#0d0f12', border: `1px solid ${T.border}` }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: T.fd, color: T.t1, fontSize: 42, fontWeight: 300, lineHeight: .9 }}>{hasScore ? Math.round(safeScore) : '—'}</span>
        <span style={{ fontFamily: T.fm, fontSize: 8, color: T.gold, letterSpacing: 1.8, marginTop: 7 }}>{hasScore ? 'PULSE' : 'READY'}</span>
        {total > 0 && <span style={{ fontFamily: T.fb, fontSize: 11, color: T.t3, marginTop: 5 }}>{complete}/{total} today</span>}
      </div>
    </div>
  );
}

function Metric({ value, label, accent }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: T.fd, fontSize: 25, fontWeight: 400, color: accent || T.t1, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: T.fm, fontSize: 8, letterSpacing: 1.35, color: T.t3, textTransform: 'uppercase', marginTop: 7 }}>{label}</div>
    </div>
  );
}

export default function HomeTab({ profile, stack, logs, checkins, subjective, onNavigate, onSearch }) {
  const today = getToday();
  const adherence = useMemo(() => getAdherenceStats(logs, stack, 30), [logs, stack]);
  const protocol = useMemo(() => stack.filter(c => !['intermittent', 'as_needed'].includes(c.frequency)).map(c => ({ ...c, done: isDoneToday(c, logs, today) })), [stack, logs, today]);
  const complete = protocol.filter(c => c.done).length;
  const due = protocol.filter(c => !c.done);
  const nextDrawUnits = due.length === 1 ? unitsOf(due[0]) : 0;
  const todayPct = protocol.length ? (complete / protocol.length) * 100 : 0;
  const pulse = protocol.length && logs.length ? Math.round(todayPct * .7 + adherence.overallPct * .3) : null;
  const hasDailyRhythm = stack.some(c => (FREQ_META[c.frequency] || FREQ_META.daily).perDay > 0);

  const latestCheckin = useMemo(() => [...(checkins || [])].filter(c => c.date).sort((a, b) => b.date.localeCompare(a.date))[0], [checkins]);
  const latestState = useMemo(() => [...(subjective || [])].filter(s => s.date).sort((a, b) => b.date.localeCompare(a.date))[0], [subjective]);
  const checkinAge = latestCheckin ? Math.floor((Date.now() - new Date(latestCheckin.date + 'T12:00:00').getTime()) / DAY) : null;
  const firstName = (profile?.name || '').trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const nextMove = !stack.length
    ? { eyebrow: 'Core calculator', title: 'Calculate your first draw', body: 'Enter the vial, water, and prescribed dose. Samsara does the conversion and shows the syringe.', action: 'Open calculator', tab: 'CALC' }
    : due.length
      ? { eyebrow: `${due.length} ${due.length === 1 ? 'item' : 'items'} open`, title: due.length === 1 ? due[0].name : 'Complete today’s protocol', body: due.length === 1 && nextDrawUnits > 0 ? `Your saved mix calculates to ${nextDrawUnits.toFixed(1)} units. Verify it, then log when complete.` : 'Your next action is ready. Log it when it is actually complete.', action: 'Open today', tab: 'TRACK' }
      : (!latestState || latestState.date !== today)
        ? { eyebrow: 'Protocol complete', title: 'Capture how today feels', body: 'A 20-second state check turns dosing history into useful personal signal.', action: 'Check in', tab: 'PROGRESS', view: 'state' }
        : { eyebrow: 'Today captured', title: 'Your records are complete', body: 'Scheduled entries and today’s state are saved. Your personal history is getting more useful.', action: 'See trajectory', tab: 'PROGRESS', view: 'charts' };

  const recentDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso = localISODate(d);
    const active = stack.filter(c => (!c.addedDate || c.addedDate <= iso) && (FREQ_META[c.frequency] || FREQ_META.daily).perDay > 0);
    const expected = active.reduce((sum, c) => sum + ((FREQ_META[c.frequency] || FREQ_META.daily).perDay || 1), 0);
    const done = active.reduce((sum, c) => {
      const target = (FREQ_META[c.frequency] || FREQ_META.daily).perDay || 1;
      const actual = logs.filter(l => (l.cid === c.id || l.compoundId === c.id) && l.date === iso).length;
      return sum + Math.min(target, actual);
    }, 0);
    return { iso, label: d.toLocaleDateString('en-US', { weekday: 'narrow' }), pct: expected ? done / expected : null, isToday: i === 6 };
  });

  return (
    <div style={{ animation: 'fadeUp .45s ease both' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px 20px' }}>
        <div>
          <div style={{ fontFamily: T.fm, color: T.gold, fontSize: 9, letterSpacing: 2.2, textTransform: 'uppercase', marginBottom: 6 }}>{greeting}{firstName ? `, ${firstName}` : ''}</div>
          <h1 style={{ fontFamily: T.fd, fontWeight: 300, fontSize: 29, lineHeight: 1, color: T.t1, letterSpacing: .4 }}>Your living protocol</h1>
        </div>
        <button aria-label="Search" onClick={onSearch} style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: 13, border: `1px solid ${T.border}`, background: 'rgba(255,255,255,.025)', cursor: 'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke={T.t2} strokeWidth="1.5"/><line x1="12.5" y1="12.5" x2="17" y2="17" stroke={T.t2} strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </header>

      <button onClick={() => onNavigate('TRACK')} style={{ ...S.card, width: '100%', textAlign: 'left', cursor: 'pointer', padding: '20px 18px', marginBottom: 13, overflow: 'hidden', position: 'relative', background: 'linear-gradient(145deg,rgba(201,168,76,.085),rgba(255,255,255,.018) 55%,rgba(0,210,180,.025))', borderColor: 'rgba(201,168,76,.16)' }}>
        <div style={{ position: 'absolute', right: -46, top: -58, opacity: .11, pointerEvents: 'none' }}><SamsaraSymbol size={210} animate={false} /></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, position: 'relative' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: T.fm, color: T.t3, fontSize: 8.5, letterSpacing: 2.1, textTransform: 'uppercase' }}>Protocol pulse</div>
            <div style={{ fontFamily: T.fd, color: T.t1, fontSize: 26, fontWeight: 400, lineHeight: 1.05, marginTop: 8 }}>{!stack.length ? 'Ready when you are' : !logs.length ? 'Cycle ready' : pulse >= 90 ? 'In rhythm' : pulse >= 65 ? 'Building momentum' : 'Needs attention'}</div>
            <div style={{ fontFamily: T.fb, color: T.t2, fontSize: 12, lineHeight: 1.55, marginTop: 8, maxWidth: 175 }}>{!stack.length ? 'Your daily signal starts with one compound.' : !logs.length ? 'Your first day starts with one intentional action.' : `${adherence.overallPct}% consistency across the last 30 days.`}</div>
          </div>
          <PulseRing score={pulse} complete={complete} total={protocol.length} />
        </div>
      </button>

      <div style={{ ...S.card, padding: '17px 16px', marginBottom: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontFamily: T.fm, color: T.gold, fontSize: 8.5, letterSpacing: 1.8, textTransform: 'uppercase' }}>{nextMove.eyebrow}</div>
            <div style={{ fontFamily: T.fd, color: T.t1, fontSize: 22, fontWeight: 400, marginTop: 7 }}>{nextMove.title}</div>
            <p style={{ fontFamily: T.fb, color: T.t2, fontSize: 12, lineHeight: 1.55, marginTop: 6, maxWidth: 270 }}>{nextMove.body}</p>
          </div>
          <button onClick={() => onNavigate(nextMove.tab, nextMove.view)} style={{ ...S.logBtn, padding: '9px 12px', fontSize: 11, marginTop: 2 }}>{nextMove.action}</button>
        </div>
      </div>

      {protocol.length > 0 && <section style={{ marginBottom: 19 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '0 2px 9px' }}>
          <h2 style={{ fontFamily: T.fb, fontSize: 13, fontWeight: 650, color: T.t1 }}>Today’s protocol</h2>
          <button onClick={() => onNavigate('TRACK')} style={{ ...S.btnGhost, padding: 0, color: T.gold, fontSize: 11 }}>View all →</button>
        </div>
        <div style={{ ...S.card, padding: 0, overflow: 'hidden', marginBottom: 0 }}>
          {protocol.slice(0, 4).map((c, i) => <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderBottom: i < Math.min(protocol.length, 4) - 1 ? `1px solid ${T.border}` : 'none' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.done ? T.green : (CAT_C[c.category] || T.gold), boxShadow: c.done ? 'none' : `0 0 12px ${CAT_C[c.category] || T.goldM}` }} />
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: T.fb, fontSize: 13, fontWeight: 600, color: c.done ? T.t2 : T.t1 }}>{c.name}</div><div style={{ fontFamily: T.fm, fontSize: 9, color: T.t3, marginTop: 3 }}>{c.dose} {c.unit}{unitsOf(c) > 0 ? ` · ${unitsOf(c).toFixed(1)}u draw` : ''} · {(c.timingGroup || 'morning').replace('_', ' ')}</div></div>
            <span style={{ fontFamily: T.fm, fontSize: 8.5, letterSpacing: 1.2, color: c.done ? T.green : T.gold }}>{c.done ? 'DONE' : 'OPEN'}</span>
          </div>)}
        </div>
      </section>}

      {hasDailyRhythm && <section style={{ ...S.card, padding: '16px', marginBottom: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <div><div style={{ fontFamily: T.fb, fontWeight: 650, fontSize: 13, color: T.t1 }}>Seven-day rhythm</div><div style={{ fontFamily: T.fb, fontSize: 10.5, color: T.t3, marginTop: 3 }}>Consistency, not perfection</div></div>
          {adherence.currentStreak > 0 && <div style={{ fontFamily: T.fm, fontSize: 9, color: T.gold, letterSpacing: 1 }}>{adherence.currentStreak} DAY STREAK</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {recentDays.map(d => <div key={d.iso} style={{ flex: 1, textAlign: 'center' }}><div style={{ height: 42, borderRadius: 9, background: 'rgba(255,255,255,.035)', border: `1px solid ${d.isToday ? T.goldM : T.border}`, display: 'flex', alignItems: 'flex-end', padding: 3, overflow: 'hidden' }}><div style={{ width: '100%', height: `${d.pct == null ? 0 : Math.max(d.pct * 100, d.isToday ? 6 : 0)}%`, borderRadius: 6, background: d.pct >= 1 ? T.gold : 'rgba(201,168,76,.28)', transition: 'height .35s ease' }} /></div><div style={{ fontFamily: T.fm, fontSize: 8, color: d.isToday ? T.gold : T.t3, marginTop: 6 }}>{d.label}</div></div>)}
        </div>
      </section>}

      <section style={{ display: 'flex', gap: 10, marginBottom: 13 }}>
        <button onClick={() => onNavigate('PROGRESS', 'checkin')} style={{ ...S.card, flex: 1, margin: 0, textAlign: 'left', cursor: 'pointer', padding: '15px' }}>
          <div style={{ fontFamily: T.fm, fontSize: 8, letterSpacing: 1.4, color: T.t3 }}>BODY</div>
          <div style={{ fontFamily: T.fd, fontSize: 23, color: T.t1, marginTop: 8 }}>{latestCheckin?.weight ? `${latestCheckin.weight} ${profile?.unitSystem === 'metric' ? 'kg' : 'lb'}` : 'No baseline'}</div>
          <div style={{ fontFamily: T.fb, fontSize: 10.5, color: checkinAge != null && checkinAge > 14 ? T.amber : T.t3, marginTop: 6 }}>{checkinAge == null ? 'Add first check-in' : checkinAge === 0 ? 'Updated today' : `${checkinAge}d since check-in`}</div>
        </button>
        <button onClick={() => onNavigate('PROGRESS', 'state')} style={{ ...S.card, flex: 1, margin: 0, textAlign: 'left', cursor: 'pointer', padding: '15px' }}>
          <div style={{ fontFamily: T.fm, fontSize: 8, letterSpacing: 1.4, color: T.t3 }}>STATE</div>
          <div style={{ display: 'flex', marginTop: 10 }}>
            <Metric value={latestState?.energy || '—'} label="Energy" accent={latestState?.energy >= 7 ? T.green : T.t1} />
            <Metric value={latestState?.mood || '—'} label="Mood" />
          </div>
        </button>
      </section>

      <p style={{ textAlign: 'center', fontFamily: T.fm, fontSize: 8, letterSpacing: 1.4, color: T.t4, padding: '5px 20px 10px', textTransform: 'uppercase' }}>Observe · adjust · continue</p>
    </div>
  );
}
