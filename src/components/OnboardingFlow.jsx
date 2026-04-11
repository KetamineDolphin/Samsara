/* SAMSARA v3.7 - OnboardingFlow (5 screens + Quick Start + notification prompt) */
import { useState, useMemo } from 'react';
import T from '../utils/tokens';
import S from '../utils/styles';
import { SamsaraSymbol } from './Shared';
import { isSupported, requestPermission } from '../utils/notifications';
import LIB from '../data/library';

const GOALS = [
  { value: 'fat_loss', title: 'Fat Loss', desc: 'Reduce body fat while preserving muscle' },
  { value: 'recomp', title: 'Recomp', desc: 'Lose fat and gain muscle simultaneously' },
  { value: 'performance', title: 'Performance', desc: 'Optimize energy, recovery, and output' },
  { value: 'health', title: 'Health', desc: 'Longevity, hormonal balance, and wellness' },
];

const formatGoalLabel = (val) => {
  const map = { fat_loss: 'Fat Loss', recomp: 'Recomp', performance: 'Performance', health: 'Health' };
  return map[val] || val || '-';
};

const formatHeight = (p) => {
  if (p.unitSystem === 'metric' && p.heightCm) return p.heightCm + ' cm';
  if (p.height && p.height.feet) return p.height.feet + '\'' + (p.height.inches || '0') + '"';
  return '-';
};

/* --- input row with suffix tag (stable ref outside component) --- */
function InputWithTag({ label, value, onChange, placeholder, tag, inputMode, type, style: extraStyle }) {
  return (
    <div style={{ ...extraStyle }}>
      {label && <label style={S.label}>{label}</label>}
      <div style={S.frow}>
        <input
          type={type || 'number'}
          inputMode={inputMode || 'decimal'}
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder}
          style={{ ...S.input, flex: 1, fontSize: 15 }}
        />
        {tag && <span style={S.tag}>{tag}</span>}
      </div>
    </div>
  );
}

/* --- shared styles --- */
const goldBtn = {
  ...S.logBtn, width: '100%', padding: '14px', textAlign: 'center',
  fontSize: 14, fontWeight: 600, letterSpacing: 0.5,
};

const titleStyle = {
  fontFamily: T.fd, fontSize: 28, fontWeight: 300, color: T.t1, marginBottom: 8,
};

const subtitleStyle = {
  fontFamily: T.fb, fontSize: 13, color: T.t3, lineHeight: 1.6, marginBottom: 24,
};

const skipBtn = {
  fontSize: 12, color: T.t3, fontFamily: T.fm, cursor: 'pointer',
  textAlign: 'center', background: 'none', border: 'none', width: '100%', padding: 8,
};

/* --- Quick Start: popular compounds for single-compound users --- */
const QS_POPULAR_IDS = ['semaglutide', 'tirzepatide', 'retatrutide', 'ipamorelin', 'cjc_nodac', 'tesamorelin', 'bpc157', 'tb500'];
const QS_POPULAR = QS_POPULAR_IDS.map(id => LIB.find(c => c.id === id)).filter(Boolean);

export default function OnboardingFlow({ profile, setProfile, onComplete, settings, setSettings }) {
  const [screen, setScreen] = useState(1);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [quickStart, setQuickStart] = useState(false);
  const [qsScreen, setQsScreen] = useState(1); // 1 = pick compound, 2 = basic info + confirm
  const [qsSearch, setQsSearch] = useState('');
  const [qsCompound, setQsCompound] = useState(null);
  const [qsDraft, setQsDraft] = useState({ currentWeight: '', biologicalSex: 'male', unitSystem: 'imperial' });

  /* --- Quick Start: filtered compounds list --- */
  const qsFiltered = useMemo(() => {
    if (!qsSearch.trim()) return QS_POPULAR;
    const q = qsSearch.toLowerCase().trim();
    return LIB.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q))
    ).slice(0, 12);
  }, [qsSearch]);

  /* local draft so we don't write to storage on every keystroke */
  const [draft, setDraft] = useState({
    name: profile.name || '',
    age: profile.age || '',
    biologicalSex: profile.biologicalSex || 'male',
    unitSystem: profile.unitSystem || 'imperial',
    heightFeet: profile.onboardingComplete && profile.height ? String(profile.height.feet || '') : '',
    heightInches: profile.onboardingComplete && profile.height ? String(profile.height.inches || '') : '',
    heightCm: '',
    currentWeight: profile.currentWeight ? String(profile.currentWeight) : '',
    currentWaist: profile.currentWaist ? String(profile.currentWaist) : '',
    targetWeight: profile.targetWeight ? String(profile.targetWeight) : '',
    targetWaist: profile.targetWaist ? String(profile.targetWaist) : '',
    targetBodyFat: profile.targetBodyFat ? String(profile.targetBodyFat) : '',
    primaryGoal: profile.primaryGoal || 'recomp',
    goalDate: profile.goalDate || '',
  });

  const set = (key, val) => setDraft(p => ({ ...p, [key]: val }));
  const next = () => setScreen(s => Math.min(s + 1, 5));
  const back = () => setScreen(s => Math.max(s - 1, 1));

  const isImperial = draft.unitSystem === 'imperial';
  const wUnit = isImperial ? 'lbs' : 'kg';
  const waUnit = isImperial ? 'in' : 'cm';
  const hUnit = isImperial ? null : 'cm';

  /* --- validation --- */
  const s2Valid = draft.age && parseFloat(draft.age) > 0 && parseFloat(draft.age) < 120;
  const s3Valid = draft.currentWeight && parseFloat(draft.currentWeight) > 0 && draft.currentWaist && parseFloat(draft.currentWaist) > 0;
  const s4Valid = draft.targetWeight && parseFloat(draft.targetWeight) > 0 && draft.targetWaist && parseFloat(draft.targetWaist) > 0;

  /* --- screen 7 projection helpers --- */
  const weightDiff = (draft.currentWeight && draft.targetWeight) ? Math.abs(parseFloat(draft.currentWeight) - parseFloat(draft.targetWeight)) : null;
  const daysToGoal = (() => {
    if (!draft.goalDate) return null;
    const now = new Date();
    const goal = new Date(draft.goalDate + 'T00:00:00');
    const d = Math.floor((goal - now) / (1000 * 60 * 60 * 24));
    return d > 0 ? d : null;
  })();

  /* --- finish handler --- */
  const completeOnboarding = () => {
    const heightObj = isImperial
      ? { feet: parseInt(draft.heightFeet) || 5, inches: parseInt(draft.heightInches) || 10 }
      : { cm: parseInt(draft.heightCm) || 170 };
    const finalProfile = {
      ...profile,
      name: draft.name,
      age: parseInt(draft.age) || null,
      biologicalSex: draft.biologicalSex,
      unitSystem: draft.unitSystem,
      height: heightObj,
      currentWeight: parseFloat(draft.currentWeight) || null,
      currentWaist: parseFloat(draft.currentWaist) || null,
      targetWeight: parseFloat(draft.targetWeight) || null,
      targetWaist: parseFloat(draft.targetWaist) || null,
      targetBodyFat: parseFloat(draft.targetBodyFat) || null,
      primaryGoal: draft.primaryGoal,
      goalDate: draft.goalDate || null,
      startDate: new Date().toISOString().slice(0, 10),
      onboardingComplete: true,
    };
    setProfile(finalProfile);
    onComplete();
  };

  const handleFinish = () => {
    if (isSupported() && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      setShowNotifPrompt(true);
    } else {
      completeOnboarding();
    }
  };

  /* --- Quick Start completion --- */
  const completeQuickStart = () => {
    const c = qsCompound;
    if (!c) return;
    const isImp = qsDraft.unitSystem === 'imperial';
    const finalProfile = {
      ...profile,
      name: '',
      age: null,
      biologicalSex: qsDraft.biologicalSex,
      unitSystem: qsDraft.unitSystem,
      height: isImp ? { feet: 5, inches: 10 } : { cm: 175 },
      currentWeight: parseFloat(qsDraft.currentWeight) || null,
      currentWaist: null,
      targetWeight: null,
      targetWaist: null,
      targetBodyFat: null,
      primaryGoal: 'recomp',
      goalDate: null,
      startDate: new Date().toISOString().slice(0, 10),
      onboardingComplete: true,
      quickStartCompound: c.id,
    };
    setProfile(finalProfile);
    onComplete(c); // pass compound so App can add to stack
  };

  const finishCurrentFlow = () => {
    if (quickStart) completeQuickStart();
    else completeOnboarding();
  };

  const handleNotifEnable = async () => {
    const result = await requestPermission();
    if (result === 'granted' && setSettings) {
      setSettings(p => ({ ...p, notificationsEnabled: true }));
    }
    finishCurrentFlow();
  };

  const handleNotifSkip = () => {
    finishCurrentFlow();
  };

  const handleQsFinish = () => {
    if (isSupported() && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      setShowNotifPrompt(true);
    } else {
      completeQuickStart();
    }
  };

  /* --- progress dots --- */
  const renderDots = () => {
    if (quickStart) {
      return (
        <div style={{ paddingTop: 20, paddingBottom: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
          {[1, 2].map(i => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i <= qsScreen ? T.gold : 'rgba(255,255,255,0.08)',
            }} />
          ))}
        </div>
      );
    }
    if (screen === 1) return null;
    return (
      <div style={{ paddingTop: 20, paddingBottom: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i <= screen ? T.gold : 'rgba(255,255,255,0.08)',
          }} />
        ))}
      </div>
    );
  };

  /* --- back button --- */
  const renderBack = () => {
    if (quickStart) return null; // QS has inline back buttons
    if (screen <= 1) return null;
    return (
      <div style={{ width: '100%', maxWidth: 480, padding: '0 20px' }}>
        <button onClick={back} style={{
          background: 'none', border: 'none', color: T.t2, fontFamily: T.fm,
          fontSize: 12, cursor: 'pointer', padding: '4px 0',
        }}>{'\u2190'} Back</button>
      </div>
    );
  };

  /* --- continue button helper --- */
  const continueBtn = (valid, label) => (
    <button onClick={next} disabled={!valid} style={{
      ...goldBtn, ...(valid ? {} : { opacity: 0.4, cursor: 'default' }),
    }}>{label || 'Continue \u2192'}</button>
  );

  /* ======================================================================
     QUICK START SCREENS
     ====================================================================== */
  const renderQsScreen = () => {
    const catColor = (cat) => {
      const map = { 'GH Secretagogue': T.teal, 'Fat Loss': T.gold, 'Recovery': T.green, 'Cognitive': T.purple, 'Hormonal': T.amber };
      return map[cat] || T.t2;
    };

    switch (qsScreen) {
      /* ======================== QS1: PICK COMPOUND ======================== */
      case 1:
        return (
          <div>
            <h2 style={titleStyle}>What are you taking?</h2>
            <p style={subtitleStyle}>Pick your compound and we{'\u2019'}ll set everything up.</p>

            <div style={{ marginBottom: 16 }}>
              <input
                type="text"
                value={qsSearch}
                onChange={e => setQsSearch(e.target.value)}
                placeholder="Search compounds..."
                style={{ ...S.input, width: '100%', fontSize: 14, padding: '10px 14px' }}
              />
            </div>

            {!qsSearch.trim() && (
              <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>Popular</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {qsFiltered.map(c => {
                const selected = qsCompound && qsCompound.id === c.id;
                return (
                  <button key={c.id} onClick={() => setQsCompound(c)} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px', borderRadius: 10,
                    background: selected ? T.goldS : 'rgba(255,255,255,0.02)',
                    border: '1px solid ' + (selected ? T.goldM : T.border),
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'all .2s ease',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: selected ? T.gold : T.t1, fontFamily: T.fb }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: catColor(c.category), fontFamily: T.fm, marginTop: 2 }}>{c.category}</div>
                    </div>
                    <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, textAlign: 'right' }}>
                      {c.defaultDose}{c.defaultUnit} {c.frequency === 'weekly' ? '/wk' : '/day'}
                    </div>
                    {selected && <span style={{ color: T.gold, fontSize: 16 }}>{'\u2713'}</span>}
                  </button>
                );
              })}
              {qsFiltered.length === 0 && (
                <p style={{ fontSize: 12, color: T.t3, fontFamily: T.fm, textAlign: 'center', padding: 20 }}>No compounds found. Try a different search.</p>
              )}
            </div>

            <button onClick={() => setQsScreen(2)} disabled={!qsCompound} style={{
              ...goldBtn, ...(qsCompound ? {} : { opacity: 0.4, cursor: 'default' }),
            }}>Continue {'\u2192'}</button>
            <div style={{ height: 8 }} />
            <button onClick={() => { setQuickStart(false); setQsScreen(1); setQsCompound(null); setQsSearch(''); }} style={skipBtn}>{'\u2190'} Full Setup Instead</button>
          </div>
        );

      /* ======================== QS2: BASIC INFO + CONFIRM ======================== */
      case 2: {
        const c = qsCompound;
        const qsWUnit = qsDraft.unitSystem === 'imperial' ? 'lbs' : 'kg';
        const qsValid = true; // weight optional in quick start
        return (
          <div>
            <h2 style={titleStyle}>Almost There</h2>
            <p style={subtitleStyle}>Just the basics — you can fill in the rest later in Profile.</p>

            {/* Compound summary card */}
            <div style={{ ...S.card, padding: '14px 16px', marginBottom: 20, borderColor: T.goldM, background: T.goldS }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.gold, fontFamily: T.fb }}>{c.name}</div>
              <div style={{ fontSize: 11, color: T.t2, fontFamily: T.fm, marginTop: 4 }}>
                {c.defaultDose}{c.defaultUnit} · {c.frequency} · Vial: {c.defaultVialMg}mg
              </div>
              <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginTop: 6, lineHeight: 1.5 }}>{c.description}</div>
            </div>

            {/* Unit system toggle */}
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Units</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ v: 'imperial', l: 'Imperial' }, { v: 'metric', l: 'Metric' }].map(o => (
                  <button key={o.v} onClick={() => setQsDraft(p => ({ ...p, unitSystem: o.v }))} style={{
                    ...S.freqBtn, flex: 1, padding: '10px 4px', fontSize: 11, fontFamily: T.fm,
                    ...(qsDraft.unitSystem === o.v ? S.freqOn : {}),
                  }}>{o.l}</button>
                ))}
              </div>
            </div>

            {/* Biological sex */}
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Biological Sex</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ v: 'male', l: 'Male' }, { v: 'female', l: 'Female' }].map(o => (
                  <button key={o.v} onClick={() => setQsDraft(p => ({ ...p, biologicalSex: o.v }))} style={{
                    ...S.freqBtn, flex: 1, padding: '10px 4px', fontSize: 11, fontFamily: T.fm,
                    ...(qsDraft.biologicalSex === o.v ? S.freqOn : {}),
                  }}>{o.l}</button>
                ))}
              </div>
            </div>

            {/* Weight (optional) */}
            <InputWithTag
              label={<>Current Weight <span style={{ color: T.t3 }}>(optional)</span></>}
              value={qsDraft.currentWeight}
              onChange={e => setQsDraft(p => ({ ...p, currentWeight: e.target.value }))}
              placeholder={qsDraft.unitSystem === 'imperial' ? 'lbs' : 'kg'}
              tag={qsWUnit}
              style={{ marginBottom: 16 }}
            />

            <div style={{ height: 8 }} />

            {/* What you'll get */}
            <div style={{
              padding: '12px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.02)', border: '1px solid ' + T.border,
              marginBottom: 20,
            }}>
              <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>You{'\u2019'}ll get</div>
              {[
                'Calculator pre-loaded with ' + c.name,
                'Dose tracking & vial management',
                'Body composition tracking',
                'AI progress analysis',
              ].map((item, i) => (
                <div key={i} style={{ fontSize: 12, color: T.t2, fontFamily: T.fm, lineHeight: 1.8 }}>
                  <span style={{ color: T.gold, marginRight: 6 }}>{'\u2713'}</span>{item}
                </div>
              ))}
            </div>

            <button onClick={handleQsFinish} style={{ ...goldBtn, background: T.gold, color: T.bg, fontWeight: 700 }}>
              Start with {c.name} {'\u2192'}
            </button>
            <div style={{ height: 8 }} />
            <button onClick={() => setQsScreen(1)} style={skipBtn}>{'\u2190'} Change Compound</button>
          </div>
        );
      }

      default: return null;
    }
  };

  /* ======================================================================
     FULL ONBOARDING SCREENS
     ====================================================================== */
  const renderScreen = () => {
    switch (screen) {

      /* ======================== SCREEN 1: WELCOME ======================== */
      case 1:
        return (
          <div style={{ paddingTop: 100, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><SamsaraSymbol size={64} detail="full" /></div>
            <h1 style={{
              fontFamily: T.fd, fontSize: 32, fontWeight: 300, letterSpacing: 10,
              color: T.t1, textAlign: 'center', marginTop: 12,
            }}>SAMSARA</h1>
            <p style={{
              fontFamily: T.fm, fontSize: 12, letterSpacing: 4, color: T.t3,
              textAlign: 'center', marginTop: 8, textTransform: 'uppercase',
            }}>Become.</p>
            <div style={{ height: 48 }} />
            <button onClick={next} style={goldBtn}>Begin Your Protocol</button>
            <div style={{ height: 12 }} />
            <button onClick={() => { setQuickStart(true); setQsScreen(1); }} style={{
              ...goldBtn,
              background: 'none',
              border: '1px solid ' + T.goldM,
              color: T.gold,
              fontWeight: 500,
              fontSize: 13,
            }}>Quick Start — One Compound</button>
            <p style={{
              fontFamily: T.fm, fontSize: 10, color: T.t3,
              textAlign: 'center', marginTop: 12, lineHeight: 1.5,
            }}>For GLP-1, TRT, or single peptide users</p>
          </div>
        );

      /* ======================== SCREEN 2: ABOUT YOU ======================== */
      case 2:
        return (
          <div>
            <h2 style={titleStyle}>About You</h2>
            <div style={{ height: 8 }} />

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Name <span style={{ color: T.t3 }}>(optional)</span></label>
              <input type='text' value={draft.name} onChange={e => set('name', e.target.value)} placeholder='What should we call you?' style={{ ...S.input, width: '100%', fontSize: 15 }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Age</label>
              <input type='number' inputMode='numeric' value={draft.age} onChange={e => set('age', e.target.value)} placeholder='Age' style={{ ...S.input, width: '100%', fontSize: 15 }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Biological Sex</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ v: 'male', l: 'Male' }, { v: 'female', l: 'Female' }, { v: 'prefer_not_to_say', l: 'Prefer not to say' }].map(o => (
                  <button key={o.v} onClick={() => set('biologicalSex', o.v)} style={{
                    ...S.freqBtn, flex: 1, padding: '10px 4px', fontSize: 11, fontFamily: T.fm,
                    ...(draft.biologicalSex === o.v ? S.freqOn : {}),
                  }}>{o.l}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Unit System</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ v: 'imperial', l: 'Imperial' }, { v: 'metric', l: 'Metric' }].map(o => (
                  <button key={o.v} onClick={() => set('unitSystem', o.v)} style={{
                    ...S.freqBtn, flex: 1, padding: '10px 4px', fontSize: 11, fontFamily: T.fm,
                    ...(draft.unitSystem === o.v ? S.freqOn : {}),
                  }}>{o.l}</button>
                ))}
              </div>
            </div>

            <div style={{ height: 24 }} />
            {continueBtn(s2Valid)}
          </div>
        );

      /* ======================== SCREEN 3: CURRENT STATS ======================== */
      case 3:
        return (
          <div>
            <h2 style={titleStyle}>Where You Are</h2>
            <p style={subtitleStyle}>Your starting point. Honest data drives honest results.</p>

            {isImperial ? (
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Height</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={S.frow}>
                      <input type='number' inputMode='numeric' value={draft.heightFeet} onChange={e => set('heightFeet', e.target.value)} placeholder='ft' style={{ ...S.input, flex: 1, fontSize: 15 }} />
                      <span style={S.tag}>ft</span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={S.frow}>
                      <input type='number' inputMode='numeric' value={draft.heightInches} onChange={e => set('heightInches', e.target.value)} placeholder='in' style={{ ...S.input, flex: 1, fontSize: 15 }} />
                      <span style={S.tag}>in</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <InputWithTag label='Height' value={draft.heightCm} onChange={e => set('heightCm', e.target.value)} placeholder='cm' tag='cm' style={{ marginBottom: 16 }} />
            )}

            <InputWithTag label='Current Weight' value={draft.currentWeight} onChange={e => set('currentWeight', e.target.value)} placeholder={wUnit} tag={wUnit} style={{ marginBottom: 16 }} />
            <InputWithTag label='Current Waist' value={draft.currentWaist} onChange={e => set('currentWaist', e.target.value)} placeholder={waUnit} tag={waUnit} style={{ marginBottom: 16 }} />

            <div style={{ height: 24 }} />
            {continueBtn(s3Valid)}
          </div>
        );

      /* ======================== SCREEN 4: YOUR GOALS ======================== */
      case 4:
        return (
          <div>
            <h2 style={titleStyle}>Where You{'\''}re Going</h2>
            <div style={{ height: 8 }} />

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Primary Goal</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {GOALS.map(g => (
                  <button key={g.value} onClick={() => set('primaryGoal', g.value)} style={{
                    ...S.freqBtn, flex: '1 1 45%', padding: '10px 8px', fontSize: 11, fontFamily: T.fm,
                    ...(draft.primaryGoal === g.value ? S.freqOn : {}),
                  }}>{g.title}</button>
                ))}
              </div>
            </div>

            <InputWithTag label='Target Weight' value={draft.targetWeight} onChange={e => set('targetWeight', e.target.value)} placeholder={wUnit} tag={wUnit} style={{ marginBottom: 16 }} />
            <InputWithTag label='Target Waist' value={draft.targetWaist} onChange={e => set('targetWaist', e.target.value)} placeholder={waUnit} tag={waUnit} style={{ marginBottom: 16 }} />
            <InputWithTag label='Target Body Fat %' value={draft.targetBodyFat} onChange={e => set('targetBodyFat', e.target.value)} placeholder='%' tag='%' style={{ marginBottom: 16 }} />

            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Target date <span style={{ color: T.t3 }}>(optional)</span></label>
              <input type='date' value={draft.goalDate} onChange={e => set('goalDate', e.target.value)} style={{ ...S.input, width: '100%', fontSize: 14 }} />
            </div>

            {continueBtn(s4Valid)}
          </div>
        );

      /* ======================== SCREEN 5: READY (merged summary + features) ======================== */
      case 5: {
        const summaryName = draft.name || 'Your Protocol';
        return (
          <div>
            <h2 style={titleStyle}>You{'\''}re Ready.</h2>
            <div style={{ height: 8 }} />

            {/* Summary card */}
            <div style={{ ...S.card, padding: 16, borderColor: T.goldM }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: T.t1, fontFamily: T.fb, marginBottom: 12 }}>{summaryName}</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {draft.currentWeight && (
                  <div>
                    <div style={S.label}>Current</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.t1, fontFamily: T.fm }}>{draft.currentWeight} {wUnit}</div>
                  </div>
                )}
                {draft.currentWaist && (
                  <div>
                    <div style={S.label}>Waist</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.t1, fontFamily: T.fm }}>{draft.currentWaist}{waUnit}</div>
                  </div>
                )}
                {draft.targetWeight && (
                  <div>
                    <div style={S.label}>Goal</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.t1, fontFamily: T.fm }}>{draft.targetWeight} {wUnit}</div>
                  </div>
                )}
                {draft.targetWaist && (
                  <div>
                    <div style={S.label}>Goal Waist</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.t1, fontFamily: T.fm }}>{draft.targetWaist}{waUnit}</div>
                  </div>
                )}
              </div>

              <div style={{ fontSize: 12, color: T.gold, fontFamily: T.fm, marginTop: 10 }}>
                {formatGoalLabel(draft.primaryGoal)}
              </div>

              {weightDiff !== null && weightDiff > 0 && (
                <div style={{ fontSize: 12, color: T.t2, fontFamily: T.fm, marginTop: 8 }}>
                  {weightDiff.toFixed(1)} {wUnit} to your goal
                </div>
              )}
              {daysToGoal && (
                <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginTop: 4 }}>
                  {daysToGoal} days remaining
                </div>
              )}
            </div>

            <div style={{ height: 16 }} />

            {/* Next steps callouts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid ' + T.border }}>
                <div style={{ fontSize: 12, color: T.t1, fontFamily: T.fb, fontWeight: 600, marginBottom: 2 }}>{'\u2731'} Add Your Compounds</div>
                <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, lineHeight: 1.5 }}>Go to Profile {'\u2192'} Library to build your stack.</div>
              </div>
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid ' + T.border }}>
                <div style={{ fontSize: 12, color: T.t1, fontFamily: T.fb, fontWeight: 600, marginBottom: 2 }}>{'\u2728'} AI Body Analysis</div>
                <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, lineHeight: 1.5 }}>Upload progress photos in the Body tab for AI-powered composition tracking.</div>
              </div>
            </div>

            <div style={{ height: 16 }} />
            <p style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, textAlign: 'center', lineHeight: 1.6 }}>
              Your data stays on your device. Export a backup anytime in Settings.
            </p>
            <div style={{ height: 24 }} />
            <button onClick={handleFinish} style={{ ...goldBtn, background: T.gold, color: T.bg, fontWeight: 700 }}>Begin</button>
          </div>
        );
      }

      default:
        return null;
    }
  };

  /* ======================================================================
     SHELL
     ====================================================================== */
  return (
    <div style={{
      position: 'fixed', inset: 0, background: T.bg, zIndex: 300,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      overflowY: 'auto',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {renderDots()}
      {renderBack()}

      {/* Screen content - key forces re-mount for fadeUp */}
      <div key={quickStart ? 'qs' + qsScreen : screen} style={{
        maxWidth: 480, width: '100%', padding: '0 20px 40px',
        animation: 'fadeUp .4s ease both',
      }}>
        {quickStart ? renderQsScreen() : renderScreen()}
      </div>

      {/* Notification permission prompt overlay */}
      {showNotifPrompt && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: 360, width: '100%', padding: '0 24px', textAlign: 'center', animation: 'fadeUp .4s ease both' }}>
            {/* Bell icon */}
            <svg width='48' height='48' viewBox='0 0 48 48' fill='none' style={{ marginBottom: 20 }}>
              <path d='M24 4C17.4 4 12 9.4 12 16V26L8 32V34H40V32L36 26V16C36 9.4 30.6 4 24 4Z' stroke={T.gold} strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' fill='none' />
              <path d='M20 34C20 36.2 21.8 38 24 38C26.2 38 28 36.2 28 34' stroke={T.gold} strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' fill='none' />
              <circle cx='24' cy='16' r='2' fill={T.gold} opacity='0.4' />
            </svg>

            <h2 style={{ fontFamily: T.fd, fontSize: 28, fontWeight: 300, color: T.t1, marginBottom: 12 }}>Stay on Protocol</h2>
            <p style={{ fontFamily: T.fb, fontSize: 13, color: T.t2, lineHeight: 1.7, marginBottom: 32 }}>
              Samsara can remind you to log your compounds, warn you when vials expire, and prompt your weekly review.{'\n\n'}No spam. Only what matters.
            </p>

            <button onClick={handleNotifEnable} style={{ ...goldBtn, marginBottom: 10 }}>Enable Notifications</button>
            <button onClick={handleNotifSkip} style={{ fontSize: 12, color: T.t3, fontFamily: T.fm, cursor: 'pointer', textAlign: 'center', background: 'none', border: 'none', width: '100%', padding: 8 }}>Maybe Later</button>
          </div>
        </div>
      )}
    </div>
  );
}
