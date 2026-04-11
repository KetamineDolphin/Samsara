/* SAMSARA - Universal Search Overlay */
import { useState, useMemo, useRef, useEffect } from 'react';
import T from '../utils/tokens';
import S from '../utils/styles';
import LIB from '../data/library';

const MAX_RESULTS = 20;

function searchAll(query, { logs, checkins, stack, labResults }) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  const results = [];

  // Search compounds in library
  LIB.forEach(p => {
    if (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))) {
      results.push({ type: 'compound', id: p.id, title: p.name, subtitle: p.category + ' \u00B7 ' + p.defaultDose + ' ' + p.defaultUnit, tab: 'PROFILE' });
    }
  });

  // Search dose logs
  (logs || []).forEach(l => {
    if ((l.name && l.name.toLowerCase().includes(q)) || (l.doseLabel && l.doseLabel.toLowerCase().includes(q))) {
      results.push({ type: 'log', id: l.date + l.cid, title: l.name, subtitle: l.doseLabel + ' \u00B7 ' + l.date + ' ' + (l.time || ''), tab: 'TRACK' });
    }
  });

  // Search checkins
  (checkins || []).forEach((c, i) => {
    const txt = [c.weight && (c.weight + ' lbs'), c.waist && (c.waist + '"'), c.analysis && c.analysis.keyObservation].filter(Boolean).join(' ').toLowerCase();
    if (txt.includes(q) || (c.date && c.date.includes(q))) {
      results.push({ type: 'checkin', id: 'ci' + i, title: 'Check-in Day ' + (c.day || '?'), subtitle: (c.weight || '?') + ' lbs \u00B7 ' + (c.date || ''), tab: 'BODY' });
    }
  });

  // Search lab results
  (labResults || []).forEach((lab, i) => {
    const txt = [lab.date, lab.source, ...(lab.markers || []).map(m => m.name + ' ' + m.value)].filter(Boolean).join(' ').toLowerCase();
    if (txt.includes(q)) {
      results.push({ type: 'lab', id: 'lab' + i, title: 'Lab Results ' + (lab.date || ''), subtitle: (lab.markers || []).length + ' markers', tab: 'METRICS' });
    }
  });

  // Search stack
  (stack || []).forEach(c => {
    if (c.name && c.name.toLowerCase().includes(q)) {
      results.push({ type: 'stack', id: 'stk' + c.id, title: c.name + ' (in stack)', subtitle: (c.dose || '?') + ' ' + (c.unit || 'mcg') + ' \u00B7 ' + (c.frequency || 'daily'), tab: 'TRACK' });
    }
  });

  // Dedupe by title+type and limit
  const seen = new Set();
  return results.filter(r => {
    const key = r.type + r.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_RESULTS);
}

const TYPE_ICONS = {
  compound: '\u2B22',
  log: '\u2192',
  checkin: '\u25CE',
  lab: '\u2696',
  stack: '\u2261',
};

const TYPE_COLORS = {
  compound: T.gold,
  log: '#5cb870',
  checkin: T.teal,
  lab: T.purple,
  stack: T.amber,
};

export default function SearchOverlay({ onClose, onNavigate, logs, checkins, stack, labResults }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const results = useMemo(() => searchAll(query, { logs, checkins, stack, labResults }), [query, logs, checkins, stack, labResults]);

  // Group results by type
  const grouped = useMemo(() => {
    const g = {};
    results.forEach(r => {
      if (!g[r.type]) g[r.type] = [];
      g[r.type].push(r);
    });
    return g;
  }, [results]);

  const typeLabels = { compound: 'Compounds', log: 'Dose Logs', checkin: 'Check-ins', lab: 'Lab Results', stack: 'Your Stack' };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(8,9,11,0.95)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 'env(safe-area-inset-top, 0px)',
    }}>
      <div style={{ width: '100%', maxWidth: 480, padding: '16px 16px 0' }}>
        {/* Search bar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search compounds, logs, check-ins..."
              style={{ ...S.input, width: '100%', fontSize: 15, padding: '13px 14px 13px 36px', background: 'rgba(255,255,255,0.06)' }}
            />
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: T.t3, pointerEvents: 'none' }}>{'\u2315'}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.t2, fontFamily: T.fm, fontSize: 13, cursor: 'pointer', padding: '8px', whiteSpace: 'nowrap' }}>Cancel</button>
        </div>

        {/* Results */}
        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 100px)', paddingBottom: 40 }}>
          {query.length >= 2 && results.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 24, opacity: 0.2, marginBottom: 8 }}>{'\u2315'}</div>
              <div style={{ fontSize: 13, color: T.t3, fontFamily: T.fm }}>No results for "{query}"</div>
            </div>
          )}

          {Object.entries(grouped).map(([type, items]) => (
            <div key={type} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: TYPE_COLORS[type] || T.t3, fontFamily: T.fm, marginBottom: 6, padding: '0 4px' }}>{typeLabels[type] || type}</div>
              {items.map(r => (
                <button key={r.id} onClick={() => { onNavigate(r.tab); onClose(); }} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid ' + T.border,
                  borderRadius: 10, marginBottom: 4, width: '100%', cursor: 'pointer',
                  textAlign: 'left', transition: 'background .15s',
                }}>
                  <span style={{ fontSize: 12, color: TYPE_COLORS[type] || T.t3, width: 20, textAlign: 'center', flexShrink: 0 }}>{TYPE_ICONS[type] || '\u2022'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.t1, fontFamily: T.fb, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subtitle}</div>
                  </div>
                  <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, flexShrink: 0, opacity: 0.5 }}>{r.tab}</span>
                </button>
              ))}
            </div>
          ))}

          {query.length < 2 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 24, opacity: 0.15, marginBottom: 8 }}>{'\u2315'}</div>
              <div style={{ fontSize: 13, color: T.t3, fontFamily: T.fm, lineHeight: 1.6 }}>Search across your entire protocol --<br />compounds, dose logs, check-ins, and labs.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
