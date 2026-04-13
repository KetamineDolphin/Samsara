/* SAMSARA v4.0 - CalcTab with interactive syringe */
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import T from '../utils/tokens';
import S from '../utils/styles';
import { FREQ_META } from '../data/library';
import { SamsaraSymbol } from '../components/Shared';
import { CalcDisclaimer } from '../components/Disclaimers';

/* ── Interactive Syringe ─────────────────────────── */
function InteractiveSyringe({ u, max = 100, onUnitsChange, concentration }) {
  const svgRef = useRef(null);
  const dragging = useRef(false);
  const startY = useRef(null);
  const startUnits = useRef(null);
  const lastEmitted = useRef(null);
  const cl = Math.min(Math.max(u || 0, 0), max);
  const pct = cl / max;
  const bT = 36, bB = 248, bH = bB - bT;
  const fH = pct * bH, fY = bB - fH;
  const ins = fH >= 24, lY = ins ? fY + fH / 2 + 4.5 : fY - 8, lC = ins ? T.t1 : T.gold;
  const DEAD_ZONE = 6; // px before drag engages
  const SNAP = max <= 50 ? 1 : 2.5; // coarser snap: 1-unit for small, 2.5-unit for large

  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const y = bB - (i / 10) * bH, m = i % 5 === 0;
    ticks.push(
      <g key={i}>
        <line x1={m ? 54 : 59} y1={y} x2={68} y2={y} stroke={m ? "rgba(201,168,76,0.22)" : "rgba(240,236,228,0.06)"} strokeWidth={m ? 1.2 : 0.6} />
        {m && <text x={48} y={y + 3.5} textAnchor="end" fill={T.t3} fontSize="10" fontFamily={T.fm}>{i * 10}</text>}
      </g>
    );
  }

  const yToUnits = useCallback((clientY) => {
    if (!svgRef.current) return null;
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const svgH = rect.height;
    const scaleY = 300 / svgH;
    const svgY = (clientY - rect.top) * scaleY;
    const clamped = Math.min(Math.max(svgY, bT), bB);
    const unitsPct = 1 - (clamped - bT) / bH;
    const units = Math.round(unitsPct * max / SNAP) * SNAP;
    return Math.min(Math.max(units, 0), max);
  }, [max, bT, bB, bH, SNAP]);

  const emitChange = useCallback((units) => {
    if (units !== lastEmitted.current && onUnitsChange) {
      lastEmitted.current = units;
      onUnitsChange(units);
    }
  }, [onUnitsChange]);

  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    dragging.current = 'pending';
    startY.current = e.touches[0].clientY;
    startUnits.current = cl;
  }, [cl]);

  const handleTouchMove = useCallback((e) => {
    if (!dragging.current) return;
    e.preventDefault();
    const dy = Math.abs(e.touches[0].clientY - startY.current);
    if (dragging.current === 'pending' && dy < DEAD_ZONE) return;
    dragging.current = true;
    emitChange(yToUnits(e.touches[0].clientY));
  }, [yToUnits, emitChange, DEAD_ZONE]);

  const handleTouchEnd = useCallback(() => {
    dragging.current = false;
    startY.current = null;
  }, []);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = 'pending';
    startY.current = e.clientY;
    startUnits.current = cl;
  }, [cl]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    const dy = Math.abs(e.clientY - startY.current);
    if (dragging.current === 'pending' && dy < DEAD_ZONE) return;
    dragging.current = true;
    emitChange(yToUnits(e.clientY));
  }, [yToUnits, emitChange, DEAD_ZONE]);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
    startY.current = null;
  }, []);

  useEffect(() => {
    const up = () => { dragging.current = false; };
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('touchend', up); };
  }, []);

  // Dose info from units for the label
  const dMg = concentration > 0 ? (cl / 100) * concentration : 0;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 130 300"
        style={{ width: "100%", maxWidth: 110, height: "auto", cursor: 'ns-resize', touchAction: 'none', userSelect: 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <defs>
          <linearGradient id="syF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.amber} stopOpacity="0.85" /><stop offset="100%" stopColor={T.gold} stopOpacity="0.4" /></linearGradient>
          <filter id="syG"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {/* Barrel outline */}
        <rect x="68" y={bT - 3} width="24" height={bH + 6} rx="3" fill="none" stroke="rgba(240,236,228,0.07)" strokeWidth="1.5" />
        {/* Barrel background */}
        <rect x="70" y={bT} width="20" height={bH} rx="1" fill="rgba(255,255,255,0.012)" />
        {/* Touch target overlay (invisible, larger hit area) */}
        <rect x="45" y={bT - 10} width="55" height={bH + 20} fill="transparent" />
        {/* Fluid fill */}
        <rect x="70" y={fY} width="20" height={fH} rx="1" fill="url(#syF)" filter={cl > 0 ? "url(#syG)" : undefined} style={{ transition: dragging.current ? 'none' : "y .3s cubic-bezier(.22,1,.36,1),height .3s cubic-bezier(.22,1,.36,1)" }} />
        {/* Plunger rod */}
        <rect x="78" y="6" width="4" height={Math.max(fY - 8, 0)} rx="2" fill="rgba(240,236,228,0.08)" style={{ transition: dragging.current ? 'none' : "height .3s cubic-bezier(.22,1,.36,1)" }} />
        {/* Plunger top cap */}
        <rect x="70" y="0" width="20" height="8" rx="2.5" fill="rgba(240,236,228,0.1)" />
        {/* Plunger stopper */}
        <rect x="70" y={Math.max(fY - 3, bT - 3)} width="20" height="5" rx="1.5" fill="rgba(240,236,228,0.18)" style={{ transition: dragging.current ? 'none' : "y .3s cubic-bezier(.22,1,.36,1)" }} />
        {/* Drag handle indicator on stopper */}
        <line x1="74" y1={Math.max(fY - 1, bT - 1)} x2="86" y2={Math.max(fY - 1, bT - 1)} stroke="rgba(201,168,76,0.35)" strokeWidth="0.8" strokeLinecap="round" style={{ transition: dragging.current ? 'none' : "y .3s" }} />
        {ticks}
        {/* Needle tip */}
        <path d={`M76 ${bB + 3}L84 ${bB + 3}L82 ${bB + 15}L78 ${bB + 15}Z`} fill="rgba(240,236,228,0.06)" />
        <line x1="80" y1={bB + 15} x2="80" y2="292" stroke="rgba(201,168,76,0.2)" strokeWidth="1" strokeLinecap="round" />
        {/* Units label */}
        {cl > 0 && <text x="80" y={lY} textAnchor="middle" fill={lC} fontSize="11" fontWeight="500" fontFamily={T.fm} style={{ transition: dragging.current ? 'none' : "y .3s cubic-bezier(.22,1,.36,1)", pointerEvents: 'none' }}>{cl.toFixed(1)}u</text>}
      </svg>
      {/* Drag hint */}
      {onUnitsChange && cl > 0 && (
        <div style={{ textAlign: 'center', marginTop: -4 }}>
          <span style={{ fontSize: 8, color: T.t3, fontFamily: T.fm, letterSpacing: 1, opacity: 0.6 }}>{'\u2195'} DRAG TO ADJUST</span>
        </div>
      )}
    </div>
  );
}

/* ── Main CalcTab ─────────────────────────── */
export default function CalcTab({ cs, setCs, stack, onLogDose }) {
  const presets = useMemo(() => stack.map(s => ({ name: s.name, vialMg: s.vialMg, dose: s.dose, unit: s.unit, freq: s.frequency })), [stack]);
  const { vialMg, waterMl, doseMcg, doseUnit, freq, waterLocked, activePreset } = cs;
  const set = (k, v) => setCs(p => ({ ...p, [k]: v, activePreset: null }));
  const rr = useRef(null);
  const vN = parseFloat(vialMg) || 0, wN = parseFloat(waterMl) || 0, dN = parseFloat(doseMcg) || 0;
  const cn = wN > 0 ? vN / wN : 0, dMg = doseUnit === "mcg" ? dN / 1000 : dN, vol = cn > 0 ? dMg / cn : 0, un = vol * 100;
  const dv = dMg > 0 ? vN / dMg : 0, freqM = FREQ_META[freq] || FREQ_META.daily, ds = freqM.perWeek > 0 ? dv / (freqM.perWeek / 7) : 0;
  const ok = vN > 0 && wN > 0 && dN > 0;
  const ap = useCallback(p => { setCs({ vialMg: String(p.vialMg), waterMl: "2", doseMcg: String(p.dose), doseUnit: p.unit, freq: p.freq, waterLocked: true, activePreset: p.name }); }, [setCs]);
  useEffect(() => { if (ok && rr.current) rr.current.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [ok, un]);

  // Back-calculate dose from syringe drag
  const handleSyringeChange = useCallback((newUnits) => {
    if (cn <= 0) return;
    // units → ml → mg → dose in current unit
    const newVol = newUnits / 100;
    const newDMg = newVol * cn;
    const newDose = doseUnit === "mcg" ? newDMg * 1000 : newDMg;
    // Round to reasonable precision
    const rounded = doseUnit === "mcg" ? Math.round(newDose) : Math.round(newDose * 100) / 100;
    setCs(p => ({ ...p, doseMcg: String(rounded) }));
  }, [cn, doseUnit, setCs]);

  return (
    <div style={{ animation: "fadeUp .5s ease both" }}>
      <header style={{ ...S.header, marginBottom: 16 }}><SamsaraSymbol size={44} detail="full" /><h1 style={{ ...S.brand, marginTop: -2 }}>SAMSARA</h1><p style={{ ...S.sub, marginTop: 2 }}>Peptide Calculator</p></header>
      {presets.length > 0 && <div style={{ marginBottom: 21 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: T.t3, fontFamily: T.fm, textTransform: 'uppercase', textAlign: 'center', marginBottom: 8 }}>Presets</div>
        <div style={S.pills}>{presets.map(p => <button key={p.name} onClick={() => ap(p)} style={{ ...S.pill, padding: '9px 16px', ...(activePreset === p.name ? S.pillOn : {}) }}>{p.name}</button>)}</div>
      </div>}
      {/* First-use guidance */}
      {presets.length === 0 && !vialMg && (
        <div style={{ ...S.card, padding: '14px 16px', marginBottom: 13, borderColor: 'rgba(0,210,180,0.15)', background: 'rgba(0,210,180,0.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.teal, fontFamily: T.fb, marginBottom: 4 }}>{'\u2139'} Your First Calculation</div>
          <div style={{ fontSize: 12, color: T.t2, fontFamily: T.fm, lineHeight: 1.6 }}>Enter your vial size, water volume, and desired dose. Samsara will calculate exactly how many units to draw on your syringe. Add compounds in the Profile tab to see presets here.</div>
        </div>
      )}
      <div style={S.card}>
        <div style={S.field}><label style={S.label}>Vial Size</label><div style={S.frow}><input type="number" inputMode="decimal" value={vialMg} onChange={e => set("vialMg", e.target.value)} style={S.input} /><span style={S.tag}>mg</span></div></div>
        <div style={S.divider} />
        <div style={S.field}><label style={S.label}>Bacteriostatic Water</label><div style={S.frow}><input type="number" inputMode="decimal" value={waterMl} onChange={e => { if (!waterLocked) set("waterMl", e.target.value) }} readOnly={waterLocked} style={{ ...S.input, ...(waterLocked ? { opacity: 0.4 } : {}) }} /><span style={S.tag}>ml</span><button onClick={() => setCs(p => ({ ...p, waterLocked: !p.waterLocked, waterMl: !p.waterLocked ? "2" : p.waterMl }))} style={{ ...S.lockBtn, borderRadius: 21, padding: '7px 14px', fontSize: 11, letterSpacing: 1, ...(waterLocked ? { ...S.lockOn, boxShadow: '0 0 8px rgba(201,168,76,0.12)' } : {}) }}>{waterLocked ? "\u25C6 2ml" : "\u25C7 Lock"}</button></div></div>
        <div style={S.divider} />
        <div style={S.field}><label style={S.label}>Desired Dose</label><div style={S.frow}><input type="number" inputMode="decimal" value={doseMcg} onChange={e => set("doseMcg", e.target.value)} style={S.input} /><div style={S.togGrp}>{["mcg", "mg"].map(u => <button key={u} onClick={() => set("doseUnit", u)} style={{ ...S.togBtn, ...(doseUnit === u ? S.togOn : {}) }}>{u}</button>)}</div></div></div>
        <div style={S.divider} />
        <div style={S.field}><label style={S.label}>Frequency</label><div style={{ ...S.frow, gap: 6 }}>{Object.entries(FREQ_META).filter(([k]) => ["daily", "2x_week", "weekly"].includes(k)).map(([k, v]) => <button key={k} onClick={() => setCs(p => ({ ...p, freq: k }))} style={{ ...S.freqBtn, ...(freq === k ? S.freqOn : {}) }}>{v.label}</button>)}</div></div>
      </div>
      {ok && <div ref={rr} style={{ ...S.resultCard, borderTop: '1.5px solid rgba(201,168,76,0.3)', boxShadow: '0 -1px 12px rgba(201,168,76,0.06), 0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)', animation: "fadeUp .4s ease both" }}>
        <div style={S.resRow}><span style={S.resLabel}>Concentration</span><span style={S.resGold}>{cn.toFixed(2)} mg/ml</span></div><div style={S.dividerGold} />
        <div style={{ textAlign: "center", padding: "18px 0 8px" }}><span style={S.drawLabel}>Draw</span><span style={{ ...S.drawVal, fontSize: 48, letterSpacing: 1 }}>{un.toFixed(1)}<span style={{ ...S.drawUnit, fontSize: 18 }}> units</span></span><span style={S.drawSub}>({vol.toFixed(3)} ml on U-100 syringe)</span></div>
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
          <InteractiveSyringe u={un} onUnitsChange={handleSyringeChange} concentration={cn} />
        </div><div style={S.dividerGold} />
        <div style={{ display: 'flex', justifyContent: 'space-around', gap: 6, paddingTop: 8 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.025)', borderRadius: 8, padding: '10px 4px', textAlign: 'center' }}><span style={S.statV}>{dv.toFixed(0)}</span><span style={S.statL}>doses/vial</span></div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.025)', borderRadius: 8, padding: '10px 4px', textAlign: 'center' }}><span style={S.statV}>{Math.floor(ds)}</span><span style={S.statL}>days supply</span></div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.025)', borderRadius: 8, padding: '10px 4px', textAlign: 'center' }}><span style={S.statV}>{dMg.toFixed(dMg < 0.1 ? 3 : 2)}</span><span style={S.statL}>mg/dose</span></div>
        </div>
        {un > 100 && <div style={{ ...S.warning, background: 'rgba(255,180,50,0.06)', borderColor: 'rgba(255,180,50,0.12)', fontSize: 12, color: 'rgba(255,200,100,0.6)' }}>{"\u26A0"} Exceeds 100 units - verify inputs or split draws.</div>}
        {un > 0 && un < 2 && <div style={{ ...S.infoBox, fontSize: 12, color: 'rgba(201,168,76,0.5)' }}>{"\u2139"} Very small draw. Consider less BAC water.</div>}
        {onLogDose && activePreset && <button onClick={() => { onLogDose(activePreset); if (navigator.vibrate) navigator.vibrate(40); }} style={{ ...S.logBtn, width: '100%', padding: '10px', textAlign: 'center', marginTop: 10 }}>Log This Dose {"\u2192"} Track</button>}
      </div>}
      <div style={{ opacity: 0.5, marginTop: 4 }}><CalcDisclaimer /></div>
    </div>
  );
}
