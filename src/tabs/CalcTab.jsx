/* SAMSARA v3.0 - CalcTab */
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import T from '../utils/tokens';
import S from '../utils/styles';
import { FREQ_META } from '../data/library';
import { SamsaraSymbol, SyringeVis } from '../components/Shared';

export default function CalcTab({ cs, setCs, stack }) {
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

  return (
    <div style={{ animation: "fadeUp .5s ease both" }}>
      <header style={S.header}><SamsaraSymbol size={56} detail="full" /><h1 style={S.brand}>SAMSARA</h1><p style={S.sub}>Peptide Calculator</p></header>
      <div style={S.pills}>{presets.map(p => <button key={p.name} onClick={() => ap(p)} style={{ ...S.pill, ...(activePreset === p.name ? S.pillOn : {}) }}>{p.name}</button>)}</div>
      <div style={S.card}>
        <div style={S.field}><label style={S.label}>Vial Size</label><div style={S.frow}><input type="number" inputMode="decimal" value={vialMg} onChange={e => set("vialMg", e.target.value)} placeholder="10" style={S.input} /><span style={S.tag}>mg</span></div></div>
        <div style={S.divider} />
        <div style={S.field}><label style={S.label}>Bacteriostatic Water</label><div style={S.frow}><input type="number" inputMode="decimal" value={waterMl} onChange={e => { if (!waterLocked) set("waterMl", e.target.value) }} placeholder="2" readOnly={waterLocked} style={{ ...S.input, ...(waterLocked ? { opacity: 0.4 } : {}) }} /><span style={S.tag}>ml</span><button onClick={() => setCs(p => ({ ...p, waterLocked: !p.waterLocked, waterMl: !p.waterLocked ? "2" : p.waterMl }))} style={{ ...S.lockBtn, ...(waterLocked ? S.lockOn : {}) }}>{waterLocked ? "\u25C6 2ml" : "\u25C7 Lock"}</button></div></div>
        <div style={S.divider} />
        <div style={S.field}><label style={S.label}>Desired Dose</label><div style={S.frow}><input type="number" inputMode="decimal" value={doseMcg} onChange={e => set("doseMcg", e.target.value)} placeholder="300" style={S.input} /><div style={S.togGrp}>{["mcg", "mg"].map(u => <button key={u} onClick={() => set("doseUnit", u)} style={{ ...S.togBtn, ...(doseUnit === u ? S.togOn : {}) }}>{u}</button>)}</div></div></div>
        <div style={S.divider} />
        <div style={S.field}><label style={S.label}>Frequency</label><div style={{ ...S.frow, gap: 6 }}>{Object.entries(FREQ_META).filter(([k]) => ["daily", "2x_week", "weekly"].includes(k)).map(([k, v]) => <button key={k} onClick={() => setCs(p => ({ ...p, freq: k }))} style={{ ...S.freqBtn, ...(freq === k ? S.freqOn : {}) }}>{v.label}</button>)}</div></div>
      </div>
      {ok && <div ref={rr} style={{ ...S.resultCard, animation: "fadeUp .4s ease both" }}>
        <div style={S.resRow}><span style={S.resLabel}>Concentration</span><span style={S.resGold}>{cn.toFixed(2)} mg/ml</span></div><div style={S.dividerGold} />
        <div style={{ textAlign: "center", padding: "14px 0 6px" }}><span style={S.drawLabel}>Draw</span><span style={S.drawVal}>{un.toFixed(1)}<span style={S.drawUnit}> units</span></span><span style={S.drawSub}>({vol.toFixed(3)} ml on U-100 syringe)</span></div>
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}><SyringeVis u={un} /></div><div style={S.dividerGold} />
        <div style={S.stats}><div style={S.stat}><span style={S.statV}>{dv.toFixed(0)}</span><span style={S.statL}>doses/vial</span></div><div style={S.stat}><span style={S.statV}>{Math.floor(ds)}</span><span style={S.statL}>days supply</span></div><div style={S.stat}><span style={S.statV}>{dMg.toFixed(dMg < 0.1 ? 3 : 2)}</span><span style={S.statL}>mg/dose</span></div></div>
        {un > 100 && <div style={S.warning}>{"\u26A0"} Exceeds 100 units - verify inputs or split draws.</div>}
        {un > 0 && un < 2 && <div style={S.infoBox}>{"\u2139"} Very small draw. Consider less BAC water.</div>}
      </div>}
    </div>
  );
}
