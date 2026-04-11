/* SAMSARA v4.0 - Root Application */
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import T from './utils/tokens';
import S from './utils/styles';
import { DEFAULT_STACK } from './data/library';
import { useStorage } from './hooks/useStorage';
import { TabIcons } from './components/Shared';
import OnboardingFlow from './components/OnboardingFlow';
import CalcTab from './tabs/CalcTab';
import TrackTab from './tabs/TrackTab';
import BodyTab from './tabs/BodyTab';
import MetricsTab from './tabs/MetricsTab';
import ProfileTab from './tabs/ProfileTab';
import SearchOverlay from './components/SearchOverlay';
import { DisclaimerGate } from './components/Disclaimers';
import ErrorBoundary from './components/ErrorBoundary';
import { detectMilestones, calculateTrajectory, generateWeeklySummary, getAdherenceStats, logSubjective, getSubjectiveChartData } from './data/analytics';
import { initNotifications, isSupported } from './utils/notifications';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600;700&family=Libre+Franklin:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
input[type=number]{-moz-appearance:textfield}
input[type=text],input[type=file]{-webkit-appearance:none}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes enso{from{stroke-dashoffset:600}to{stroke-dashoffset:30}}
@keyframes checkPop{0%{transform:scale(0)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}
@keyframes breathe{0%,100%{opacity:0.4;filter:blur(0px)}50%{opacity:0.7;filter:blur(0.3px)}}
@keyframes samsaraBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.025)}}
@keyframes samsaraSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes samsaraPetal{0%,100%{opacity:0.25;transform:scale(0.92)}50%{opacity:0.85;transform:scale(1)}}
@keyframes samsaraOuterPulse{0%,100%{opacity:0.08}50%{opacity:0.2}}
@keyframes logPress{0%{transform:scale(1)}40%{transform:scale(0.94)}70%{transform:scale(1.04)}100%{transform:scale(1)}}
@keyframes checkSpring{0%{transform:scale(0) rotate(-10deg)}50%{transform:scale(1.2) rotate(0deg)}100%{transform:scale(1) rotate(0deg)}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
::-webkit-scrollbar{display:none}
`;

const TABS = ['CALC', 'TRACK', 'BODY', 'METRICS', 'PROFILE'];

export default function App() {
  // Split storage - each key persisted independently
  const [cs, setCs] = useStorage('calc', { vialMg: '', waterMl: '2', doseMcg: '', doseUnit: 'mcg', freq: 'daily', waterLocked: false, activePreset: null });
  const [logs, setLogs] = useStorage('logs', []);
  const [vials, setVials] = useStorage('vials', {});
  const [stack, setStack] = useStorage('stack', DEFAULT_STACK);
  const [checkins, setCheckins] = useStorage('checkins', []);
  const [siteHistory, setSiteHistory] = useStorage('sites', []);
  const [subjective, setSubjective] = useStorage('subjective', []);
  const [labResults, setLabResults] = useStorage('labs', []);
  const [settings, setSettings] = useStorage('settings', {
    tab: 'CALC',
    notificationsEnabled: false,
    dailyReminderEnabled: true,
    dailyReminderHour: 8,
    dailyReminderMinute: 0,
    weeklyDoseEnabled: true,
    vialExpiryEnabled: true,
    streakEnabled: true,
    sundaySummaryEnabled: true,
  });
  const [profile, setProfile] = useStorage('profile', {
    name: '',
    age: null,
    height: { feet: 5, inches: 10 },
    currentWeight: null,
    currentWaist: null,
    targetWeight: null,
    targetWaist: null,
    targetBodyFat: null,
    goalDate: null,
    primaryGoal: 'recomp',
    biologicalSex: 'male',
    startDate: null,
    onboardingComplete: false,
    unitSystem: 'imperial',
    tier: 'free',
  });

  const tab = settings.tab || 'CALC';
  const setTab = (t) => setSettings(p => ({ ...p, tab: t }));
  // Pro upgrade UI kept in codebase but not active
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [focusCompoundId, setFocusCompoundId] = useState(null);

  const handleOnboardingComplete = (quickStartCompound) => {
    if (quickStartCompound) {
      // Quick Start: add the single compound to the stack
      const c = quickStartCompound;
      const stackEntry = {
        id: c.id,
        name: c.name,
        category: c.category,
        vialMg: c.defaultVialMg,
        dose: c.defaultDose,
        unit: c.defaultUnit,
        frequency: c.frequency,
        timing: c.timing,
        addedAt: new Date().toISOString(),
      };
      setStack([stackEntry]);
      // Pre-load calculator with this compound
      setCs({
        vialMg: String(c.defaultVialMg),
        waterMl: String(c.defaultWaterMl || 2),
        doseMcg: String(c.defaultDose),
        doseUnit: c.defaultUnit,
        freq: c.frequency,
        waterLocked: true,
        activePreset: c.name,
      });
    }
  };

  // Init notifications on load + when stack/vials/settings change
  useEffect(() => {
    if (settings.notificationsEnabled && isSupported() && profile?.onboardingComplete) {
      initNotifications({ stack, vials, logs, settings });
    }
  }, [settings.notificationsEnabled, settings.dailyReminderEnabled, settings.dailyReminderHour, settings.dailyReminderMinute, settings.weeklyDoseEnabled, settings.vialExpiryEnabled, settings.streakEnabled, settings.sundaySummaryEnabled, stack, vials]);

  const contentRef = useRef(null);
  useEffect(() => { if (contentRef.current) contentRef.current.scrollTop = 0; }, [tab]);

  return (
    <ErrorBoundary>
      <style>{CSS}</style>
      {!profile || !profile.onboardingComplete ? (
        <OnboardingFlow profile={profile} setProfile={setProfile} onComplete={handleOnboardingComplete} settings={settings} setSettings={setSettings} />
      ) : !settings.disclaimerAccepted ? (
        <DisclaimerGate onAccept={() => setSettings(p => ({ ...p, disclaimerAccepted: true }))} />
      ) : (
        <div style={S.root}><div style={S.bgGlow} />
          <div ref={contentRef} style={S.content}>
            {tab === 'CALC' && <CalcTab cs={cs} setCs={setCs} stack={stack} profile={profile} />}
            {tab === 'TRACK' && <TrackTab logs={logs} setLogs={setLogs} vials={vials} setVials={setVials} stack={stack} siteHistory={siteHistory} setSiteHistory={setSiteHistory} subjective={subjective} setSubjective={setSubjective} checkins={checkins} profile={profile} onNavigate={setTab} />}
            {tab === 'BODY' && <BodyTab checkins={checkins} setCheckins={setCheckins} stack={stack} logs={logs} subjective={subjective} setSubjective={setSubjective} detectMilestones={detectMilestones} calculateTrajectory={calculateTrajectory} generateWeeklySummary={generateWeeklySummary} profile={profile} />}
            {tab === 'METRICS' && <MetricsTab checkins={checkins} logs={logs} stack={stack} subjective={subjective} detectMilestones={detectMilestones} calculateTrajectory={calculateTrajectory} generateWeeklySummary={generateWeeklySummary} getAdherenceStats={getAdherenceStats} getSubjectiveChartData={getSubjectiveChartData} profile={profile} labResults={labResults} setLabResults={setLabResults} />}
            {tab === 'PROFILE' && <ProfileTab stack={stack} setStack={setStack} profile={profile} setProfile={setProfile} logs={logs} checkins={checkins} settings={settings} setSettings={setSettings} focusCompoundId={focusCompoundId} clearFocusCompound={() => setFocusCompoundId(null)} />}
          </div>
          {/* UpgradeScreen available in ProGate.jsx when ready for IAP */}
          {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} onNavigate={(t, compoundId) => { if (compoundId) setFocusCompoundId(compoundId); setTab(t); setShowSearch(false); }} logs={logs} checkins={checkins} stack={stack} labResults={labResults} />}
          <nav style={S.tabBar}>
            <button onClick={() => setShowSearch(true)} style={{ ...S.tabBtn, opacity: 0.6 }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="rgba(140,160,180,0.6)" strokeWidth="1.5" /><line x1="12.5" y1="12.5" x2="17" y2="17" stroke="rgba(140,160,180,0.6)" strokeWidth="1.5" strokeLinecap="round" /></svg>
              <span style={{ ...S.tabLabel, color: 'rgba(140,160,180,0.4)' }}>SEARCH</span>
            </button>
            {TABS.map(t => { const active = tab === t, color = active ? T.amberFull : 'rgba(140,160,180,0.4)';
            return <button key={t} onClick={() => setTab(t)} style={S.tabBtn}>{TabIcons[t](color)}<span style={{ ...S.tabLabel, color, fontWeight: active ? 700 : 400 }}>{t}</span>{active && <div style={S.tabLine} />}</button>;
          })}</nav>
        </div>
      )}
    </ErrorBoundary>
  );
}
