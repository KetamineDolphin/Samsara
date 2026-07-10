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
import { ProBadge } from '../components/ProGate';
import BodyTab from './BodyTab';
import MetricsTab from './MetricsTab';

const VIEWS = [
  { k: 'charts',   label: 'Charts',   sub: 'Progress & Trajectory', owner: 'metrics', view: 'charts' },
  { k: 'checkin',  label: 'Check-in', sub: 'Body Check-in',         owner: 'body',    view: 'Check' },
  { k: 'scan',     label: 'Scan',     sub: 'AI Body Scan',          owner: 'body',    view: 'Scan',    pro: true },
  { k: 'compare',  label: 'Compare',  sub: 'Before / After',        owner: 'body',    view: 'Compare' },
  { k: 'insights', label: 'Insights', sub: 'Insights & Well-being', owner: 'metrics', view: 'insights' },
  { k: 'labs',     label: 'Labs',     sub: 'Bloodwork',             owner: 'metrics', view: 'labs',    pro: true },
];

export default function ProgressTab(props) {
  const { isPro, initialView } = props;
  const [active, setActive] = useState(
    VIEWS.some(v => v.k === initialView) ? initialView : 'charts'
  );
  const current = VIEWS.find(v => v.k === active) || VIEWS[0];

  return (
    <div>
      <header style={{ ...S.header, marginBottom: 12 }}>
        <h1 style={{ ...S.brand, fontSize: 20 }}>PROGRESS</h1>
        <p style={S.sub}>{current.sub}</p>
      </header>

      <div style={{ ...S.segWrap, overflowX: 'auto', marginBottom: 16 }}>
        {VIEWS.map(v => (
          <button
            key={v.k}
            onClick={() => setActive(v.k)}
            style={{ ...S.segBtn, ...(active === v.k ? S.segOn : {}), whiteSpace: 'nowrap', minWidth: 0, padding: '7px 10px', fontSize: 11, letterSpacing: 0.3 }}
          >
            {v.label}{v.pro && !isPro && <ProBadge />}
          </button>
        ))}
      </div>

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
