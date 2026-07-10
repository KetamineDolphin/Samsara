/* SAMSARA v4.0 - ProgressTab
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Unified home for everything progress-related. Replaces the old
   separate BODY and METRICS tabs, which duplicated the same charts,
   trajectory, and weekly-summary UI. One sub-nav, one home per
   feature:
     Body composition (check-in, scan, compare)  → BodyTab
     Analytics (charts, insights, labs)           → MetricsTab
   Each child renders embedded (its own header + sub-nav hidden) and
   is told which single view to show.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import { useState } from 'react';
import T from '../utils/tokens';
import S from '../utils/styles';
import { SectionNav } from '../components/Shared';
import BodyTab from './BodyTab';
import MetricsTab from './MetricsTab';

const VIEWS = [
  { k: 'charts',   label: 'Charts',   sub: 'Progress & Trajectory', owner: 'metrics', view: 'charts' },
  { k: 'checkin',  label: 'Check-in', sub: 'Body Check-in',         owner: 'body',    view: 'Check' },
  { k: 'scan',     label: 'Scan',     sub: 'AI Body Scan',          owner: 'body',    view: 'Scan',    pro: true },
  { k: 'compare',  label: 'Compare',  sub: 'Before / After',        owner: 'body',    view: 'Compare' },
  { k: 'history',  label: 'History',  sub: 'Body History',          owner: 'body',    view: 'Log' },
  { k: 'body_insights', label: 'Body Insights', sub: 'Body Insights', owner: 'body', view: 'Insights' },
  { k: 'state',    label: 'State',    sub: 'Daily State',           owner: 'metrics', view: 'state' },
  { k: 'insights', label: 'Insights', sub: 'Insights & Well-being', owner: 'metrics', view: 'insights' },
  { k: 'labs',     label: 'Labs',     sub: 'Bloodwork',             owner: 'metrics', view: 'labs',    pro: true },
];

export default function ProgressTab(props) {
  const { isPro, initialView } = props;
  const [active, setActive] = useState(
    VIEWS.some(v => v.k === initialView) ? initialView : 'charts'
  );
  const current = VIEWS.find(v => v.k === active) || VIEWS[0];
  const group = active === 'labs' ? 'labs' : ['checkin', 'scan', 'compare', 'history', 'body_insights'].includes(active) ? 'body' : 'overview';
  const openGroup = (next) => setActive(next === 'body' ? 'checkin' : next === 'labs' ? 'labs' : 'charts');
  const actionCard = (k, title, body, pro = false) => <button key={k} onClick={() => setActive(k)} style={{ ...S.card, margin: 0, padding: '12px 13px', textAlign: 'left', cursor: 'pointer', minHeight: 78 }}><span style={{ display: 'block', fontFamily: T.fb, color: T.t1, fontWeight: 650, fontSize: 12.5 }}>{title}{pro && !isPro && <span style={{ color: T.gold, fontFamily: T.fm, fontSize: 7, marginLeft: 5 }}>PRO</span>}</span><span style={{ display: 'block', fontFamily: T.fb, color: T.t3, fontSize: 10.5, lineHeight: 1.4, marginTop: 5 }}>{body}</span></button>;

  return (
    <div>
      <header style={{ ...S.header, marginBottom: 12 }}>
        <h1 style={{ ...S.brand, fontSize: 20 }}>PROGRESS</h1>
        <p style={S.sub}>{current.sub}</p>
      </header>

      <SectionNav ariaLabel="Progress sections" value={group} onChange={openGroup} items={[{ k: 'overview', l: 'Overview' }, { k: 'body', l: 'Body' }, { k: 'labs', l: 'Labs', pro: true }]} />

      {group === 'overview' && active === 'charts' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 13 }}>{actionCard('state', 'Daily State', 'Energy, focus, hunger, and mood.')}{actionCard('insights', 'Protocol Insights', 'Adherence and weekly patterns.')}</div>}
      {group === 'body' && active === 'checkin' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 13 }}>{actionCard('scan', 'AI Scan', 'Photo-based body assessment.', true)}{actionCard('history', 'History', 'Review and edit check-ins.')}{actionCard('compare', 'Compare', 'Place two check-ins side by side.')}{actionCard('body_insights', 'Body Insights', 'Composition trends and milestones.')}</div>}
      {((group === 'overview' && active !== 'charts') || (group === 'body' && active !== 'checkin')) && <button onClick={() => setActive(group === 'body' ? 'checkin' : 'charts')} style={{ ...S.btnGhost, padding: '0 0 12px', color: T.gold }}>← Back to {group === 'body' ? 'body' : 'overview'}</button>}

      {current.owner === 'body' ? (
        <BodyTab
          embedded
          externalView={current.view}
          checkins={props.checkins}
          setCheckins={props.setCheckins}
          stack={props.stack}
          logs={props.logs}
          detectMilestones={props.detectMilestones}
          calculateTrajectory={props.calculateTrajectory}
          generateWeeklySummary={props.generateWeeklySummary}
          profile={props.profile}
          onUpgrade={props.onUpgrade}
          isPro={props.isPro}
        />
      ) : (
        <MetricsTab
          embedded
          externalView={current.view}
          checkins={props.checkins}
          logs={props.logs}
          stack={props.stack}
          subjective={props.subjective}
          setSubjective={props.setSubjective}
          detectMilestones={props.detectMilestones}
          calculateTrajectory={props.calculateTrajectory}
          generateWeeklySummary={props.generateWeeklySummary}
          getAdherenceStats={props.getAdherenceStats}
          getSubjectiveChartData={props.getSubjectiveChartData}
          profile={props.profile}
          labResults={props.labResults}
          setLabResults={props.setLabResults}
          isPro={props.isPro}
          onUpgrade={props.onUpgrade}
        />
      )}
    </div>
  );
}
