/* SAMSARA v3.4 - ProfileTab with Stack Editor, Pie Chart, Weekly Load, Library + Research Cards, Cost Calculator, Data Management */
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import T from '../utils/tokens';
import { CAT_C } from '../utils/tokens';
import S from '../utils/styles';
import LIB, { FREQ_META } from '../data/library';
import { makeId, fmtDose, doseMgOf, usableDoses } from '../utils/helpers';
import { exportAllData, importAllData, clearAllData, getStorageSize, getPhotoStorageSize, getStorageHealth } from '../hooks/useStorage';
import { analyzeStack, getCompoundInsights } from '../data/interactions';
import { calculateTrajectory } from '../data/analytics';
import { isSupported, requestPermission } from '../utils/notifications';
import CloudSync from '../components/CloudSync';
// Pro gating removed — all features unlocked
import { AboutDisclaimer } from '../components/Disclaimers';

// Pie chart category colors (explicit hex for SVG)
const PIE_COLORS = {
  'GH Secretagogue': '#00d2b4',
  'Fat Loss': '#c9a84c',
  'Recovery': '#5cb870',
  'Cognitive': '#9678dc',
  'Hormonal': '#ffb432',
  'Anti-Aging': '#dc7878',
  'Hormonal Support': '#ff9650',
  'Growth Hormone': '#64c8ff',
  'Metabolic': '#b48cdc',
  'Skin & Cosmetic': '#ffb4c8',
  'Bioregulators': '#8cdcaa',
};

// 2026 market reference prices per vial (USD)
const MARKET_PRICES = {
  'ipamorelin': { low: 35, high: 65, suggest: 50 },
  'cjc_nodac': { low: 35, high: 65, suggest: 50 },
  'cjc_dac': { low: 40, high: 70, suggest: 55 },
  'tesamorelin': { low: 60, high: 100, suggest: 80 },
  'ghrp2': { low: 35, high: 65, suggest: 50 },
  'ghrp6': { low: 35, high: 65, suggest: 50 },
  'hexarelin': { low: 40, high: 70, suggest: 55 },
  'sermorelin': { low: 30, high: 60, suggest: 45 },
  'igf1_lr3': { low: 80, high: 140, suggest: 110 },
  'aod9604': { low: 40, high: 90, suggest: 65 },
  'retatrutide': { low: 150, high: 300, suggest: 200 },
  'semaglutide': { low: 60, high: 150, suggest: 100 },
  'tirzepatide': { low: 80, high: 160, suggest: 120 },
  'amino1mq': { low: 40, high: 80, suggest: 60 },
  'bpc157': { low: 40, high: 70, suggest: 55 },
  'tb500': { low: 50, high: 80, suggest: 65 },
  'ghkcu': { low: 50, high: 120, suggest: 85 },
  'kpv': { low: 40, high: 60, suggest: 50 },
  'thymosin_a1': { low: 80, high: 150, suggest: 115 },
  'semax': { low: 50, high: 80, suggest: 65 },
  'selank': { low: 50, high: 80, suggest: 65 },
  'dsip': { low: 40, high: 70, suggest: 55 },
  'dihexa': { low: 60, high: 100, suggest: 80 },
  'kisspeptin': { low: 50, high: 80, suggest: 65 },
  'gonadorelin': { low: 50, high: 80, suggest: 65 },
  'pt141': { low: 60, high: 100, suggest: 80 },
  'epithalon': { low: 70, high: 95, suggest: 82 },
  'humanin': { low: 60, high: 90, suggest: 75 },
  'gh_blend': { low: 120, high: 180, suggest: 150 },
  'klow_blend': { low: 150, high: 250, suggest: 200 },
  'test_cyp': { low: 40, high: 80, suggest: 60 },
  'test_enth': { low: 40, high: 80, suggest: 60 },
  'hcg': { low: 30, high: 70, suggest: 50 },
  'enclomiphene': { low: 40, high: 80, suggest: 60 },
  'anastrozole': { low: 20, high: 50, suggest: 35 },
  'hgh': { low: 80, high: 200, suggest: 140 },
  'nad_iv': { low: 60, high: 150, suggest: 100 },
  'nmn': { low: 40, high: 80, suggest: 60 },
  'methylene_blue': { low: 30, high: 60, suggest: 45 },
  'melanotan2': { low: 40, high: 80, suggest: 60 },
  'll37': { low: 60, high: 100, suggest: 80 },
  'thymalin': { low: 60, high: 100, suggest: 80 },
  'pinealon': { low: 60, high: 100, suggest: 80 },
  'cortagen': { low: 60, high: 100, suggest: 80 },
  'motsc': { low: 80, high: 140, suggest: 110 },
  'foxo4dri': { low: 100, high: 200, suggest: 150 },
  'oxytocin': { low: 40, high: 80, suggest: 60 },
  'ara290': { low: 60, high: 120, suggest: 90 },
  'cagrilintide': { low: 80, high: 150, suggest: 115 },
  'triple_threat': { low: 120, high: 200, suggest: 160 },
  'tes_ipa_blend': { low: 80, high: 140, suggest: 110 },
  'wolverine_blend': { low: 70, high: 130, suggest: 100 },
  'bronchogen': { low: 50, high: 90, suggest: 70 },
  'cardiogen': { low: 50, high: 90, suggest: 70 },
  'cartalax': { low: 50, high: 90, suggest: 70 },
  'chonluten': { low: 50, high: 90, suggest: 70 },
  'livagen': { low: 50, high: 90, suggest: 70 },
  'ovagen': { low: 50, high: 90, suggest: 70 },
  'pancragen': { low: 50, high: 90, suggest: 70 },
  'prostamax': { low: 50, high: 90, suggest: 70 },
  'testagen': { low: 50, high: 90, suggest: 70 },
  'thymagen': { low: 50, high: 90, suggest: 70 },
  'vesugen': { low: 50, high: 90, suggest: 70 },
  'vesilute': { low: 50, high: 90, suggest: 70 },
  'vilon': { low: 50, high: 90, suggest: 70 },
};

// Price intelligence
function getPriceStatus(userPrice, libId) {
  const market = MARKET_PRICES[libId];
  if (!market || !userPrice) return null;
  if (userPrice <= market.low) {
    const saving = market.suggest - userPrice;
    return { status: 'great', label: 'Great price', color: '#5cb870', badge: 'Saving $' + fmtCost(saving) + ' vs market' };
  }
  if (userPrice <= market.high) {
    return { status: 'fair', label: 'Fair price', color: T.gold, badge: 'Within market range' };
  }
  const pct = Math.round(((userPrice - market.high) / market.high) * 100);
  if (userPrice <= market.high * 1.3) {
    return { status: 'high', label: 'Above market', color: T.amber, badge: pct + '% above market' };
  }
  return { status: 'overpaying', label: 'Overpaying', color: 'rgba(220,80,80,0.8)', badge: pct + '% above market -- consider sourcing alternatives' };
}

// Currency formatting
function fmtCost(v) {
  if (v == null || !isFinite(v)) return '--';
  if (v < 10) return v.toFixed(2);
  if (v < 1000) return v.toFixed(0);
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// SVG arc path helper
function arcPath(cx, cy, r, startAngle, endAngle) {
  const s = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const start = s(startAngle);
  const end = s(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start[0]} ${start[1]} A ${r} ${r} 0 ${largeArc} 1 ${end[0]} ${end[1]}`;
}

// Donut pie chart - pure SVG
function StackDonut({ groups, total, activeCat, onTapCat }) {
  const cx = 100, cy = 100, r = 72, strokeW = 20;
  let angle = -Math.PI / 2;

  return (
    <svg viewBox='0 0 200 200' style={{ width: '100%', maxWidth: 200, height: 'auto', display: 'block', margin: '0 auto' }}>
      <circle cx={cx} cy={cy} r={r + strokeW / 2 + 4} fill='none' stroke='rgba(201,168,76,0.08)' strokeWidth='1' />
      <circle cx={cx} cy={cy} r={r} fill='none' stroke='rgba(255,255,255,0.03)' strokeWidth={strokeW} />
      {groups.map((g) => {
        const segAngle = (g.count / total) * Math.PI * 2;
        const startAngle = angle;
        const endAngle = angle + segAngle;
        angle = endAngle;
        const isActive = activeCat === g.category;
        const isDimmed = activeCat && !isActive;
        const color = PIE_COLORS[g.category] || T.gold;

        if (groups.length === 1) {
          return (
            <circle key={g.category} cx={cx} cy={cy} r={r}
              fill='none' stroke={color} strokeWidth={strokeW}
              opacity={1} style={{ cursor: 'pointer', transition: 'all .3s' }}
              onClick={() => onTapCat(isActive ? null : g.category)} />
          );
        }

        return (
          <path key={g.category}
            d={arcPath(cx, cy, r, startAngle, endAngle - 0.02)}
            fill='none' stroke={color} strokeWidth={strokeW} strokeLinecap='round'
            opacity={isDimmed ? 0.25 : 1}
            style={{ cursor: 'pointer', transition: 'all .3s', transform: isActive ? 'scale(1.04)' : 'scale(1)', transformOrigin: `${cx}px ${cy}px` }}
            onClick={() => onTapCat(isActive ? null : g.category)} />
        );
      })}
      {activeCat ? (
        <>
          <text x={cx} y={cy - 6} textAnchor='middle' fill={PIE_COLORS[activeCat] || T.gold} fontSize='28' fontWeight='700' fontFamily={T.fm}>
            {groups.find(g => g.category === activeCat)?.count || 0}
          </text>
          <text x={cx} y={cy + 14} textAnchor='middle' fill={T.t3} fontSize='9' fontFamily={T.fm} letterSpacing='1'>
            {Math.round((groups.find(g => g.category === activeCat)?.count || 0) / total * 100)}%
          </text>
        </>
      ) : (
        <>
          <text x={cx} y={cy - 2} textAnchor='middle' fill={T.t1} fontSize='32' fontWeight='700' fontFamily={T.fm}>{total}</text>
          <text x={cx} y={cy + 16} textAnchor='middle' fill={T.t3} fontSize='9' fontFamily={T.fm} letterSpacing='1'>COMPOUNDS</text>
        </>
      )}
    </svg>
  );
}

// Cost donut
function CostDonut({ items, totalMonthly, activeCostId, onTapCost }) {
  const cx = 100, cy = 100, r = 72, strokeW = 20;
  let angle = -Math.PI / 2;

  return (
    <svg viewBox='0 0 200 200' style={{ width: '100%', maxWidth: 200, height: 'auto', display: 'block', margin: '0 auto' }}>
      <circle cx={cx} cy={cy} r={r + strokeW / 2 + 4} fill='none' stroke='rgba(201,168,76,0.08)' strokeWidth='1' />
      <circle cx={cx} cy={cy} r={r} fill='none' stroke='rgba(255,255,255,0.03)' strokeWidth={strokeW} />
      {items.map((item) => {
        const frac = totalMonthly > 0 ? item.monthly / totalMonthly : 0;
        const segAngle = frac * Math.PI * 2;
        if (segAngle < 0.01) { angle += segAngle; return null; }
        const startAngle = angle;
        const endAngle = angle + segAngle;
        angle = endAngle;
        const isActive = activeCostId === item.id;
        const isDimmed = activeCostId && !isActive;
        const color = item.color;

        if (items.length === 1) {
          return (
            <circle key={item.id} cx={cx} cy={cy} r={r}
              fill='none' stroke={color} strokeWidth={strokeW}
              opacity={1} style={{ cursor: 'pointer', transition: 'all .3s' }}
              onClick={() => onTapCost(isActive ? null : item.id)} />
          );
        }

        return (
          <path key={item.id}
            d={arcPath(cx, cy, r, startAngle, endAngle - 0.02)}
            fill='none' stroke={color} strokeWidth={strokeW} strokeLinecap='round'
            opacity={isDimmed ? 0.25 : 1}
            style={{ cursor: 'pointer', transition: 'all .3s', transform: isActive ? 'scale(1.04)' : 'scale(1)', transformOrigin: `${cx}px ${cy}px` }}
            onClick={() => onTapCost(isActive ? null : item.id)} />
        );
      })}
      {activeCostId ? (() => {
        const item = items.find(i => i.id === activeCostId);
        if (!item) return null;
        const ps = getPriceStatus(item.pricePerVial, item.libId);
        return (
          <>
            <text x={cx} y={cy - 12} textAnchor='middle' fill={item.color} fontSize='16' fontWeight='700' fontFamily={T.fm}>
              ${fmtCost(item.monthly)}
            </text>
            <text x={cx} y={cy + 4} textAnchor='middle' fill={T.t3} fontSize='9' fontFamily={T.fm} letterSpacing='0.5'>
              {item.name}
            </text>
            {ps && (
              <text x={cx} y={cy + 18} textAnchor='middle' fill={ps.color} fontSize='7' fontFamily={T.fm}>
                {ps.label}
              </text>
            )}
          </>
        );
      })() : (
        <>
          <text x={cx} y={cy - 6} textAnchor='middle' fill={T.gold} fontSize='22' fontWeight='700' fontFamily={T.fd}>
            ${fmtCost(totalMonthly)}
          </text>
          <text x={cx} y={cy + 14} textAnchor='middle' fill={T.t3} fontSize='9' fontFamily={T.fm} letterSpacing='1'>PER MONTH</text>
        </>
      )}
    </svg>
  );
}

// Legend rows
function PieLegend({ groups, total, activeCat, onTapCat }) {
  return (
    <div style={{ marginTop: 12 }}>
      {groups.map(g => {
        const color = PIE_COLORS[g.category] || T.gold;
        const isActive = activeCat === g.category;
        const isDimmed = activeCat && !isActive;
        const pct = total > 0 ? Math.round(g.count / total * 100) : 0;
        return (
          <div key={g.category} onClick={() => onTapCat(isActive ? null : g.category)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', opacity: isDimmed ? 0.35 : 1, transition: 'opacity .3s' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.t1, fontFamily: T.fb }}>{g.category}</div>
              <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.names.join(', ')}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.t1, fontFamily: T.fm }}>{g.count}</div>
              <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm }}>{pct}%</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Weekly injection load bars
function WeeklyLoadBars({ stack }) {
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayMap = [1, 2, 3, 4, 5, 6, 0];
  const todayDow = new Date().getDay();

  const counts = [0, 0, 0, 0, 0, 0, 0];
  stack.forEach(c => {
    if (c.frequency === 'daily') {
      for (let i = 0; i < 7; i++) counts[i]++;
    } else if (c.frequency === '2x_week') {
      counts[0]++;
      counts[3]++;
    } else if (c.frequency === 'weekly') {
      const timing = (c.timing || '').toLowerCase();
      if (timing.includes('sun')) counts[6]++;
      else if (timing.includes('mon')) counts[0]++;
      else if (timing.includes('tue')) counts[1]++;
      else if (timing.includes('wed')) counts[2]++;
      else if (timing.includes('thu')) counts[3]++;
      else if (timing.includes('fri')) counts[4]++;
      else if (timing.includes('sat')) counts[5]++;
      else counts[6]++;
    }
  });

  const maxCount = Math.max(...counts, 1);

  if (stack.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
        {dayLabels.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ height: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div style={{ fontSize: 12, color: T.t4, fontFamily: T.fm }}>-</div>
            </div>
            <div style={{ fontSize: 8, color: T.t3, fontFamily: T.fm, marginTop: 4, letterSpacing: 0.5 }}>{d}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
      {dayLabels.map((d, i) => {
        const count = counts[i];
        const barH = maxCount > 0 ? Math.max((count / maxCount) * 50, count > 0 ? 6 : 2) : 2;
        const isToday = dayMap[i] === todayDow;
        return (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ height: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div style={{
                width: '100%', maxWidth: 28, height: barH, borderRadius: 4,
                background: count > 0 ? `linear-gradient(180deg, ${T.gold}, rgba(201,168,76,0.4))` : 'rgba(255,255,255,0.04)',
                border: isToday ? `1.5px solid ${T.gold}` : '1.5px solid transparent',
                transition: 'height .4s ease',
              }} />
            </div>
            <div style={{ fontSize: 10, color: count > 0 ? T.t2 : T.t4, fontFamily: T.fm, marginTop: 4, fontWeight: isToday ? 700 : 400 }}>{count}</div>
            <div style={{ fontSize: 8, color: isToday ? T.gold : T.t3, fontFamily: T.fm, marginTop: 2, letterSpacing: 0.5, fontWeight: isToday ? 600 : 400 }}>{d}</div>
          </div>
        );
      })}
    </div>
  );
}

// --- Cost calculation helpers ---
function calcCompoundCosts(c) {
  const pricePerVial = c.pricePerVial || 0;
  const doses = usableDoses(c);
  const freq = FREQ_META[c.frequency] || { perWeek: 1 };
  const perWeek = freq.perWeek;

  const costPerDose = doses > 0 ? pricePerVial / doses : 0;
  const costPerDay = costPerDose * (perWeek / 7);
  const costPerWeek = costPerDose * perWeek;
  const costPerMonth = costPerDay * 30.44;
  const costPerYear = costPerDay * 365.25;
  const vialsPerMonth = doses > 0 ? (perWeek * 4.33) / doses : 0;

  return { costPerDose, costPerDay, costPerWeek, costPerMonth, costPerYear, vialsPerMonth, doses, perWeek };
}

export default function ProfileTab({ stack, setStack, profile, setProfile, logs: rawLogs, checkins: rawCheckins, settings, setSettings, onUpgrade, focusCompoundId, clearFocusCompound }) {
  const logs = rawLogs || [];
  const checkins = rawCheckins || [];

  const [sv, setSv] = useState('stack');
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('All');
  const [addModal, setAddModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [modalData, setModalData] = useState({});
  const [importStatus, setImportStatus] = useState(null);
  const [activePieCat, setActivePieCat] = useState(null);
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [priceInput, setPriceInput] = useState('');
  const [activeCostId, setActiveCostId] = useState(null);
  const [priceImportModal, setPriceImportModal] = useState(false);
  const [importTab, setImportTab] = useState('text');
  const [importText, setImportText] = useState('');
  const [importResults, setImportResults] = useState(null);
  const [manualPrices, setManualPrices] = useState({});
  const [expandedLibId, setExpandedLibId] = useState(null);
  const [libZoom, setLibZoom] = useState(0); // -2 to +4, each step = 1px
  const [notifPerm, setNotifPerm] = useState(() => isSupported() ? Notification.permission : 'unsupported');
  const fileInputRef = useRef(null);
  const libCardRefs = useRef({});

  // When a compound is focused from search, switch to library view & expand it
  useEffect(() => {
    if (!focusCompoundId) return;
    setSv('library');
    setCat('All');
    setSearch('');
    setExpandedLibId(focusCompoundId);
    // Scroll to card after a short delay to let the view render
    const timer = setTimeout(() => {
      const el = libCardRefs.current[focusCompoundId];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    if (clearFocusCompound) clearFocusCompound();
    return () => clearTimeout(timer);
  }, [focusCompoundId]);

  const stackAnalysis = useMemo(() => {
    if (stack.length === 0) return null;
    return analyzeStack(stack, LIB);
  }, [stack]);

  const updateProfile = (key, value) => {
    setProfile(p => ({ ...p, [key]: value }));
  };

  const daysSinceStart = useMemo(() => {
    if (!profile?.startDate) return 0;
    const start = new Date(profile.startDate + 'T00:00:00');
    const now = new Date();
    return Math.floor((now - start) / (1000 * 60 * 60 * 24));
  }, [profile?.startDate]);

  const cats = useMemo(() => ['All', ...[...new Set(LIB.map(p => p.category))]], []);
  const filtered = useMemo(() => LIB.filter(p => { const mc = cat === 'All' || p.category === cat; const ms = !search || p.name.toLowerCase().includes(search.toLowerCase()); return mc && ms; }), [search, cat]);
  const inStack = useMemo(() => new Set(stack.map(s => s.libId)), [stack]);

  const pieData = useMemo(() => {
    const catMap = {};
    stack.forEach(c => {
      const libEntry = LIB.find(l => l.id === c.libId);
      const category = libEntry?.category || 'Other';
      if (!catMap[category]) catMap[category] = { category, count: 0, names: [] };
      catMap[category].count++;
      catMap[category].names.push(c.name);
    });
    return Object.values(catMap).sort((a, b) => b.count - a.count);
  }, [stack]);

  // --- Cost data ---
  const costData = useMemo(() => {
    const items = stack.map(c => {
      const libEntry = LIB.find(l => l.id === c.libId);
      const catColor = PIE_COLORS[libEntry?.category] || T.gold;
      const costs = calcCompoundCosts(c);
      return { id: c.id, libId: c.libId, name: c.name, color: catColor, category: libEntry?.category || 'Other', pricePerVial: c.pricePerVial || 0, ...costs };
    });
    const totalMonthly = items.reduce((sum, i) => sum + i.costPerMonth, 0);
    const totalWeekly = items.reduce((sum, i) => sum + i.costPerWeek, 0);
    const totalYearly = items.reduce((sum, i) => sum + i.costPerYear, 0);
    const totalDaily = items.reduce((sum, i) => sum + i.costPerDay, 0);
    const pricedCount = items.filter(i => i.pricePerVial > 0).length;
    return { items, totalMonthly, totalWeekly, totalYearly, totalDaily, pricedCount };
  }, [stack]);

  // Monthly savings vs market
  const savingsData = useMemo(() => {
    let totalMonthlySaving = 0;
    costData.items.forEach(item => {
      if (item.pricePerVial <= 0) return;
      const market = MARKET_PRICES[item.libId];
      if (!market) return;
      const doses = item.doses;
      if (doses <= 0) return;
      const marketCostPerDose = market.suggest / doses;
      const userCostPerDose = item.pricePerVial / doses;
      const dosesPerDay = item.perWeek / 7;
      const marketMonthly = marketCostPerDose * dosesPerDay * 30.44;
      const userMonthly = userCostPerDose * dosesPerDay * 30.44;
      totalMonthlySaving += marketMonthly - userMonthly;
    });
    return { totalMonthlySaving };
  }, [costData]);

  // Total spent since protocol start
  const totalSpent = useMemo(() => {
    let spent = 0;
    const startDate = profile?.startDate || '';
    costData.items.forEach(item => {
      if (item.pricePerVial <= 0 || item.doses <= 0) return;
      const costPerDose = item.pricePerVial / item.doses;
      const count = logs.filter(l => (l.cid === item.libId || l.compoundId === item.libId) && (!startDate || l.date >= startDate)).length;
      spent += count * costPerDose;
    });
    return spent;
  }, [costData, logs, profile?.startDate]);

  const totalDosesTracked = useMemo(() => {
    const startDate = profile?.startDate || '';
    return logs.filter(l => !startDate || l.date >= startDate).length;
  }, [logs, profile?.startDate]);

  // ROI metrics
  const roiMetrics = useMemo(() => {
    if (checkins.length < 2 || totalSpent <= 0) return null;
    const sorted = [...checkins].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const weightLost = (first.weight && last.weight) ? first.weight - last.weight : 0;
    const waistReduced = (first.waist && last.waist) ? first.waist - last.waist : 0;
    const scoreGain = (last.analysis?.rateScore != null && first.analysis?.rateScore != null) ? last.analysis.rateScore - first.analysis.rateScore : 0;

    const costPerLb = weightLost > 0 ? totalSpent / weightLost : null;
    const costPerInch = waistReduced > 0 ? totalSpent / waistReduced : null;
    const costPerPoint = scoreGain > 0 ? totalSpent / scoreGain : null;
    const daysFunded = costData.totalDaily > 0 ? Math.floor(totalSpent / costData.totalDaily) : null;

    return { weightLost, waistReduced, scoreGain, costPerLb, costPerInch, costPerPoint, daysFunded };
  }, [checkins, totalSpent, costData.totalDaily]);

  // Projections
  const projections = useMemo(() => {
    const ninetyDay = costData.totalDaily * 90;
    const oneYear = costData.totalYearly;
    let costToWeightGoal = null;
    let costToWaistGoal = null;

    if (checkins.length >= 5) {
      const tw = profile?.targetWeight || 170;
      const twa = profile?.targetWaist || 26;
      const traj = calculateTrajectory(checkins, tw, twa);
      if (traj) {
        if (traj.daysToTargetWeight != null && traj.daysToTargetWeight > 0) {
          costToWeightGoal = costData.totalDaily * traj.daysToTargetWeight;
        }
        if (traj.daysToTargetWaist != null && traj.daysToTargetWaist > 0) {
          costToWaistGoal = costData.totalDaily * traj.daysToTargetWaist;
        }
      }
    }
    return { ninetyDay, oneYear, costToWeightGoal, costToWaistGoal };
  }, [costData.totalDaily, costData.totalYearly, checkins, profile?.targetWeight, profile?.targetWaist]);

  const openAdd = (p) => { setModalData({ libId: p.id, name: p.name, vialMg: String(p.defaultVialMg), waterMl: String(p.defaultWaterMl || 2), dose: String(p.defaultDose), unit: p.defaultUnit, frequency: p.frequency === 'intermittent' || p.frequency === 'as_needed' ? 'daily' : p.frequency, timing: p.timing, timingGroup: 'morning', notes: '' }); setAddModal(p); };
  const confirmAdd = () => { const nd = { id: makeId(), libId: modalData.libId, name: modalData.name, vialMg: parseFloat(modalData.vialMg) || 5, waterMl: parseFloat(modalData.waterMl) || 2, dose: parseFloat(modalData.dose) || 100, unit: modalData.unit, frequency: modalData.frequency, timing: modalData.timing, timingGroup: modalData.timingGroup || 'morning' }; setStack(p => [...p, nd]); setAddModal(null); };
  const removeFromStack = (id) => { setStack(p => p.filter(s => s.id !== id)); };
  const openEdit = (c) => { setModalData({ ...c, vialMg: String(c.vialMg), waterMl: String(c.waterMl), dose: String(c.dose) }); setEditModal(c); };
  const confirmEdit = () => { setStack(p => p.map(s => s.id === editModal.id ? { ...s, vialMg: parseFloat(modalData.vialMg) || s.vialMg, waterMl: parseFloat(modalData.waterMl) || s.waterMl, dose: parseFloat(modalData.dose) || s.dose, unit: modalData.unit || s.unit, frequency: modalData.frequency || s.frequency, timing: modalData.timing || s.timing, timingGroup: modalData.timingGroup || s.timingGroup } : s)); setEditModal(null); };

  const savePriceForCompound = (compoundId, price) => {
    setStack(p => p.map(s => s.id === compoundId ? { ...s, pricePerVial: parseFloat(price) || 0 } : s));
    setEditingPriceId(null);
    setPriceInput('');
  };

  const savePriceByLibId = (libId, price) => {
    const val = parseFloat(price) || 0;
    setStack(p => p.map(s => s.libId === libId ? { ...s, pricePerVial: val } : s));
  };

  // Text import parser
  const parseImportText = () => {
    const lines = importText.split('\n').filter(l => l.trim());
    const matched = [];
    const unmatched = [];

    lines.forEach(line => {
      const m = line.match(/(.+?):\s*\$?(\d+\.?\d*)/);
      if (!m) { unmatched.push(line.trim()); return; }
      const name = m[1].trim().toLowerCase();
      const price = parseFloat(m[2]);
      if (!price || price <= 0) { unmatched.push(line.trim()); return; }

      // Find matching stack compound
      const found = stack.find(c => {
        if (c.name.toLowerCase() === name) return true;
        if (c.libId === name) return true;
        if (c.name.toLowerCase().includes(name) || name.includes(c.name.toLowerCase())) return true;
        const lib = LIB.find(l => l.id === c.libId);
        if (lib && lib.name.toLowerCase().includes(name)) return true;
        return false;
      });

      if (found) {
        matched.push({ id: found.id, name: found.name, price });
      } else {
        unmatched.push(line.trim());
      }
    });

    setImportResults({ matched, unmatched });
  };

  const applyImportResults = () => {
    if (!importResults) return;
    setStack(p => {
      const updated = [...p];
      importResults.matched.forEach(m => {
        const idx = updated.findIndex(s => s.id === m.id);
        if (idx >= 0) updated[idx] = { ...updated[idx], pricePerVial: m.price };
      });
      return updated;
    });
    setPriceImportModal(false);
    setImportText('');
    setImportResults(null);
  };

  const saveManualPrices = () => {
    setStack(p => p.map(s => {
      const val = manualPrices[s.id];
      if (val !== undefined && val !== '') {
        return { ...s, pricePerVial: parseFloat(val) || 0 };
      }
      return s;
    }));
    setPriceImportModal(false);
    setManualPrices({});
  };

  // Data export (async - includes IndexedDB photos)
  const [exporting, setExporting] = useState(false);
  const [photoStorageInfo, setPhotoStorageInfo] = useState(null);

  // Load photo storage size on mount
  useState(() => {
    getPhotoStorageSize().then(setPhotoStorageInfo).catch(() => {});
  });

  const handleExport = async (includePhotos = true) => {
    setExporting(true);
    try {
      const data = await exportAllData(includePhotos);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `samsara-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
    } catch (err) {
      setImportStatus('Export failed: ' + (err.message || 'unknown error'));
      setTimeout(() => setImportStatus(null), 5000);
    }
    setExporting(false);
  };

  // Data import (async - handles IndexedDB photos)
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const success = await importAllData(ev.target.result);
      setImportStatus(success ? 'Data imported. Reload the page to apply.' : 'Import failed - invalid file.');
      setTimeout(() => setImportStatus(null), 5000);
    };
    reader.readAsText(file);
  };

  const storageInfo = getStorageSize();
  const storageHealth = getStorageHealth();

  // Full-screen scrollable modal
  const renderModal = (isEdit) => {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)' }} onClick={() => { setAddModal(null); setEditModal(null); }}>
        <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingTop: 'env(safe-area-inset-top, 44px)', paddingLeft: 16, paddingRight: 16, paddingBottom: 'calc(env(safe-area-inset-bottom, 8px) + 80px)', maxWidth: 480, margin: '0 auto' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={() => { setAddModal(null); setEditModal(null); }}
              style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(255,255,255,0.06)', border: 'none', color: T.t2, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {'\u2715'}
            </button>
          </div>

          <h3 style={{ fontFamily: T.fd, fontSize: 24, fontWeight: 300, color: T.t1, marginBottom: 20 }}>{isEdit ? 'Edit' : 'Add'} {modalData.name}</h3>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Vial (mg)</label>
            <input type='number' inputMode='decimal' value={modalData.vialMg || ''} onChange={e => setModalData(p => ({ ...p, vialMg: e.target.value }))} style={{ ...S.input, width: '100%', fontSize: 15 }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>BAC Water (ml)</label>
            <input type='number' inputMode='decimal' value={modalData.waterMl || ''} onChange={e => setModalData(p => ({ ...p, waterMl: e.target.value }))} style={{ ...S.input, width: '100%', fontSize: 15 }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Dose</label>
            <input type='number' inputMode='decimal' value={modalData.dose || ''} onChange={e => setModalData(p => ({ ...p, dose: e.target.value }))} style={{ ...S.input, width: '100%', fontSize: 15 }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Timing</label>
            <input type='text' value={modalData.timing || ''} onChange={e => setModalData(p => ({ ...p, timing: e.target.value }))} style={{ ...S.input, width: '100%', fontSize: 15 }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Unit</label>
            <div style={S.togGrp}>
              {['mcg', 'mg'].map(u => (
                <button key={u} onClick={() => setModalData(p => ({ ...p, unit: u }))} style={{ ...S.togBtn, ...(modalData.unit === u ? S.togOn : {}) }}>{u}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Frequency</label>
            <div style={{ ...S.frow, gap: 6 }}>
              {Object.entries(FREQ_META).filter(([k]) => ['daily', '2x_week', 'weekly'].includes(k)).map(([k, v]) => (
                <button key={k} onClick={() => setModalData(p => ({ ...p, frequency: k }))} style={{ ...S.freqBtn, ...(modalData.frequency === k ? S.freqOn : {}) }}>{v.label}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={S.label}>Timing Group</label>
            <div style={{ ...S.frow, gap: 6 }}>
              {['morning', 'midday', 'evening'].map(g => (
                <button key={g} onClick={() => setModalData(p => ({ ...p, timingGroup: g }))} style={{ ...S.freqBtn, ...(modalData.timingGroup === g ? S.freqOn : {}) }}>{g}</button>
              ))}
            </div>
          </div>

          <button onClick={isEdit ? confirmEdit : confirmAdd} style={{ ...S.logBtn, width: '100%', padding: '14px', textAlign: 'center', fontSize: 14 }}>{isEdit ? 'Save Changes' : 'Add to Stack'}</button>
          <div style={{ height: 40 }} />
        </div>
      </div>
    );
  };

  // Price import modal
  const renderPriceImportModal = () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.92)' }} onClick={() => { setPriceImportModal(false); setImportResults(null); setImportText(''); }}>
      <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingTop: 'env(safe-area-inset-top, 44px)', paddingLeft: 16, paddingRight: 16, paddingBottom: 'calc(env(safe-area-inset-bottom, 8px) + 80px)', maxWidth: 480, margin: '0 auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button onClick={() => { setPriceImportModal(false); setImportResults(null); setImportText(''); }}
            style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(255,255,255,0.06)', border: 'none', color: T.t2, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {'\u2715'}
          </button>
        </div>

        <h3 style={{ fontFamily: T.fd, fontSize: 24, fontWeight: 300, color: T.t1, marginBottom: 8 }}>Import Your Prices</h3>
        <p style={{ fontSize: 12, color: T.t3, fontFamily: T.fm, lineHeight: 1.6, marginBottom: 20 }}>
          Enter what you paid per vial. One compound per line. Format: Compound Name: $price
        </p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid ' + T.border }}>
          {[{ k: 'text', l: 'Text Import' }, { k: 'manual', l: 'Manual Entry' }].map(t => (
            <button key={t.k} onClick={() => { setImportTab(t.k); setImportResults(null); }}
              style={{ flex: 1, padding: '10px 0', fontSize: 11, fontFamily: T.fm, letterSpacing: 0.5, border: 'none', cursor: 'pointer', background: importTab === t.k ? T.goldS : 'transparent', color: importTab === t.k ? T.gold : T.t3, transition: 'all .2s' }}>
              {t.l}
            </button>
          ))}
        </div>

        {importTab === 'text' && (
          <div>
            {!importResults ? (
              <>
                <textarea
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  placeholder=""
                  style={{ width: '100%', height: 200, background: 'rgba(0,0,0,0.4)', border: '1px solid ' + T.border, borderRadius: 9, padding: 14, fontSize: 13, color: T.t1, fontFamily: T.fm, resize: 'none', outline: 'none' }}
                />
                <button onClick={parseImportText} style={{ ...S.logBtn, width: '100%', padding: '14px', textAlign: 'center', fontSize: 13, marginTop: 12 }}>Parse & Import</button>
              </>
            ) : (
              <div>
                {importResults.matched.length > 0 && (
                  <div style={{ background: 'rgba(92,184,112,0.06)', border: '1px solid rgba(92,184,112,0.2)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#5cb870', fontFamily: T.fb, marginBottom: 8 }}>{importResults.matched.length} prices matched</div>
                    {importResults.matched.map((m, i) => (
                      <div key={i} style={{ fontSize: 11, color: T.t2, fontFamily: T.fm, padding: '3px 0' }}>{m.name}: ${m.price}</div>
                    ))}
                  </div>
                )}
                {importResults.unmatched.length > 0 && (
                  <div style={{ background: 'rgba(255,180,50,0.06)', border: '1px solid rgba(255,180,50,0.2)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.amber, fontFamily: T.fb, marginBottom: 8 }}>{importResults.unmatched.length} not matched</div>
                    {importResults.unmatched.map((u, i) => (
                      <div key={i} style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, padding: '3px 0' }}>{u}</div>
                    ))}
                    <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 6 }}>Try Manual Entry tab for these</div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={applyImportResults} style={{ ...S.logBtn, flex: 1, padding: '12px', textAlign: 'center', fontSize: 12 }}>Apply</button>
                  <button onClick={() => setImportResults(null)} style={{ ...S.newVialBtn, flex: 1, padding: '12px', textAlign: 'center', fontSize: 12 }}>Try Again</button>
                </div>
              </div>
            )}
          </div>
        )}

        {importTab === 'manual' && (
          <div>
            {stack.map(c => {
              const market = MARKET_PRICES[c.libId];
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid ' + T.border }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.t1, fontFamily: T.fb }}>{c.name}</div>
                    {market && <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>Market: ${market.low}-${market.high}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 13, color: T.t3 }}>$</span>
                    <input
                      type='number' inputMode='decimal'
                      value={manualPrices[c.id] !== undefined ? manualPrices[c.id] : (c.pricePerVial || '')}
                      onChange={e => setManualPrices(p => ({ ...p, [c.id]: e.target.value }))}
                      placeholder=""
                      style={{ ...S.input, width: 80, fontSize: 13, padding: '6px 8px', background: 'rgba(0,0,0,0.4)', color: T.t1, textAlign: 'right' }}
                    />
                  </div>
                </div>
              );
            })}
            <button onClick={saveManualPrices} style={{ ...S.logBtn, width: '100%', padding: '14px', textAlign: 'center', fontSize: 13, marginTop: 16 }}>Save All</button>
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  );

  return (
    <div style={{ animation: 'fadeUp .5s ease both' }}>
      <header style={{ ...S.header, marginBottom: 14 }}><h1 style={{ ...S.brand, fontSize: 20 }}>PROFILE</h1><p style={S.sub}>Stack & Settings</p></header>
      <div style={S.segWrap}>{[{ k: 'stack', l: 'My Stack' }, { k: 'library', l: 'Library' }, { k: 'cost', l: 'Cost' }, { k: 'settings', l: 'Settings' }].map(s => <button key={s.k} onClick={() => setSv(s.k)} style={{ ...S.segBtn, ...(sv === s.k ? S.segOn : {}) }}>{s.l}</button>)}</div>

      {sv === 'stack' && <div>
        {profile && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: T.goldS, border: '1px solid ' + T.goldM,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, color: T.gold, fontFamily: T.fd, fontWeight: 600,
              }}>
                {profile.name ? profile.name.charAt(0).toUpperCase() : '\u25CB'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: T.t1, fontFamily: T.fb }}>
                  {profile.name || 'Samsara User'}
                </div>
                <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>
                  Day {daysSinceStart} {'\u00B7'} {profile.primaryGoal ? profile.primaryGoal.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Protocol Active'}
                </div>
              </div>
              <button onClick={() => setEditProfileModal(true)} style={{
                background: 'none', border: '1px solid ' + T.border, borderRadius: 8,
                padding: '6px 12px', fontSize: 10, color: T.t3, cursor: 'pointer',
                fontFamily: T.fm, letterSpacing: 0.5,
              }}>Edit</button>
            </div>

            {profile.targetWeight && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>Weight</span>
                  <span style={{ fontSize: 11, color: T.t2, fontFamily: T.fm }}>{profile.currentWeight} {'\u2192'} {profile.targetWeight} {profile.unitSystem === 'metric' ? 'kg' : 'lbs'}</span>
                </div>
                <div style={S.barTrack}>
                  <div style={{ ...S.barFill, width: (() => { const latest = checkins.length ? checkins[checkins.length - 1].weight : profile.currentWeight; const start = profile.currentWeight; const target = profile.targetWeight; if (!start || !target || start === target) return '0%'; return Math.max(0, Math.min(100, Math.round(Math.abs(start - latest) / Math.abs(start - target) * 100))) + '%'; })(), background: 'linear-gradient(90deg, ' + T.gold + ', ' + T.amber + ')' }} />
                </div>
              </div>
            )}
            {profile.targetWaist && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>Waist</span>
                  <span style={{ fontSize: 11, color: T.t2, fontFamily: T.fm }}>{profile.currentWaist} {'\u2192'} {profile.targetWaist} {profile.unitSystem === 'metric' ? 'cm' : 'in'}</span>
                </div>
                <div style={S.barTrack}>
                  <div style={{ ...S.barFill, width: (() => { const latest = checkins.length ? checkins[checkins.length - 1].waist : profile.currentWaist; const start = profile.currentWaist; const target = profile.targetWaist; if (!start || !target || start === target) return '0%'; return Math.max(0, Math.min(100, Math.round(Math.abs(start - latest) / Math.abs(start - target) * 100))) + '%'; })(), background: 'linear-gradient(90deg, rgba(0,210,180,0.8), rgba(0,210,180,0.4))' }} />
                </div>
              </div>
            )}
            {profile.targetBodyFat && (
              <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm }}>Target BF: {profile.targetBodyFat}%</div>
            )}
          </div>
        )}

        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 10 }}>Active {'\u00B7'} {stack.length} Compounds</div>
        {stack.map(c => { const cc = CAT_C[LIB.find(l => l.id === c.libId)?.category] || T.gold;
          return (
            <div key={c.id} style={{ ...S.card, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 4, height: 32, borderRadius: 2, background: cc, opacity: 0.6 }} />
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600, color: T.t1, fontFamily: T.fb }}>{c.name}</div><div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>{fmtDose(c)} {'\u00B7'} {(FREQ_META[c.frequency] || { label: c.frequency }).label} {'\u00B7'} {c.timingGroup || 'morning'}</div></div>
              <button onClick={() => openEdit(c)} style={{ background: 'none', border: 'none', color: T.t3, fontSize: 16, cursor: 'pointer', padding: 4 }}>{'\u270E'}</button>
              <button onClick={() => removeFromStack(c.id)} style={{ background: 'none', border: 'none', color: 'rgba(220,80,80,0.5)', fontSize: 14, cursor: 'pointer', padding: 4 }}>{'\u2715'}</button>
            </div>
          );
        })}

        {/* Protocol Intelligence */}
        {stackAnalysis && stack.length > 0 && (() => {
          const sa = stackAnalysis;
          const toggle = (k) => setExpandedSection(p => p === k ? null : k);
          const scoreColor = sa.score >= 90 ? T.gold : sa.score >= 70 ? T.teal : sa.score >= 50 ? T.amber : T.red;

          return (
            <div style={{ marginTop: 16, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>Protocol Score</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor, fontFamily: T.fm }}>{sa.score}</div>
                <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>/100</div>
              </div>

              {sa.synergies.length > 0 && (
                <div style={{ ...S.card, marginBottom: 8, borderColor: 'rgba(0,210,180,0.2)', overflow: 'hidden' }}>
                  <div onClick={() => toggle('syn')} style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.teal, fontFamily: T.fb }}>{'\u2726'} Stack Synergies ({sa.synergies.length})</span>
                    <span style={{ fontSize: 10, color: T.t3 }}>{expandedSection === 'syn' ? '\u25B2' : '\u25BC'}</span>
                  </div>
                  {expandedSection === 'syn' && sa.synergies.map((s, i) => (
                    <div key={i} style={{ padding: '6px 14px 10px', borderTop: '1px solid ' + T.border }}>
                      <div style={{ fontSize: 11, color: T.gold, fontFamily: T.fm, marginBottom: 2 }}>{s.compounds.join(' + ')}</div>
                      <div style={{ fontSize: 10, color: T.t2, fontFamily: T.fm, lineHeight: 1.4 }}>{s.note}</div>
                    </div>
                  ))}
                </div>
              )}

              {sa.warnings.length > 0 && (
                <div style={{ ...S.card, marginBottom: 8, borderColor: sa.warnings.some(w => w.severity === 'danger') ? 'rgba(220,80,80,0.3)' : 'rgba(255,180,50,0.2)', overflow: 'hidden' }}>
                  <div onClick={() => toggle('warn')} style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.amber, fontFamily: T.fb }}>{'\u26A0'} Protocol Notes ({sa.warnings.length})</span>
                    <span style={{ fontSize: 10, color: T.t3 }}>{expandedSection === 'warn' ? '\u25B2' : '\u25BC'}</span>
                  </div>
                  {expandedSection === 'warn' && [...sa.warnings].sort((a, b) => {
                    const order = { danger: 0, warning: 1, info: 2 };
                    return (order[a.severity] || 2) - (order[b.severity] || 2);
                  }).map((w, i) => {
                    const wColor = w.severity === 'danger' ? T.red : w.severity === 'warning' ? T.amber : T.t2;
                    return (
                      <div key={i} style={{ padding: '6px 14px 10px', borderTop: '1px solid ' + T.border, borderLeft: '3px solid ' + wColor }}>
                        <div style={{ fontSize: 11, color: wColor, fontFamily: T.fm, marginBottom: 2 }}>{w.compounds.join(' + ')} ({w.type})</div>
                        <div style={{ fontSize: 10, color: T.t2, fontFamily: T.fm, lineHeight: 1.4 }}>{w.note}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {sa.timingNotes.length > 0 && (
                <div style={{ ...S.card, marginBottom: 8, borderColor: T.goldM, overflow: 'hidden' }}>
                  <div onClick={() => toggle('time')} style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.gold, fontFamily: T.fb }}>{'\u25CE'} Timing Reminders ({sa.timingNotes.length})</span>
                    <span style={{ fontSize: 10, color: T.t3 }}>{expandedSection === 'time' ? '\u25B2' : '\u25BC'}</span>
                  </div>
                  {expandedSection === 'time' && sa.timingNotes.map((t, i) => (
                    <div key={i} style={{ padding: '6px 14px 10px', borderTop: '1px solid ' + T.border }}>
                      <div style={{ fontSize: 11, color: T.t1, fontFamily: T.fm }}>{t.compound}</div>
                      <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, lineHeight: 1.4 }}>{t.note}</div>
                    </div>
                  ))}
                </div>
              )}

              {sa.cyclingRequired.length > 0 && (
                <div style={{ ...S.card, marginBottom: 8, borderColor: 'rgba(150,120,220,0.2)', overflow: 'hidden' }}>
                  <div onClick={() => toggle('cycle')} style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.purple, fontFamily: T.fb }}>{'\u21BB'} Cycling Required ({sa.cyclingRequired.length})</span>
                    <span style={{ fontSize: 10, color: T.t3 }}>{expandedSection === 'cycle' ? '\u25B2' : '\u25BC'}</span>
                  </div>
                  {expandedSection === 'cycle' && sa.cyclingRequired.map((c, i) => (
                    <div key={i} style={{ padding: '6px 14px 10px', borderTop: '1px solid ' + T.border }}>
                      <div style={{ fontSize: 11, color: T.t1, fontFamily: T.fm }}>{c.compound}</div>
                      <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, lineHeight: 1.4 }}>{c.protocol}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${T.goldM}, transparent)`, margin: '20px 0' }} />

        {stack.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '34px 0' }}>
            <div style={{ fontSize: 28, opacity: 0.12, marginBottom: 8 }}>{'\u25CB'}</div>
            <p style={{ fontFamily: T.fd, fontSize: 18, fontWeight: 300, color: T.t2, letterSpacing: 1 }}>Your stack is empty</p>
            <p style={{ fontSize: 12, color: T.t3, fontFamily: T.fb, lineHeight: 1.6, marginTop: 6 }}>Browse the Library to build your protocol</p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 12 }}>Stack Breakdown</div>
            <StackDonut groups={pieData} total={stack.length} activeCat={activePieCat} onTapCat={setActivePieCat} />
            <PieLegend groups={pieData} total={stack.length} activeCat={activePieCat} onTapCat={setActivePieCat} />
          </div>
        )}

        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${T.goldM}, transparent)`, margin: '20px 0' }} />

        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 12 }}>Weekly Injection Load</div>
        <div style={{ ...S.card, padding: '16px' }}>
          <WeeklyLoadBars stack={stack} />
        </div>
      </div>}

      {/* ========== COST TAB ========== */}
      {sv === 'cost' && <div>
        {stack.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <svg viewBox='0 0 100 100' style={{ width: 48, height: 48, margin: '0 auto 16px', display: 'block' }}>
              <circle cx='50' cy='50' r='40' fill='none' stroke={T.t2} strokeWidth='1.5' strokeDasharray='4 3' opacity='0.3' style={{ animation: 'breathe 4s ease-in-out infinite' }} />
            </svg>
            <p style={{ fontFamily: T.fd, fontSize: 20, fontWeight: 300, color: T.t2, letterSpacing: 1 }}>Your protocol has a cost.</p>
            <p style={{ fontSize: 12, color: T.t3, fontFamily: T.fb, lineHeight: 1.7, marginTop: 8, maxWidth: 280, margin: '8px auto 0' }}>Add compounds to your stack first, then track what you pay per vial.</p>
          </div>
        ) : costData.pricedCount === 0 ? (
          /* No prices entered empty state */
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <svg viewBox='0 0 100 100' style={{ width: 48, height: 48, margin: '0 auto 16px', display: 'block' }}>
              <circle cx='50' cy='50' r='40' fill='none' stroke={T.t2} strokeWidth='1.5' strokeDasharray='4 3' opacity='0.3' style={{ animation: 'breathe 4s ease-in-out infinite' }} />
            </svg>
            <p style={{ fontFamily: T.fd, fontSize: 20, fontWeight: 300, color: T.t2, letterSpacing: 1 }}>Your protocol has a cost.</p>
            <p style={{ fontSize: 12, color: T.t3, fontFamily: T.fb, lineHeight: 1.7, marginTop: 8, maxWidth: 300, margin: '8px auto 0' }}>
              Add what you paid per vial to understand your monthly spend, compare to market rates, and calculate your return on investment.
            </p>
            <button onClick={() => { setPriceImportModal(true); setImportTab('text'); }} style={{ ...S.logBtn, padding: '12px 28px', fontSize: 13, marginTop: 20 }}>Import Prices</button>
            <div style={{ marginTop: 8 }}>
              <button onClick={() => { setPriceImportModal(true); setImportTab('manual'); }} style={{ background: 'none', border: 'none', color: T.t3, fontSize: 12, fontFamily: T.fm, cursor: 'pointer', padding: '8px 12px' }}>Enter Manually</button>
            </div>

            <div style={{ marginTop: 28, textAlign: 'left' }}>
              <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 10 }}>Your Compounds</div>
              {stack.map(c => {
                const cc = CAT_C[LIB.find(l => l.id === c.libId)?.category] || T.gold;
                return (
                  <div key={c.id} onClick={() => { setEditingPriceId(c.id); setPriceInput(''); setSv('cost'); }}
                    style={{ ...S.card, padding: '10px 14px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <div style={{ width: 3, height: 20, borderRadius: 2, background: cc, opacity: 0.6 }} />
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: T.t1, fontFamily: T.fb }}>{c.name}</div>
                    <span style={{ fontSize: 11, color: T.gold, fontFamily: T.fm }}>+ Add Price</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            {/* Import button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={() => setPriceImportModal(true)} style={{ background: 'none', border: '1px solid ' + T.border, borderRadius: 8, padding: '6px 14px', fontSize: 10, color: T.t3, cursor: 'pointer', fontFamily: T.fm, letterSpacing: 0.5 }}>Import Prices</button>
            </div>

            {/* Header card */}
            <div style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
              {/* Top row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: T.fd, fontSize: 48, fontWeight: 300, color: T.gold, lineHeight: 1, letterSpacing: -1 }}>
                    ${fmtCost(costData.totalMonthly)}
                  </div>
                  <div style={{ fontSize: 12, color: T.t3, fontFamily: T.fm, marginTop: 4 }}>/month</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: T.fd, fontSize: 28, fontWeight: 300, color: T.t2, lineHeight: 1 }}>
                    ${fmtCost(costData.totalYearly)}
                  </div>
                  <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>/year</div>
                </div>
              </div>

              <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${T.goldM}, transparent)`, margin: '0 0 14px' }} />

              {/* Stats row */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.t1, fontFamily: T.fm }}>${fmtCost(costData.totalDaily)}</div>
                  <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, letterSpacing: 0.5, marginTop: 2 }}>DAILY</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.t1, fontFamily: T.fm }}>${fmtCost(totalSpent)}</div>
                  <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, letterSpacing: 0.5, marginTop: 2 }}>INVESTED</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.t1, fontFamily: T.fm }}>{totalDosesTracked}</div>
                  <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, letterSpacing: 0.5, marginTop: 2 }}>DOSES</div>
                </div>
              </div>

              {costData.pricedCount < stack.length && (
                <div style={{ fontSize: 10, color: T.amber, fontFamily: T.fm, marginTop: 12, textAlign: 'center' }}>
                  {costData.pricedCount}/{stack.length} compounds priced
                </div>
              )}

              {/* Savings banner */}
              {savingsData.totalMonthlySaving > 5 && (
                <div style={{ background: 'rgba(92,184,112,0.08)', border: '1px solid rgba(92,184,112,0.2)', borderRadius: 8, padding: '8px 12px', marginTop: 12, textAlign: 'center' }}>
                  <span style={{ fontSize: 12, color: '#5cb870', fontFamily: T.fm }}>{'\u2726'} Saving ${fmtCost(savingsData.totalMonthlySaving)}/month vs market rates</span>
                </div>
              )}
              {savingsData.totalMonthlySaving < -20 && (
                <div style={{ background: T.warn, border: '1px solid ' + T.warnB, borderRadius: 8, padding: '8px 12px', marginTop: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: T.warnT, fontFamily: T.fm }}>{'\u26A0'} Paying ${fmtCost(Math.abs(savingsData.totalMonthlySaving))}/month above market</div>
                  <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>Tap any compound to see alternatives</div>
                </div>
              )}
            </div>

            {/* Cost donut */}
            {costData.pricedCount >= 2 && (
              <>
                <CostDonut
                  items={costData.items.filter(i => i.pricePerVial > 0)}
                  totalMonthly={costData.totalMonthly}
                  activeCostId={activeCostId}
                  onTapCost={setActiveCostId}
                />
                <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${T.goldM}, transparent)`, margin: '20px 0' }} />
              </>
            )}

            {/* Per compound list */}
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 10 }}>Per Compound</div>
            {stack.map(c => {
              const libEntry = LIB.find(l => l.id === c.libId);
              const cc = CAT_C[libEntry?.category] || T.gold;
              const costs = calcCompoundCosts(c);
              const isEditing = editingPriceId === c.id;
              const ps = getPriceStatus(c.pricePerVial, c.libId);
              const market = MARKET_PRICES[c.libId];
              const hasCost = c.pricePerVial > 0;

              return (
                <div key={c.id} style={{ ...S.card, padding: '14px', marginBottom: 8, opacity: hasCost ? 1 : 0.6 }}>
                  {/* Row 1: name + status badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 4, height: 32, borderRadius: 2, background: cc, opacity: 0.6 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.t1, fontFamily: T.fb }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>
                        {fmtDose(c)} {'\u00B7'} {(FREQ_META[c.frequency] || { label: c.frequency }).label} {'\u00B7'} {costs.doses} doses/vial
                      </div>
                    </div>
                    {ps && (
                      <div style={{ padding: '3px 8px', borderRadius: 10, background: ps.color + '18', border: '1px solid ' + ps.color + '40', flexShrink: 0 }}>
                        <span style={{ fontSize: 9, color: ps.color, fontFamily: T.fm, fontWeight: 600 }}>{ps.label}</span>
                      </div>
                    )}
                  </div>

                  {/* Row 2: price input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, borderTop: '1px solid ' + T.border }}>
                    <span style={{ fontSize: 14, color: T.t3 }}>$</span>
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                        <input
                          type='number' inputMode='decimal' autoFocus
                          value={priceInput}
                          onChange={e => setPriceInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') savePriceForCompound(c.id, priceInput); }}
                          placeholder=""
                          style={{ ...S.input, flex: 1, fontSize: 13, padding: '6px 8px', background: 'rgba(0,0,0,0.4)', color: T.t1 }}
                        />
                        <button onClick={() => savePriceForCompound(c.id, priceInput)}
                          style={{ background: T.goldS, border: '1px solid ' + T.goldM, borderRadius: 6, padding: '4px 10px', fontSize: 10, color: T.gold, cursor: 'pointer', fontFamily: T.fm }}>
                          Save
                        </button>
                        <button onClick={() => { setEditingPriceId(null); setPriceInput(''); }}
                          style={{ background: 'none', border: 'none', color: T.t3, fontSize: 12, cursor: 'pointer', padding: 4 }}>
                          {'\u2715'}
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditingPriceId(c.id); setPriceInput(c.pricePerVial ? String(c.pricePerVial) : ''); }}
                          style={{ background: 'none', border: '1px dashed ' + (hasCost ? T.border : T.goldM), borderRadius: 6, padding: '4px 10px', fontSize: 12, color: hasCost ? T.t2 : T.gold, cursor: 'pointer', fontFamily: T.fm, minWidth: 80, textAlign: 'left' }}>
                          {hasCost ? `$${c.pricePerVial}` : 'Tap to add price'}
                        </button>
                        <span style={{ fontSize: 11, color: T.t3, fontFamily: T.fm }}>/vial</span>
                        {market && !isEditing && (
                          <span style={{ fontSize: 10, color: T.t4, fontFamily: T.fm, marginLeft: 'auto' }}>Market: ${market.low}-${market.high}</span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Row 3: cost breakdown */}
                  {hasCost && costs.costPerDose > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                      <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>${costs.costPerDose.toFixed(2)}/dose</span>
                      <span style={{ fontSize: 12, color: T.t2, fontFamily: T.fm, fontWeight: 600 }}>${fmtCost(costs.costPerMonth)}/mo</span>
                      {costData.totalMonthly > 0 && (
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 60, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                            <div style={{ width: Math.max(2, Math.round(costs.costPerMonth / costData.totalMonthly * 100)) + '%', height: '100%', borderRadius: 2, background: cc, opacity: 0.5 }} />
                          </div>
                          <span style={{ fontSize: 9, color: T.t3, fontFamily: T.fm }}>{Math.round(costs.costPerMonth / costData.totalMonthly * 100)}%</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Row 4: savings indicator */}
                  {hasCost && ps && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 10, color: ps.color, fontFamily: T.fm }}>
                        {ps.status === 'great' ? 'Saving $' + fmtCost((market.suggest - c.pricePerVial) / (costs.doses || 1) * costs.perWeek * 4.33) + '/mo vs market avg' :
                         ps.status === 'fair' ? 'Within market range' :
                         ps.status === 'high' ? ps.badge :
                         'Consider finding better source'}
                      </span>
                    </div>
                  )}

                  {/* Tap hint for unpriced */}
                  {!hasCost && !isEditing && (
                    <div style={{ marginTop: 6, fontSize: 11, color: T.t3, fontFamily: T.fm, fontStyle: 'italic' }}>Tap to add price</div>
                  )}
                </div>
              );
            })}

            <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${T.goldM}, transparent)`, margin: '20px 0' }} />

            {/* ROI Section */}
            {roiMetrics && totalSpent > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 4 }}>Protocol ROI</div>
                <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginBottom: 12 }}>What your investment delivered</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {roiMetrics.costPerLb !== null && (
                    <div style={{ ...S.card, padding: 14, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: T.teal, fontFamily: T.fm }}>${fmtCost(roiMetrics.costPerLb)}</div>
                      <div style={{ fontSize: 10, color: T.t2, fontFamily: T.fm, marginTop: 4 }}>per lb lost</div>
                      <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>{roiMetrics.weightLost.toFixed(1)} lbs total</div>
                    </div>
                  )}
                  {roiMetrics.costPerInch !== null && (
                    <div style={{ ...S.card, padding: 14, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: T.gold, fontFamily: T.fm }}>${fmtCost(roiMetrics.costPerInch)}</div>
                      <div style={{ fontSize: 10, color: T.t2, fontFamily: T.fm, marginTop: 4 }}>per inch</div>
                      <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>{roiMetrics.waistReduced.toFixed(2)}" total</div>
                    </div>
                  )}
                  {roiMetrics.costPerPoint !== null && (
                    <div style={{ ...S.card, padding: 14, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: T.purple, fontFamily: T.fm }}>${fmtCost(roiMetrics.costPerPoint)}</div>
                      <div style={{ fontSize: 10, color: T.t2, fontFamily: T.fm, marginTop: 4 }}>per score point</div>
                      <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>Rate score +{roiMetrics.scoreGain.toFixed(1)}</div>
                    </div>
                  )}
                  {roiMetrics.daysFunded !== null && (
                    <div style={{ ...S.card, padding: 14, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: T.amber, fontFamily: T.fm }}>{roiMetrics.daysFunded}</div>
                      <div style={{ fontSize: 10, color: T.t2, fontFamily: T.fm, marginTop: 4 }}>days funded</div>
                      <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>at current burn rate</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Projections */}
            {costData.totalDaily > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 10 }}>At Current Rate</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ ...S.card, padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: T.t1, fontFamily: T.fm }}>${fmtCost(projections.ninetyDay)}</div>
                    <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 4 }}>90 day cost</div>
                  </div>
                  <div style={{ ...S.card, padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: T.t1, fontFamily: T.fm }}>${fmtCost(projections.oneYear)}</div>
                    <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 4 }}>1 year cost</div>
                  </div>
                </div>

                {(projections.costToWeightGoal !== null || projections.costToWaistGoal !== null) && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 8, marginTop: 12 }}>Cost to Reach Goal</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {projections.costToWeightGoal !== null && (
                        <div style={{ ...S.card, padding: 14, textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: T.gold, fontFamily: T.fm }}>${fmtCost(projections.costToWeightGoal)}</div>
                          <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 4 }}>to weight goal</div>
                        </div>
                      )}
                      {projections.costToWaistGoal !== null && (
                        <div style={{ ...S.card, padding: 14, textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: T.teal, fontFamily: T.fm }}>${fmtCost(projections.costToWaistGoal)}</div>
                          <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 4 }}>to waist goal</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>}

      {sv === 'library' && <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <input type='text' value={search} onChange={e => setSearch(e.target.value)} placeholder="" style={{ ...S.input, flex: 1, fontSize: 14, padding: '11px 14px', background: 'rgba(0,0,0,0.3)', color: T.t1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <button onClick={() => setLibZoom(z => Math.max(z - 1, -2))} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid ' + T.border, borderRadius: 8, width: 32, height: 36, fontSize: 14, color: libZoom <= -2 ? T.border : T.t2, cursor: libZoom <= -2 ? 'default' : 'pointer', fontFamily: T.fm, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>A-</button>
            <button onClick={() => setLibZoom(z => Math.min(z + 1, 4))} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid ' + T.border, borderRadius: 8, width: 32, height: 36, fontSize: 14, color: libZoom >= 4 ? T.border : T.t2, cursor: libZoom >= 4 ? 'default' : 'pointer', fontFamily: T.fm, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>A+</button>
          </div>
        </div>
        <div style={{ ...S.pills, marginBottom: 14, justifyContent: 'flex-start', overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4 }}>{cats.map(c => <button key={c} onClick={() => setCat(c)} style={{ ...S.pill, whiteSpace: 'nowrap', fontSize: 12 + libZoom, ...(cat === c ? S.pillOn : {}) }}>{c}</button>)}</div>
        {filtered.map(p => { const cc = CAT_C[p.category] || T.gold; const added = inStack.has(p.id); const z = libZoom;
          const insights = stack.length > 0 ? getCompoundInsights(p.id, stack, LIB) : [];
          const hasSynergy = insights.some(r => r.type === 'synergy');
          const hasCaution = insights.some(r => r.type === 'caution' || r.type === 'conflict');
          const dotColor = hasCaution ? T.amber : hasSynergy ? T.green : null;
          const isExpanded = expandedLibId === p.id;
          const timelineKeys = p.timeline ? Object.keys(p.timeline) : [];
          return (
            <div key={p.id} ref={el => { if (el) libCardRefs.current[p.id] = el; }} style={{ marginBottom: 6 }}>
              <div onClick={() => setExpandedLibId(isExpanded ? null : p.id)} style={{ ...S.card, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderBottomLeftRadius: isExpanded ? 0 : undefined, borderBottomRightRadius: isExpanded ? 0 : undefined }}>
                <div style={{ width: 3, height: 24, borderRadius: 2, background: cc, opacity: 0.6 }} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 15 + z, fontWeight: 600, color: T.t1, fontFamily: T.fb }}>{p.name}</span>{dotColor && <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />}</div><div style={{ fontSize: 12 + z, color: T.t3, fontFamily: T.fm, marginTop: 2 }}>{p.defaultDose} {p.defaultUnit} {'\u00B7'} {p.category}</div></div>
                <span style={{ fontSize: 14, color: T.t3, transition: 'transform .3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>{'\u25BE'}</span>
              </div>
              <div style={{ maxHeight: isExpanded ? 3000 : 0, overflow: 'hidden', transition: 'max-height .4s ease' }}>
                <div style={{ ...S.card, borderTop: `1px solid ${T.border}`, borderTopLeftRadius: 0, borderTopRightRadius: 0, padding: '14px 12px' }}>
                  {/* Evidence rating */}
                  {p.evidence != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
                      <span style={{ fontSize: 11 + z, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>Evidence</span>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {[1,2,3,4,5].map(i => <div key={i} style={{ width: 8 + z * 0.5, height: 8 + z * 0.5, borderRadius: '50%', background: i <= p.evidence ? T.gold : 'rgba(255,255,255,0.08)' }} />)}
                      </div>
                    </div>
                  )}
                  {/* Half-life & peak chips */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 13 }}>
                    {p.halfLifeHours != null && <span style={{ fontSize: 12 + z, fontFamily: T.fm, color: T.teal, background: 'rgba(0,210,180,0.08)', padding: '4px 10px', borderRadius: 8 }}>t½ {p.halfLifeHours >= 24 ? (p.halfLifeHours / 24).toFixed(0) + 'd' : p.halfLifeHours + 'h'}</span>}
                    {p.peakPlasmaMinutes != null && <span style={{ fontSize: 12 + z, fontFamily: T.fm, color: T.purple, background: 'rgba(150,120,220,0.08)', padding: '4px 10px', borderRadius: 8 }}>peak {p.peakPlasmaMinutes >= 60 ? (p.peakPlasmaMinutes / 60).toFixed(1) + 'h' : p.peakPlasmaMinutes + 'min'}</span>}
                    {p.administration && <span style={{ fontSize: 12 + z, fontFamily: T.fm, color: T.t2, background: 'rgba(255,255,255,0.04)', padding: '4px 10px', borderRadius: 8 }}>{p.administration}</span>}
                  </div>
                  {/* Mechanism */}
                  {p.mechanism && (
                    <div style={{ marginBottom: 13 }}>
                      <div style={{ fontSize: 11 + z, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 4 }}>Mechanism</div>
                      <div style={{ fontSize: 13 + z, color: T.t2, fontFamily: T.fb, lineHeight: 1.6 }}>{p.mechanism}</div>
                    </div>
                  )}
                  {/* Timeline - horizontal scroll */}
                  {timelineKeys.length > 0 && (
                    <div style={{ marginBottom: 13 }}>
                      <div style={{ fontSize: 11 + z, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 6 }}>Timeline</div>
                      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
                        {timelineKeys.map(k => (
                          <div key={k} style={{ minWidth: 150 + z * 5, maxWidth: 200 + z * 5, flexShrink: 0, background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '10px 12px', border: `1px solid ${T.border}` }}>
                            <div style={{ fontSize: 12 + z, fontWeight: 700, color: T.gold, fontFamily: T.fm, marginBottom: 4, textTransform: 'capitalize' }}>{k.replace('week', 'Week ')}</div>
                            <div style={{ fontSize: 12 + z, color: T.t2, fontFamily: T.fb, lineHeight: 1.5 }}>{p.timeline[k]}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Side effects - amber pills */}
                  {p.sideEffects && p.sideEffects.length > 0 && (
                    <div style={{ marginBottom: 13 }}>
                      <div style={{ fontSize: 11 + z, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 6 }}>Side Effects</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {p.sideEffects.map((se, i) => <span key={i} style={{ fontSize: 12 + z, fontFamily: T.fm, color: T.warnT, background: T.warn, padding: '4px 10px', borderRadius: 8 }}>{se}</span>)}
                      </div>
                    </div>
                  )}
                  {/* Contraindications - red pills */}
                  {p.contraindications && p.contraindications.length > 0 && (
                    <div style={{ marginBottom: 13 }}>
                      <div style={{ fontSize: 11 + z, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 6 }}>Contraindications</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {p.contraindications.map((ci, i) => <span key={i} style={{ fontSize: 12 + z, fontFamily: T.fm, color: 'rgba(220,80,80,0.85)', background: 'rgba(220,80,80,0.08)', padding: '4px 10px', borderRadius: 8 }}>{ci}</span>)}
                      </div>
                    </div>
                  )}
                  {/* Cycling protocol - purple card */}
                  {p.cyclingProtocol && (
                    <div style={{ marginBottom: 13, background: 'rgba(150,120,220,0.06)', borderRadius: 8, padding: '12px 14px', border: '1px solid rgba(150,120,220,0.12)' }}>
                      <div style={{ fontSize: 11 + z, letterSpacing: 2, textTransform: 'uppercase', color: T.purple, fontFamily: T.fm, marginBottom: 4 }}>Cycling Protocol</div>
                      <div style={{ fontSize: 13 + z, color: T.t2, fontFamily: T.fb, lineHeight: 1.6 }}>{p.cyclingProtocol}</div>
                    </div>
                  )}
                  {/* Synergies - teal card */}
                  {p.synergiesNotes && (
                    <div style={{ marginBottom: 13, background: 'rgba(0,210,180,0.06)', borderRadius: 8, padding: '12px 14px', border: '1px solid rgba(0,210,180,0.12)' }}>
                      <div style={{ fontSize: 11 + z, letterSpacing: 2, textTransform: 'uppercase', color: T.teal, fontFamily: T.fm, marginBottom: 4 }}>Synergies</div>
                      <div style={{ fontSize: 13 + z, color: T.t2, fontFamily: T.fb, lineHeight: 1.6 }}>{p.synergiesNotes}</div>
                    </div>
                  )}
                  {/* Research notes */}
                  {p.researchNotes && (
                    <div style={{ marginBottom: 13 }}>
                      <div style={{ fontSize: 11 + z, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 4 }}>Research Notes</div>
                      <div style={{ fontSize: 13 + z, color: T.t2, fontFamily: T.fb, lineHeight: 1.6 }}>{p.researchNotes}</div>
                    </div>
                  )}
                  {/* Add/Remove button */}
                  <div style={{ marginTop: 4 }}>
                    {added ? <button onClick={(e) => { e.stopPropagation(); const idx = stack.findIndex(s => s.compoundId === p.id); if (idx >= 0 && window.confirm('Remove ' + p.name + ' from stack?')) { const ns = [...stack]; ns.splice(idx, 1); setStack(ns); } }} style={{ ...S.pill, fontSize: 13 + z, padding: '10px 14px', color: 'rgba(220,80,80,0.7)', borderColor: 'rgba(220,80,80,0.2)', width: '100%', textAlign: 'center' }}>Remove from Stack</button>
                      : <button onClick={(e) => { e.stopPropagation(); openAdd(p); }} style={{ ...S.pill, fontSize: 13 + z, padding: '10px 14px', borderColor: cc, color: cc, width: '100%', textAlign: 'center' }}>+ Add to Stack</button>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>}

      {sv === 'settings' && <div>
        {/* Notifications */}
        <div style={{ ...S.card, padding: '14px', marginBottom: 12 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 10 }}>Notifications</div>
          {notifPerm === 'unsupported' && (
            <div style={{ background: T.warn, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: T.warnT, fontFamily: T.fm, lineHeight: 1.5 }}>Push notifications not supported in this browser. Add Samsara to your home screen in Safari to enable.</div>
            </div>
          )}
          {notifPerm === 'denied' && (
            <div style={{ background: 'rgba(220,80,80,0.08)', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(220,80,80,0.15)' }}>
              <div style={{ fontSize: 11, color: 'rgba(220,80,80,0.85)', fontFamily: T.fm, lineHeight: 1.5 }}>Notifications blocked. Enable in Settings {'\u2192'} Safari {'\u2192'} Samsara {'\u2192'} Notifications</div>
            </div>
          )}
          {notifPerm === 'default' && (
            <button onClick={async () => { const r = await requestPermission(); setNotifPerm(r); if (r === 'granted') { setSettings(p => ({ ...p, notificationsEnabled: true })); } }} style={{ ...S.logBtn, width: '100%', padding: '12px', textAlign: 'center', fontSize: 12 }}>Enable Notifications</button>
          )}
          {notifPerm === 'granted' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#5cb870' }} />
                <span style={{ fontSize: 11, color: '#5cb870', fontFamily: T.fm }}>Notifications enabled</span>
              </div>
              {/* Toggle rows */}
              {[
                { key: 'dailyReminderEnabled', label: 'Daily Protocol Reminder', desc: 'Remind to log compounds' },
                { key: 'weeklyDoseEnabled', label: 'Weekly Dose Reminders', desc: 'Notify before weekly injections' },
                { key: 'vialExpiryEnabled', label: 'Vial Expiry Warnings', desc: 'Alert 3 days before vial expires' },
                { key: 'streakEnabled', label: 'Streak Protection', desc: 'Alert at 8pm if not fully logged' },
                { key: 'sundaySummaryEnabled', label: 'Sunday Review Prompt', desc: 'Weekly summary reminder Sundays 9am' },
              ].map(tog => {
                const on = settings?.[tog.key] !== false;
                return (
                  <div key={tog.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid ' + T.border }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: T.t1, fontFamily: T.fm, fontWeight: 500 }}>{tog.label}</div>
                      <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginTop: 1 }}>{tog.desc}</div>
                    </div>
                    <button onClick={() => setSettings(p => ({ ...p, [tog.key]: !on }))} style={{ width: 48, height: 26, borderRadius: 13, background: on ? T.goldS : 'rgba(255,255,255,0.06)', border: on ? '1px solid ' + T.goldM : '1px solid ' + T.border, cursor: 'pointer', position: 'relative', flexShrink: 0, padding: 0, transition: 'all .2s ease' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: on ? T.gold : T.t3, position: 'absolute', top: 2, left: 0, transform: on ? 'translateX(24px)' : 'translateX(2px)', transition: 'all .2s ease' }} />
                    </button>
                  </div>
                );
              })}
              {/* Daily reminder time picker */}
              {settings?.dailyReminderEnabled !== false && (
                <div style={{ padding: '10px 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: T.t2, fontFamily: T.fm }}>Remind at:</span>
                  <input type='number' min='0' max='23' value={settings?.dailyReminderHour ?? 8} onChange={e => setSettings(p => ({ ...p, dailyReminderHour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) }))} style={{ ...S.input, width: 44, textAlign: 'center', fontSize: 12, padding: '6px 4px' }} />
                  <span style={{ fontSize: 11, color: T.t3 }}>:</span>
                  <select value={settings?.dailyReminderMinute ?? 0} onChange={e => setSettings(p => ({ ...p, dailyReminderMinute: parseInt(e.target.value) }))} style={{ ...S.input, width: 50, fontSize: 12, padding: '6px 4px', background: 'rgba(0,0,0,0.3)', color: T.t1 }}>
                    <option value={0}>00</option>
                    <option value={30}>30</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ ...S.card, padding: '14px', marginBottom: 12 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 10 }}>Profile</div>
          <div style={{ fontSize: 11, color: T.t2, fontFamily: T.fm, marginBottom: 12 }}>
            Started: {profile?.startDate || 'Not set'} {'\u00B7'} Day {daysSinceStart}
          </div>
          <button onClick={() => { if (window.confirm('Reset your profile? You will go through onboarding again.')) { setProfile(null); } }} style={{ ...S.newVialBtn, color: 'rgba(220,80,80,0.6)', borderColor: 'rgba(220,80,80,0.2)' }}>Reset Profile</button>
        </div>

        <CloudSync />

        <div style={{ ...S.card, padding: '14px', marginBottom: 12 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 10 }}>Data Management</div>
          {/* Storage health bar */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: T.t2, fontFamily: T.fm }}>
                Storage: {parseFloat(storageInfo.kb) > 1024 ? storageInfo.mb + ' MB' : storageInfo.kb + ' KB'} of ~5 MB
              </span>
              <span style={{ fontSize: 10, fontFamily: T.fm, fontWeight: 600, color: storageHealth.critical ? 'rgba(220,80,80,0.9)' : storageHealth.warning ? T.amber : '#5cb870' }}>
                {storageHealth.status === 'critical' ? '\u26A0 Critical' : storageHealth.status === 'warning' ? '\u26A0 Getting Full' : '\u2713 Healthy'}
              </span>
            </div>
            <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
              <div style={{
                width: Math.min(parseFloat(storageHealth.usedPct), 100) + '%',
                height: '100%', borderRadius: 3,
                background: storageHealth.critical ? 'rgba(220,80,80,0.7)' : storageHealth.warning ? 'rgba(201,168,76,0.6)' : 'rgba(92,184,112,0.5)',
                transition: 'width .4s ease',
              }} />
            </div>
            {storageHealth.critical && (
              <div style={{ fontSize: 11, color: 'rgba(220,80,80,0.8)', fontFamily: T.fm, marginTop: 6, lineHeight: 1.5 }}>
                {'\u26A0'} Storage is nearly full. Export a backup and consider clearing old data to avoid data loss.
              </div>
            )}
            {storageHealth.warning && !storageHealth.critical && (
              <div style={{ fontSize: 11, color: T.amber, fontFamily: T.fm, marginTop: 6, lineHeight: 1.5 }}>
                Storage is filling up ({storageHealth.usedPct}% used). Consider exporting a backup soon.
              </div>
            )}
          </div>
          {photoStorageInfo && photoStorageInfo.count > 0 && (
            <div style={{ fontSize: 11, color: T.t2, fontFamily: T.fm, marginBottom: 4 }}>
              Photos: {photoStorageInfo.count} saved ({photoStorageInfo.mb} MB) — stored separately in IndexedDB
            </div>
          )}
          <div style={{ height: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={() => handleExport(true)} disabled={exporting} style={{ ...S.logBtn, flex: 1, padding: '10px', textAlign: 'center', fontSize: 11, opacity: exporting ? 0.5 : 1 }}>
              {exporting ? 'Exporting...' : 'Full Backup'}
            </button>
            <button onClick={() => fileInputRef.current?.click()} style={{ ...S.newVialBtn, flex: 1, padding: '10px', textAlign: 'center' }}>Import Backup</button>
            <input ref={fileInputRef} type='file' accept='.json' onChange={handleImport} style={{ display: 'none' }} />
          </div>
          {photoStorageInfo && photoStorageInfo.count > 0 && (
            <button onClick={() => handleExport(false)} disabled={exporting} style={{ ...S.newVialBtn, width: '100%', marginBottom: 8, fontSize: 10, opacity: exporting ? 0.5 : 1 }}>
              Export Without Photos (smaller file)
            </button>
          )}
          {importStatus && <div style={{ fontSize: 11, color: T.gold, fontFamily: T.fm, marginTop: 8 }}>{importStatus}</div>}
          <button onClick={async () => { if (window.confirm('Delete ALL Samsara data? This cannot be undone.')) { await clearAllData(); window.location.reload(); } }} style={{ ...S.newVialBtn, marginTop: 8, color: 'rgba(220,80,80,0.6)', borderColor: 'rgba(220,80,80,0.2)' }}>Clear All Data</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <AboutDisclaimer />
        </div>

        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, letterSpacing: 2 }}>SAMSARA v4.0</div>
          <div style={{ fontSize: 9, color: T.t4, fontFamily: T.fm, marginTop: 4 }}>Eastern philosophy meets biohacking precision</div>
        </div>
      </div>}

      {addModal && renderModal(false)}
      {editModal && renderModal(true)}
      {priceImportModal && renderPriceImportModal()}

      {editProfileModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)' }} onClick={() => setEditProfileModal(false)}>
          <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingTop: 'env(safe-area-inset-top, 44px)', paddingLeft: 16, paddingRight: 16, paddingBottom: 'calc(env(safe-area-inset-bottom, 8px) + 80px)', maxWidth: 480, margin: '0 auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={() => setEditProfileModal(false)} style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(255,255,255,0.06)', border: 'none', color: T.t2, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'\u2715'}</button>
            </div>
            <h3 style={{ fontFamily: T.fd, fontSize: 24, fontWeight: 300, color: T.t1, marginBottom: 20 }}>Edit Profile</h3>

            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm, marginBottom: 10 }}>Personal</div>
            <div style={{ marginBottom: 16 }}><label style={S.label}>Name</label><input type='text' value={profile?.name || ''} onChange={e => updateProfile('name', e.target.value)} style={{ ...S.input, width: '100%', fontSize: 14 }} /></div>
            <div style={{ marginBottom: 16 }}><label style={S.label}>Age</label><input type='number' value={profile?.age || ''} onChange={e => updateProfile('age', e.target.value)} style={{ ...S.input, width: '100%', fontSize: 14 }} /></div>

            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm, marginBottom: 10, marginTop: 24 }}>Goals</div>
            <div style={{ marginBottom: 16 }}><label style={S.label}>Target Weight ({profile?.unitSystem === 'metric' ? 'kg' : 'lbs'})</label><input type='number' value={profile?.targetWeight || ''} onChange={e => updateProfile('targetWeight', e.target.value)} style={{ ...S.input, width: '100%', fontSize: 14 }} /></div>
            <div style={{ marginBottom: 16 }}><label style={S.label}>Target Waist ({profile?.unitSystem === 'metric' ? 'cm' : 'in'})</label><input type='number' value={profile?.targetWaist || ''} onChange={e => updateProfile('targetWaist', e.target.value)} style={{ ...S.input, width: '100%', fontSize: 14 }} /></div>
            <div style={{ marginBottom: 16 }}><label style={S.label}>Target Body Fat %</label><input type='number' value={profile?.targetBodyFat || ''} onChange={e => updateProfile('targetBodyFat', e.target.value)} style={{ ...S.input, width: '100%', fontSize: 14 }} /></div>
            <div style={{ marginBottom: 16 }}><label style={S.label}>Goal Date</label><input type='date' value={profile?.goalDate || ''} onChange={e => updateProfile('goalDate', e.target.value)} style={{ ...S.input, width: '100%', fontSize: 14, colorScheme: 'dark' }} /></div>

            <button onClick={() => setEditProfileModal(false)} style={{ ...S.logBtn, width: '100%', padding: '14px', textAlign: 'center', fontSize: 14, marginTop: 8 }}>Done</button>
            <div style={{ height: 40 }} />
          </div>
        </div>
      )}
    </div>
  );
}
