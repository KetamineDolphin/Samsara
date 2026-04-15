/* SAMSARA v4.0 - MetricsTab with Charts + Dual-axis Recomp Signal + Labs */
import { useState, useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
import T from '../utils/tokens';
import S from '../utils/styles';
import { getToday, getNow, parseBF, makeId } from '../utils/helpers';
import { logSubjective } from '../data/analytics';
import { SamsaraSymbol, Enso } from '../components/Shared';
import { parseLabText, extractLabDate, countParsedMarkers } from '../utils/labParser';
import { ProLock, ProBadge } from '../components/ProGate';

Chart.register(...registerables);

// ============================================================================
// LABS CONSTANTS
// ============================================================================

const REFERENCE_RANGES = {
  totalTestosterone: { male: { low: 300, optimal: 500, high: 1000, unit: 'ng/dL' }, female: { low: 15, optimal: 50, high: 70, unit: 'ng/dL' } },
  freeTestosterone: { male: { low: 9, optimal: 15, high: 30, unit: 'ng/dL' }, female: { low: 0.3, optimal: 1.5, high: 3.5, unit: 'ng/dL' } },
  shbg: { male: { low: 10, optimal: 30, high: 57, unit: 'nmol/L' }, female: { low: 18, optimal: 50, high: 114, unit: 'nmol/L' } },
  lh: { male: { low: 1.7, optimal: 4, high: 8.6, unit: 'mIU/mL' }, female: { low: 2, optimal: 10, high: 15, unit: 'mIU/mL' } },
  fsh: { male: { low: 1.5, optimal: 5, high: 12.4, unit: 'mIU/mL' }, female: { low: 3, optimal: 7, high: 10, unit: 'mIU/mL' } },
  estradiol: { male: { low: 10, optimal: 25, high: 40, unit: 'pg/mL' }, female: { low: 30, optimal: 100, high: 400, unit: 'pg/mL' } },
  prolactin: { male: { low: 2, optimal: 8, high: 18, unit: 'ng/mL' }, female: { low: 2, optimal: 12, high: 29, unit: 'ng/mL' } },
  igf1: { both: { low: 115, optimal: 250, high: 350, unit: 'ng/mL' } },
  tsh: { both: { low: 0.45, optimal: 1.5, high: 4.5, unit: 'uIU/mL' } },
  freeT4: { both: { low: 0.8, optimal: 1.2, high: 1.8, unit: 'ng/dL' } },
  glucose: { both: { low: 70, optimal: 85, high: 99, unit: 'mg/dL' } },
  hba1c: { both: { low: 4.0, optimal: 5.0, high: 5.6, unit: '%' } },
  totalCholesterol: { both: { low: 150, optimal: 175, high: 200, unit: 'mg/dL' } },
  ldl: { both: { low: 0, optimal: 90, high: 130, unit: 'mg/dL' } },
  hdl: { male: { low: 40, optimal: 55, high: 999, unit: 'mg/dL' }, female: { low: 50, optimal: 65, high: 999, unit: 'mg/dL' } },
  triglycerides: { both: { low: 0, optimal: 100, high: 150, unit: 'mg/dL' } },
  hematocrit: { male: { low: 38.3, optimal: 44, high: 50, unit: '%' }, female: { low: 35.5, optimal: 40, high: 44.9, unit: '%' } },
  hemoglobin: { male: { low: 13.5, optimal: 15, high: 17.5, unit: 'g/dL' }, female: { low: 12, optimal: 13.5, high: 15.5, unit: 'g/dL' } },
  ast: { both: { low: 0, optimal: 22, high: 40, unit: 'U/L' } },
  alt: { both: { low: 0, optimal: 22, high: 40, unit: 'U/L' } },
  creatinine: { male: { low: 0.7, optimal: 1.0, high: 1.3, unit: 'mg/dL' }, female: { low: 0.5, optimal: 0.8, high: 1.1, unit: 'mg/dL' } },
  egfr: { both: { low: 60, optimal: 90, high: 999, unit: 'mL/min' } },
  vitaminD: { both: { low: 30, optimal: 55, high: 100, unit: 'ng/mL' } },
  cortisol: { both: { low: 6, optimal: 15, high: 23, unit: 'mcg/dL' } },
  psa: { male: { low: 0, optimal: 1, high: 4, unit: 'ng/mL' } },
  crp: { both: { low: 0, optimal: 0.5, high: 1.0, unit: 'mg/L' } },
  ferritin: { male: { low: 30, optimal: 100, high: 300, unit: 'ng/mL' }, female: { low: 15, optimal: 75, high: 150, unit: 'ng/mL' } },
};

const MARKER_LABELS = {
  totalTestosterone: 'Total Testosterone', freeTestosterone: 'Free Testosterone', shbg: 'SHBG', lh: 'LH', fsh: 'FSH',
  estradiol: 'Estradiol', prolactin: 'Prolactin', dheas: 'DHEA-S', igf1: 'IGF-1', gh: 'Growth Hormone',
  tsh: 'TSH', freeT4: 'Free T4', freeT3: 'Free T3', glucose: 'Fasting Glucose', hba1c: 'HbA1c', insulin: 'Insulin',
  totalCholesterol: 'Total Cholesterol', ldl: 'LDL', hdl: 'HDL', triglycerides: 'Triglycerides', apob: 'ApoB',
  hematocrit: 'Hematocrit', hemoglobin: 'Hemoglobin', rbc: 'RBC', wbc: 'WBC', platelets: 'Platelets',
  ast: 'AST', alt: 'ALT', creatinine: 'Creatinine', egfr: 'eGFR', vitaminD: 'Vitamin D', ferritin: 'Ferritin',
  cortisol: 'AM Cortisol', psa: 'PSA', crp: 'hs-CRP',
};

const MARKER_SECTIONS = {
  'Hormonal': ['totalTestosterone', 'freeTestosterone', 'shbg', 'lh', 'fsh', 'estradiol', 'prolactin', 'dheas'],
  'GH Axis': ['igf1', 'gh'],
  'Thyroid': ['tsh', 'freeT4', 'freeT3'],
  'Metabolic': ['glucose', 'hba1c', 'insulin'],
  'Lipids': ['totalCholesterol', 'ldl', 'hdl', 'triglycerides', 'apob'],
  'Blood Count': ['hematocrit', 'hemoglobin', 'rbc', 'wbc', 'platelets'],
  'Organ Function': ['ast', 'alt', 'creatinine', 'egfr'],
  'Other': ['vitaminD', 'ferritin', 'cortisol', 'psa', 'crp'],
};

const BLOODWORK_SYSTEM_PROMPT = `You are Samsara's bloodwork analyst. You are embedded in a peptide and hormone protocol tracking app. You have access to the user's complete active protocol stack and their lab results.

Your job is to produce an interpretation that reads like a knowledgeable coach who deeply understands peptide and hormone pharmacology - not a generic lab report reader.

CORE PHILOSOPHY:
Connect every abnormal or notable finding directly to a specific compound in their protocol. Always explain the mechanism. Lead with the story not the numbers. The user already has the numbers. They need context. Be specific. Your LH is suppressed because Kisspeptin daily dosing causes receptor desensitization is useful. Your LH is low is not. Be honest about concerns without being alarming. Flag what matters. Dismiss what does not. Never diagnose. Never prescribe. Never recommend specific treatments. Always direct to a healthcare provider for decisions.

YOUR RESPONSE MUST BE A SINGLE JSON OBJECT. NO OTHER TEXT. NO MARKDOWN. NO PREAMBLE. NO POSTAMBLE.

{
  "headline": "string",
  "protocolStory": "string",
  "markerInsights": [{"marker":"string","value":"string with unit","status":"optimal|ok|monitor|concern|urgent","headline":"string","protocolContext":"string","mechanism":"string or null"}],
  "keyFindings": [{"finding":"string","detail":"string","severity":"info|caution|urgent","relatedCompounds":["string"]}],
  "questionsForDoctor": [{"question":"string","why":"string"}],
  "nextLabRecommendation": {"timing":"string","priorityMarkers":["string"],"reason":"string"},
  "overallAssessment": "green|yellow|red",
  "summary": "string"
}

DOMAIN KNOWLEDGE - GH SECRETAGOGUES (CJC-1295, Ipamorelin, Tesamorelin, MK-677, Sermorelin):
These drive IGF-1 via pulsatile or tonic GH release. Expect IGF-1 elevation. MK-677 also elevates fasting glucose and HbA1c due to tonic GH exposure causing insulin resistance. Tesamorelin specifically reduces visceral fat and can improve lipid panel. CJC/Ipa combinations produce pulsatile elevation with less metabolic disruption than MK-677. Watch IGF-1 above 350 ng/mL - supraphysiologic. Watch fasting glucose creep above 95 mg/dL on MK-677.

DOMAIN KNOWLEDGE - GLP-1 (Semaglutide, Tirzepatide, Retatrutide):
Expect improved fasting glucose, HbA1c, triglycerides, ALT, AST as visceral fat drops. LDL may rise transiently with rapid weight loss. Watch for excessive muscle loss if protein intake insufficient. Tirzepatide additionally activates GIP and produces stronger metabolic improvements.

DOMAIN KNOWLEDGE - TRT (Testosterone Cypionate, Enanthate, HCG):
Expect suppressed LH and FSH (HPTA suppression). Total T target 700-1000 ng/dL for most men. Free T should track. Estradiol will rise via aromatization - monitor if above 40 pg/mL with symptoms. Hematocrit commonly rises - above 52% is concerning, above 54% requires intervention (phlebotomy, dose reduction). SHBG often drops. HCG preserves testicular function and intratesticular T.

DOMAIN KNOWLEDGE - KISSPEPTIN, GONADORELIN, ENCLOMIPHENE:
Kisspeptin stimulates endogenous GnRH release, downstream LH/FSH/T. Daily Kisspeptin causes receptor desensitization - pulsatile protocols preserve response. Gonadorelin is GnRH analog, similar mechanism. Enclomiphene blocks estrogen feedback at hypothalamus, driving LH/FSH up and preserving fertility. Expect LH/FSH elevation, T elevation, estradiol may rise.

DOMAIN KNOWLEDGE - ANASTROZOLE (AI):
Blocks aromatase, lowers estradiol. Crashing E2 below 10 pg/mL causes joint pain, low libido, mood issues, lipid deterioration. Target 20-30 pg/mL for most men on TRT.

DOMAIN KNOWLEDGE - COGNITIVE PEPTIDES (Semax, Selank, Dihexa, Cerebrolysin):
Minimal direct bloodwork impact. Monitor cortisol on stress-modulating peptides.

DOMAIN KNOWLEDGE - MITOCHONDRIAL PEPTIDES (SS-31, MOTS-c, Humanin):
MOTS-c improves insulin sensitivity, expect better glucose/HbA1c. SS-31 targets cardiolipin, renal protective. Monitor creatinine and eGFR.

DOMAIN KNOWLEDGE - BIOREGULATORS (Epitalon, Thymalin, Thymogen):
Epitalon may modulate melatonin and cortisol rhythms. Thymic peptides modulate immune markers.

CRITICAL SAFETY THRESHOLDS:
- Hematocrit above 54% - urgent, blood clot risk
- LDL above 160 mg/dL - caution
- ALT/AST above 2x upper limit - caution, hepatic stress
- Fasting glucose above 110 mg/dL - caution, insulin resistance
- HbA1c above 6.0% - caution, prediabetic
- Creatinine above upper limit - caution, renal
- PSA above 4 or doubled from baseline - caution
- Estradiol below 10 on AI - urgent

FORMATTING RULES:
- Use exact compound names from the user's stack
- Marker values always include units
- Keep headlines under 80 chars
- protocolStory should be 2-4 sentences connecting the stack to the results
- summary should be 2-3 paragraphs separated by \\n\\n
- Use 'you' and 'your' directly, second person
- No medical jargon without explanation

DISCLAIMER (always include mentally, never output): This is educational context only, not medical advice.

ABSOLUTE PROHIBITIONS:
- Never diagnose conditions
- Never recommend specific dosages or compound changes
- Never tell the user to stop or start a medication
- Never output anything outside the JSON object
- Never use markdown code fences in the output`;

// ============================================================================
// HELPERS
// ============================================================================

function getMarkerStatus(key, value, sex) {
  if (value == null || value === '' || isNaN(value)) return 'unknown';
  const range = REFERENCE_RANGES[key];
  if (!range) return 'unknown';
  const r = range[sex] || range.both;
  if (!r) return 'unknown';
  const v = Number(value);
  const higherIsBetter = ['hdl', 'vitaminD', 'egfr'].includes(key);
  if (higherIsBetter) {
    if (v < r.low) return 'concern';
    if (v < r.optimal) return 'ok';
    return 'optimal';
  }
  if (v < r.low) return 'concern';
  if (v > r.high) return 'concern';
  const delta = Math.abs(v - r.optimal);
  const span = Math.max(r.high - r.optimal, r.optimal - r.low, 1);
  if (delta / span < 0.3) return 'optimal';
  return 'ok';
}

function getStatusColor(status) {
  const map = {
    optimal: '#5cb870',
    ok: T.gold,
    monitor: T.amber || T.gold,
    concern: 'rgba(220,80,80,0.8)',
    urgent: 'rgba(220,80,80,1)',
    unknown: T.t4 || T.t3,
    green: '#5cb870',
    yellow: T.amber || T.gold,
    red: 'rgba(220,80,80,0.8)',
  };
  return map[status] || T.t3;
}

async function runBloodworkAnalysis(result, stack, previousResults, setLabResults, profile) {
  if (!navigator.onLine) {
    return { success: false, error: 'No internet connection. Lab analysis requires an internet connection to process your results. Connect to Wi-Fi or cellular and try again.' };
  }
  try {
    const markersStr = Object.entries(result.parsedMarkers || {})
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => {
        const r = REFERENCE_RANGES[k];
        const rr = r ? (r[profile?.biologicalSex || 'male'] || r.both) : null;
        const unit = rr ? rr.unit : '';
        const status = getMarkerStatus(k, v, profile?.biologicalSex || 'male');
        return `${MARKER_LABELS[k] || k}: ${v} ${unit} (${status})`;
      }).join('\n');

    const protocolList = (stack || []).map(c => `- ${c.name}${c.dose ? ' ' + c.dose : ''}${c.frequency ? ' ' + c.frequency : ''}`).join('\n') || 'No active compounds';

    const prevContext = (previousResults || []).filter(p => p.id !== result.id && p.parsedMarkers).slice(0, 2).map(p => {
      const ms = Object.entries(p.parsedMarkers).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}:${v}`).join(', ');
      return `Previous (${p.date}): ${ms}`;
    }).join('\n');

    const userMessage = `USER PROFILE:
Sex: ${profile?.biologicalSex || 'male'}
Age: ${profile?.age || 'unknown'}

ACTIVE PROTOCOL STACK:
${protocolList}

LAB DATE: ${result.date}
LAB LABEL: ${result.label || 'Lab Results'}

CURRENT MARKERS:
${markersStr}

${prevContext ? 'PREVIOUS RESULTS FOR TREND CONTEXT:\n' + prevContext : ''}

Analyze this bloodwork in the context of the active protocol. Return only the JSON object.`;

    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: BLOODWORK_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!res.ok) throw new Error('Analysis request failed: ' + res.status);
    const data = await res.json();
    let text = '';
    if (data.content && Array.isArray(data.content)) {
      text = data.content.map(c => c.text || '').join('');
    } else if (typeof data === 'string') {
      text = data;
    } else if (data.text) {
      text = data.text;
    }
    text = text.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
    const interpretation = JSON.parse(text);
    const interpretationDate = new Date().toISOString();
    setLabResults(prev => (prev || []).map(r => r.id === result.id ? { ...r, interpretation, interpretationDate } : r));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message || 'Analysis failed' };
  }
}

async function extractFromImage(base64) {
  if (!navigator.onLine) throw new Error('No internet connection. Connect to Wi-Fi or cellular and try again.');
  const prompt = `You are extracting values from a bloodwork lab report image. Return ONLY a JSON object with marker keys and numeric values. Use these exact keys where applicable: ${Object.keys(MARKER_LABELS).join(', ')}. Also include a date field if visible (YYYY-MM-DD). Example: {"date":"2026-03-15","totalTestosterone":850,"estradiol":28,"hematocrit":48.2}. No other text.`;
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error('Image extraction failed');
  const data = await res.json();
  let text = '';
  if (data.content && Array.isArray(data.content)) text = data.content.map(c => c.text || '').join('');
  else if (data.text) text = data.text;
  else text = JSON.stringify(data);
  text = text.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
  return JSON.parse(text);
}

async function extractFromPDF(base64) {
  if (!navigator.onLine) throw new Error('No internet connection. Connect to Wi-Fi or cellular and try again.');
  const prompt = `You are extracting values from a bloodwork lab report PDF. Return ONLY a JSON object with marker keys and numeric values. Use these exact keys where applicable: ${Object.keys(MARKER_LABELS).join(', ')}. Also include a "date" field if visible (YYYY-MM-DD) and a "label" field with the lab provider name if visible (e.g. "Quest March 2026"). Example: {"date":"2026-03-15","label":"Quest Diagnostics","totalTestosterone":850,"estradiol":28,"hematocrit":48.2}. No other text.`;
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error('PDF extraction failed');
  const data = await res.json();
  let text = '';
  if (data.content && Array.isArray(data.content)) text = data.content.map(c => c.text || '').join('');
  else if (data.text) text = data.text;
  else text = JSON.stringify(data);
  text = text.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
  return JSON.parse(text);
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1200;
        let w = img.width, h = img.height;
        if (w > h && w > maxDim) { h = h * (maxDim / w); w = maxDim; }
        else if (h > maxDim) { w = w * (maxDim / h); h = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// SUB-COMPONENTS (existing)
// ============================================================================

function ChartCard({ title, rightLabel, subtitle, children, height = 180 }) {
  return (
    <div style={{ ...S.card, padding: "14px 14px", marginBottom: 13, border: `1px solid ${T.border}`, borderRadius: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: subtitle ? 4 : 10 }}>
        <span style={{ fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase", color: T.t3, fontFamily: T.fm }}>{title}</span>
        {rightLabel && <span style={{ fontSize: 12, color: T.gold, fontFamily: T.fm, fontWeight: 600, letterSpacing: 0.5 }}>{rightLabel}</span>}
      </div>
      {subtitle && <div style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginBottom: 8, letterSpacing: 0.5 }}>{subtitle}</div>}
      <div style={{ height }}>{children}</div>
    </div>
  );
}

function LineChartVis({ data, color, height = 180 }) {
  const canvasRef = useRef(null); const chartRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !data || data.length < 2) return;
    if (chartRef.current) chartRef.current.destroy();
    const ctx = canvasRef.current.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, color.replace("0.8", "0.3")); grad.addColorStop(1, "transparent");
    chartRef.current = new Chart(ctx, {
      type: "line", data: { labels: data.map(d => d.label), datasets: [{ data: data.map(d => d.value), borderColor: color, backgroundColor: grad, fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: color, borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 600 }, plugins: { legend: { display: false }, tooltip: { backgroundColor: "rgba(15,17,20,0.95)", borderColor: T.gold, borderWidth: 1, titleFont: { family: "DM Mono" }, bodyFont: { family: "DM Mono" }, padding: 8 } }, scales: { x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: T.t3, font: { family: "DM Mono", size: 9 }, maxRotation: 0 } }, y: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: T.t3, font: { family: "DM Mono", size: 10 } } } } }
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data, color, height]);
  return <canvas ref={canvasRef} style={{ width: "100%", height }} />;
}

function RecompChart({ weightData, waistData, height = 180 }) {
  const canvasRef = useRef(null); const chartRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || (!weightData?.length && !waistData?.length)) return;
    if (chartRef.current) chartRef.current.destroy();
    // Merge labels from both datasets and align data
    const allLabels = [...new Set([...(weightData || []).map(d => d.label), ...(waistData || []).map(d => d.label)])];
    allLabels.sort();
    const wMap = Object.fromEntries((weightData || []).map(d => [d.label, d.value]));
    const waMap = Object.fromEntries((waistData || []).map(d => [d.label, d.value]));
    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: allLabels,
        datasets: [
          { label: "Weight (lbs)", data: allLabels.map(l => wMap[l] ?? null), borderColor: "rgba(0,210,180,0.8)", backgroundColor: "transparent", tension: 0.3, pointRadius: 3, borderWidth: 2, yAxisID: "y", spanGaps: true },
          { label: "Waist (in)", data: allLabels.map(l => waMap[l] ?? null), borderColor: "rgba(201,168,76,0.8)", backgroundColor: "transparent", tension: 0.3, pointRadius: 3, borderWidth: 2, yAxisID: "y1", spanGaps: true },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
        plugins: {
          legend: { display: true, labels: { color: T.t3, font: { family: "DM Mono", size: 9 }, boxWidth: 12 } },
          tooltip: { backgroundColor: "rgba(15,17,20,0.95)", borderColor: T.gold, borderWidth: 1, titleFont: { family: "DM Mono" }, bodyFont: { family: "DM Mono" } }
        },
        scales: {
          x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: T.t3, font: { family: "DM Mono", size: 9 }, maxRotation: 0 } },
          y: { type: "linear", position: "left", grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "rgba(0,210,180,0.6)", font: { family: "DM Mono", size: 9 } }, title: { display: true, text: "lbs", color: "rgba(0,210,180,0.4)", font: { family: "DM Mono", size: 9 } } },
          y1: { type: "linear", position: "right", grid: { drawOnChartArea: false }, ticks: { color: "rgba(201,168,76,0.6)", font: { family: "DM Mono", size: 9 } }, title: { display: true, text: "in", color: "rgba(201,168,76,0.4)", font: { family: "DM Mono", size: 9 } } },
        }
      }
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [weightData, waistData, height]);
  return <canvas ref={canvasRef} style={{ width: "100%", height }} />;
}

function BarChartVis({ data, height = 180 }) {
  const canvasRef = useRef(null); const chartRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !data || data.length < 1) return;
    if (chartRef.current) chartRef.current.destroy();
    const colors = data.map(d => { const s = d.value; return s >= 9 ? "rgba(255,215,0,0.7)" : s >= 7 ? "rgba(0,210,180,0.7)" : s >= 5 ? "rgba(201,168,76,0.7)" : "rgba(220,80,80,0.7)"; });
    chartRef.current = new Chart(canvasRef.current, {
      type: "bar", data: { labels: data.map(d => d.label), datasets: [{ data: data.map(d => d.value), backgroundColor: colors, borderRadius: 4, borderSkipped: false }] },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 600 }, plugins: { legend: { display: false }, tooltip: { backgroundColor: "rgba(15,17,20,0.95)", borderColor: T.gold, borderWidth: 1, titleFont: { family: "DM Mono" }, bodyFont: { family: "DM Mono" } } }, scales: { x: { grid: { display: false }, ticks: { color: T.t3, font: { family: "DM Mono", size: 9 } } }, y: { min: 0, max: 10, grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: T.t3, font: { family: "DM Mono", size: 10 } } } } }
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data]);
  return <canvas ref={canvasRef} style={{ width: "100%", height }} />;
}

function AdherenceHeatmap({ logs, stack }) {
  const dailyCompounds = stack.filter(c => c.frequency === "daily").length;
  const days = []; const now = new Date();
  for (let i = 29; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); days.push(d.toISOString().slice(0, 10)); }
  const dayNames = ["S", "M", "T", "W", "T", "F", "S"];
  const firstDayOfWeek = new Date(days[0]).getDay();
  return (
    <div>
      <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>{dayNames.map((d, i) => <div key={i} style={{ width: 14, textAlign: "center", fontSize: 8, color: T.t3, fontFamily: T.fm }}>{d}</div>)}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
        {Array(firstDayOfWeek).fill(null).map((_, i) => <div key={`pad-${i}`} style={{ width: 14, height: 14 }} />)}
        {days.map(d => {
          const count = logs.filter(l => l.date === d).length;
          const isToday = d === getToday();
          const pct = dailyCompounds > 0 ? count / dailyCompounds : 0;
          const bg = pct >= 0.8 ? "rgba(0,210,180,0.7)" : pct > 0 ? "rgba(201,168,76,0.5)" : "rgba(255,255,255,0.04)";
          return <div key={d} style={{ width: 14, height: 14, borderRadius: 3, background: bg, border: isToday ? `1px solid ${T.gold}` : "1px solid transparent", transition: "background .3s" }} title={`${d}: ${count} logged`} />;
        })}
      </div>
    </div>
  );
}

function SubjectiveLineChart({ data, color, label, height = 160 }) {
  const canvasRef = useRef(null); const chartRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !data || data.labels.length < 2) return;
    if (chartRef.current) chartRef.current.destroy();
    const ctx = canvasRef.current.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, color.replace('0.8', '0.2')); grad.addColorStop(1, 'transparent');
    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels: data.labels.map(d => d.slice(5)), datasets: [{ label, data: data.values, borderColor: color, backgroundColor: grad, fill: true, tension: 0.3, pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: color, borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 600 }, plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15,17,20,0.95)', borderColor: T.gold, borderWidth: 1, titleFont: { family: 'DM Mono' }, bodyFont: { family: 'DM Mono' }, padding: 8 } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: T.t3, font: { family: 'DM Mono', size: 9 }, maxRotation: 0 } }, y: { min: 1, max: 10, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: T.t3, font: { family: 'DM Mono', size: 10 }, stepSize: 2 } } } }
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data, color, label, height]);
  return <canvas ref={canvasRef} style={{ width: '100%', height }} />;
}

// ============================================================================
// SUBJECTIVE LOG FORM
// ============================================================================

function SubjectiveLogForm({ metrics, loggedToday, subjective, todayStr, onSubmit }) {
  const [values, setValues] = useState({});
  const [submitted, setSubmitted] = useState(loggedToday);

  // Reset when day changes
  useEffect(() => { setSubmitted(loggedToday); }, [loggedToday]);

  if (submitted) {
    const todayEntry = Array.isArray(subjective) ? subjective.find(s => s.date === todayStr) : null;
    return (
      <div style={{ ...S.card, padding: '12px 14px', borderColor: 'rgba(92,184,112,0.15)', background: 'rgba(92,184,112,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#5cb870', fontSize: 16 }}>{'\u2713'}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#5cb870', fontFamily: T.fb }}>Logged today</span>
          </div>
          {todayEntry && (
            <div style={{ display: 'flex', gap: 10 }}>
              {metrics.map(m => (
                <span key={m.key} style={{ fontSize: 10, color: T.t3, fontFamily: T.fm }}>
                  {m.emoji} {todayEntry[m.key] || '-'}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const handleSubmit = () => {
    const entry = {};
    metrics.forEach(m => { entry[m.key] = values[m.key] || 5; });
    onSubmit(entry);
    setSubmitted(true);
    if (navigator.vibrate) navigator.vibrate(40);
  };

  return (
    <div style={{ ...S.card, padding: '14px', borderColor: T.goldM + '40' }}>
      <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, marginBottom: 12 }}>How are you feeling today?</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {metrics.map(m => {
          const val = values[m.key] || 5;
          return (
            <div key={m.key} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '10px 12px', border: '1px solid ' + T.border }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: T.t2, fontFamily: T.fm }}>{m.emoji} {m.label}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: m.color, fontFamily: T.fm, minWidth: 20, textAlign: 'right' }}>{val}</span>
              </div>
              <input
                type="range" min="1" max="10" step="1" value={val}
                onChange={e => setValues(p => ({ ...p, [m.key]: parseInt(e.target.value) }))}
                style={{
                  width: '100%', height: 4, appearance: 'none', WebkitAppearance: 'none',
                  background: `linear-gradient(to right, ${m.color} ${(val - 1) / 9 * 100}%, rgba(255,255,255,0.06) ${(val - 1) / 9 * 100}%)`,
                  borderRadius: 2, outline: 'none', cursor: 'pointer',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 8, color: T.t3, fontFamily: T.fm }}>Low</span>
                <span style={{ fontSize: 8, color: T.t3, fontFamily: T.fm }}>High</span>
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={handleSubmit} style={{ ...S.logBtn, width: '100%', padding: '10px', textAlign: 'center', marginTop: 12, fontSize: 12, fontWeight: 600 }}>
        Log Today's Check-in
      </button>
    </div>
  );
}

const SUB_METRICS = [
  { key: 'energy', label: 'Energy', emoji: '\u26A1', color: T.teal },
  { key: 'focus', label: 'Focus', emoji: '\uD83C\uDFAF', color: T.purple || 'rgba(160,120,220,0.8)' },
  { key: 'hunger', label: 'Hunger', emoji: '\uD83C\uDF7D', color: 'rgba(230,184,79,0.8)' },
  { key: 'mood', label: 'Mood', emoji: '\u2728', color: T.gold },
];

function SubjectiveSection({ subjective, setSubjective, getSubjectiveChartData }) {
  const todayStr = getToday();
  const loggedToday = Array.isArray(subjective) && subjective.some(s => s.date === todayStr);
  const subChartData = getSubjectiveChartData ? getSubjectiveChartData(subjective || [], 30) : { labels: [], energy: [], focus: [], hunger: [], mood: [] };
  const hasSubData = subChartData.labels.length >= 2;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 8 }}>
        <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg, transparent, ${T.goldM})` }} />
        <span style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm }}>SUBJECTIVE</span>
        <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg, ${T.goldM}, transparent)` }} />
      </div>
      <SubjectiveLogForm
        metrics={SUB_METRICS}
        loggedToday={loggedToday}
        subjective={subjective}
        todayStr={todayStr}
        onSubmit={(entry) => {
          if (setSubjective) {
            const updated = logSubjective(subjective, { ...entry, date: todayStr });
            setSubjective(updated);
          }
        }}
      />
      {hasSubData && (
        <div style={{ marginTop: 10 }}>
          {SUB_METRICS.map(m => (
            <ChartCard key={m.key} title={m.label} rightLabel={subChartData[m.key].length ? `${subChartData[m.key][subChartData[m.key].length - 1]}/10` : ''} height={140}>
              <SubjectiveLineChart data={{ labels: subChartData.labels, values: subChartData[m.key] }} color={m.color} label={m.label} height={140} />
            </ChartCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MetricsTab({ checkins: rawCheckins, logs, stack, subjective, setSubjective, detectMilestones, calculateTrajectory, generateWeeklySummary, getAdherenceStats, getSubjectiveChartData, profile, labResults, setLabResults, isPro, onUpgrade }) {
  const checkins = rawCheckins || [];
  const results = labResults || [];
  const sex = profile?.biologicalSex || 'male';

  const [sv, setSv] = useState('charts');
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Labs state - all hooks top-level
  const [labView, setLabView] = useState('list');
  const [selectedLabId, setSelectedLabId] = useState(null);
  const [addTab, setAddTab] = useState('camera');
  const [rawLabText, setRawLabText] = useState('');
  const [pendingMarkers, setPendingMarkers] = useState({});
  const [labDate, setLabDate] = useState(getToday());
  const [labLabel, setLabLabel] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [checklistDismissed, setChecklistDismissed] = useState(false);
  const [showMoreManual, setShowMoreManual] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [loadingText, setLoadingText] = useState('Analyzing...');
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  useEffect(() => {
    if (!analyzing) return;
    const phases = ['Reading markers...', 'Consulting protocol...', 'Connecting patterns...', 'Drafting insights...'];
    let i = 0;
    setLoadingText(phases[0]);
    const iv = setInterval(() => { i = (i + 1) % phases.length; setLoadingText(phases[i]); }, 2000);
    return () => clearInterval(iv);
  }, [analyzing]);

  const segBar = <div style={{ ...S.segWrap, marginBottom: 16 }}>{[{ k: 'charts', l: 'Charts' }, { k: 'insights', l: 'Insights' }, { k: 'labs', l: 'Labs' }].map(s => <button key={s.k} onClick={() => setSv(s.k)} style={{ ...S.segBtn, fontSize: 12, padding: '7px 0', ...(sv === s.k ? S.segOn : {}) }}>{s.l}</button>)}</div>;

  const normalizedLogs = (logs || []).map(l => l.compoundId ? l : { ...l, compoundId: l.cid });

  // ============================================================================
  // LABS HELPERS (inner)
  // ============================================================================

  const getChecklistMarkers = () => {
    const base = new Set(['CBC', 'CMP', 'Lipid Panel', 'Vitamin D', 'HbA1c']);
    const stackStr = (stack || []).map(c => (c.name || '').toLowerCase() + ' ' + (c.id || '').toLowerCase()).join(' ');
    if (/cjc|ipamorelin|tesamorelin|mk-?677|sermorelin|ghrp|hexarelin/.test(stackStr)) { base.add('IGF-1'); base.add('Glucose'); }
    if (/semaglutide|tirzepatide|retatrutide|liraglutide|glp/.test(stackStr)) { base.add('Glucose'); base.add('HbA1c'); base.add('Lipid Panel'); base.add('ALT'); base.add('AST'); }
    if (/test.?cyp|test.?enth|testosterone|hcg/.test(stackStr)) { base.add('Total T'); base.add('Free T'); base.add('SHBG'); base.add('Estradiol'); base.add('Hematocrit'); base.add('PSA'); base.add('LH'); base.add('FSH'); }
    if (/kisspeptin|gonadorelin|enclomiphene/.test(stackStr)) { base.add('LH'); base.add('FSH'); base.add('Total T'); base.add('Estradiol'); }
    if (/anastrozole|arimidex/.test(stackStr)) { base.add('Estradiol'); }
    if (/ss.?31|mots.?c/.test(stackStr)) { base.add('Glucose'); base.add('Creatinine'); base.add('eGFR'); }
    return Array.from(base);
  };

  const handleImageUpload = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingImage(true);
    setAnalysisError(null);
    try {
      const base64 = await compressImage(file);
      const extracted = await extractFromImage(base64);
      if (extracted.date) setLabDate(extracted.date);
      const merged = { ...pendingMarkers };
      Object.keys(extracted).forEach(k => { if (k !== 'date' && extracted[k] != null) merged[k] = extracted[k]; });
      setPendingMarkers(merged);
    } catch (err) {
      setAnalysisError('Could not extract values from image: ' + (err.message || 'unknown error'));
    }
    setLoadingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePDFUpload = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingPDF(true);
    setAnalysisError(null);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const extracted = await extractFromPDF(base64);
      if (extracted.date) setLabDate(extracted.date);
      if (extracted.label) setLabLabel(extracted.label);
      const merged = { ...pendingMarkers };
      Object.keys(extracted).forEach(k => { if (k !== 'date' && k !== 'label' && extracted[k] != null) merged[k] = extracted[k]; });
      setPendingMarkers(merged);
    } catch (err) {
      setAnalysisError('Could not extract values from PDF: ' + (err.message || 'unknown error'));
    }
    setLoadingPDF(false);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const handleParseText = () => {
    if (!rawLabText.trim()) return;
    try {
      const parsed = parseLabText(rawLabText);
      const date = extractLabDate(rawLabText);
      if (date) setLabDate(date);
      setPendingMarkers({ ...pendingMarkers, ...parsed });
    } catch (err) {
      setAnalysisError('Could not parse text: ' + (err.message || 'unknown error'));
    }
  };

  const resetAddForm = () => {
    setRawLabText('');
    setPendingMarkers({});
    setLabDate(getToday());
    setLabLabel('');
    setAnalysisError(null);
    setAddTab('camera');
    setShowMoreManual(false);
  };

  const handleSaveLab = async (runAnalysis) => {
    const cleanMarkers = {};
    Object.keys(pendingMarkers).forEach(k => {
      const v = pendingMarkers[k];
      if (v != null && v !== '' && !isNaN(Number(v))) cleanMarkers[k] = Number(v);
    });
    if (Object.keys(cleanMarkers).length === 0) {
      setAnalysisError('Add at least one marker value before saving.');
      return;
    }
    const newResult = {
      id: makeId(),
      date: labDate || getToday(),
      uploadDate: new Date().toISOString(),
      label: labLabel || 'Lab Results',
      rawText: rawLabText,
      parsedMarkers: cleanMarkers,
      interpretation: null,
      interpretationDate: null,
    };
    setLabResults(prev => [...(prev || []), newResult]);
    setLabView('list');
    resetAddForm();
    if (runAnalysis) {
      setAnalyzing(true);
      setAnalyzingId(newResult.id);
      const res = await runBloodworkAnalysis(newResult, stack, results, setLabResults, profile);
      setAnalyzing(false);
      setAnalyzingId(null);
      if (!res.success) setAnalysisError(res.error);
    }
  };

  const handleAnalyzeExisting = async (result) => {
    setAnalyzing(true);
    setAnalyzingId(result.id);
    setAnalysisError(null);
    const res = await runBloodworkAnalysis(result, stack, results, setLabResults, profile);
    setAnalyzing(false);
    setAnalyzingId(null);
    if (!res.success) setAnalysisError(res.error);
  };

  // ── Insights view: Adherence dashboard ──
  if (sv === 'insights') {
    const stats = getAdherenceStats ? getAdherenceStats(normalizedLogs, stack, 30) : { overallPct: 0, byCompound: [], currentStreak: 0, longestStreak: 0, bestDay: null, worstDay: null };
    const hasCompounds = stats.byCompound.length > 0;

    return (
      <div style={{ animation: 'fadeUp .5s ease both' }}>
        <header style={{ ...S.header, marginBottom: 14 }}><h1 style={{ ...S.brand, fontSize: 20 }}>METRICS</h1><p style={S.sub}>Adherence Dashboard</p></header>
        {segBar}
        {!hasCompounds ? (
          <div style={{ textAlign: 'center', padding: '60px 20px 40px' }}>
            <div style={{ width: 48, height: 48, margin: '0 auto 20px', borderRadius: '50%', border: `1px solid ${T.goldM}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SamsaraSymbol size={24} /></div>
            <p style={{ fontFamily: T.fd, fontSize: 22, fontWeight: 300, color: T.t2, letterSpacing: 1, lineHeight: 1.3 }}>Consistency reveals itself</p>
            <p style={{ fontFamily: T.fm, fontSize: 11, color: T.t3, marginTop: 10, lineHeight: 1.6, letterSpacing: 0.5 }}>Add compounds and log doses.{'\n'}Adherence patterns will appear here.</p>
          </div>
        ) : (
          <div>
            <div style={{ ...S.card, padding: 20, marginBottom: 13, textAlign: 'center' }}>
              <span style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>OVERALL ADHERENCE (30D)</span>
              <div style={{ fontSize: 48, fontWeight: 700, fontFamily: T.fm, color: stats.overallPct >= 80 ? T.teal : stats.overallPct >= 50 ? T.gold : T.red, marginTop: 8, lineHeight: 1 }}>{stats.overallPct}%</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 13 }}>
              <div style={{ ...S.card, flex: 1, padding: 14, textAlign: 'center' }}>
                <span style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>CURRENT STREAK</span>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: T.fm, color: T.t1, marginTop: 6, lineHeight: 1 }}>{stats.currentStreak}<span style={{ fontSize: 11, color: T.t3, fontWeight: 400 }}> days</span></div>
              </div>
              <div style={{ ...S.card, flex: 1, padding: 14, textAlign: 'center' }}>
                <span style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>LONGEST STREAK</span>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: T.fm, color: T.t1, marginTop: 6, lineHeight: 1 }}>{stats.longestStreak}<span style={{ fontSize: 11, color: T.t3, fontWeight: 400 }}> days</span></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 13 }}>
              <div style={{ ...S.card, flex: 1, padding: 14, textAlign: 'center' }}>
                <span style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>BEST DAY</span>
                <div style={{ fontSize: 18, fontWeight: 600, fontFamily: T.fm, color: T.green, marginTop: 6 }}>{stats.bestDay || '--'}</div>
              </div>
              <div style={{ ...S.card, flex: 1, padding: 14, textAlign: 'center' }}>
                <span style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm }}>WORST DAY</span>
                <div style={{ fontSize: 18, fontWeight: 600, fontFamily: T.fm, color: T.red, marginTop: 6 }}>{stats.worstDay || '--'}</div>
              </div>
            </div>
            <div style={{ ...S.card, padding: 14, marginBottom: 13 }}>
              <span style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, display: 'block', marginBottom: 12 }}>PER-COMPOUND</span>
              {stats.byCompound.map((c, i) => (
                <div key={i} style={{ marginBottom: i < stats.byCompound.length - 1 ? 10 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontFamily: T.fm, color: T.t2 }}>{c.name}</span>
                    <span style={{ fontSize: 11, fontFamily: T.fm, color: c.pct >= 80 ? T.teal : c.pct >= 50 ? T.gold : T.red }}>{c.pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: c.pct + '%', borderRadius: 3, background: c.pct >= 80 ? T.teal : c.pct >= 50 ? T.gold : T.red, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Weekly AI Summary */}
            {isPro ? (
            <div style={{ ...S.card, padding: 14, marginBottom: 13, border: `1px solid ${T.goldM}`, background: 'rgba(201,168,76,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: weeklySummary ? 10 : 0 }}>
                <span style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm }}>WEEKLY SUMMARY</span>
                <button onClick={async () => {
                  if (loadingSummary) return;
                  setLoadingSummary(true);
                  try {
                    const adherence = getAdherenceStats ? getAdherenceStats((logs || []).map(l => l.compoundId ? l : { ...l, compoundId: l.cid }), stack, 30) : null;
                    const result = await generateWeeklySummary(logs, checkins, stack, { subjective, labResults: labResults || [], profile, adherenceStats: adherence });
                    setWeeklySummary(result);
                  } catch { setWeeklySummary({ summary: 'Could not generate summary. Check your connection.', date: new Date().toISOString() }); }
                  setLoadingSummary(false);
                }} disabled={loadingSummary} style={{ ...S.pill, fontSize: 9, padding: '3px 10px', borderColor: T.goldM, color: T.gold, opacity: loadingSummary ? 0.5 : 1 }}>
                  {loadingSummary ? 'Analyzing...' : weeklySummary ? 'Refresh' : 'Generate'}
                </button>
              </div>
              {loadingSummary && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <Enso size={24} />
                  <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginTop: 8 }}>Analyzing your week...</div>
                </div>
              )}
              {weeklySummary && !loadingSummary && (
                <div style={{ fontSize: 12, color: T.t2, fontFamily: T.fm, lineHeight: 1.7 }}>{weeklySummary.summary}</div>
              )}
              {!weeklySummary && !loadingSummary && (
                <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginTop: 6 }}>AI-powered weekly coaching based on your logs, check-ins, and protocol.</div>
              )}
            </div>
            ) : (
            <ProLock onUpgrade={onUpgrade} label="Weekly AI Summary">
              <div style={{ ...S.card, padding: 14, marginBottom: 13, border: `1px solid ${T.goldM}`, background: 'rgba(201,168,76,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm }}>WEEKLY SUMMARY <ProBadge /></span>
                  <span style={{ ...S.pill, fontSize: 9, padding: '4px 12px', borderColor: T.goldM, color: T.gold, borderRadius: 6 }}>Generate</span>
                </div>
                <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, marginTop: 8, lineHeight: 1.5 }}>AI-powered weekly coaching based on your logs, check-ins, and protocol.</div>
              </div>
            </ProLock>
            )}

            {/* Dose timing suggestions based on subjective data */}
            {(() => {
              const sub = Array.isArray(subjective) ? subjective.slice(-14) : [];
              if (sub.length < 3) return null;
              const suggestions = [];
              const avgEnergy = sub.reduce((s, e) => s + (e.energy || 5), 0) / sub.length;
              const avgSleep = sub.reduce((s, e) => s + (e.mood || 5), 0) / sub.length;
              const avgHunger = sub.reduce((s, e) => s + (e.hunger || 5), 0) / sub.length;
              // Check for GH secretagogues + poor sleep
              const hasGHSS = stack.some(c => c.category === 'GH Secretagogue');
              if (hasGHSS && avgSleep < 5) suggestions.push({ icon: '\uD83C\uDF19', text: 'Low mood/sleep scores detected. Try dosing GH secretagogues 30 min before bed on an empty stomach for better GH release.' });
              // Low energy with stack
              if (avgEnergy < 4.5) suggestions.push({ icon: '\u26A1', text: 'Energy is trending low. Consider timing stimulating peptides (like CJC-1295) to morning hours and ensure adequate recovery.' });
              // High hunger with GLP-1
              const hasGLP1 = stack.some(c => c.category === 'GLP-1 / Metabolic');
              if (hasGLP1 && avgHunger > 6) suggestions.push({ icon: '\uD83C\uDF7D', text: 'Hunger scores remain high despite GLP-1 agonist. Consider gradual dose escalation per your protocol.' });
              // Good adherence celebration
              if (stats.overallPct >= 90 && avgEnergy >= 6) suggestions.push({ icon: '\u2728', text: 'Excellent adherence and strong subjective scores. Your protocol appears well-dialed.' });
              if (suggestions.length === 0) return null;
              return (
                <div style={{ ...S.card, padding: 14, marginBottom: 13, borderLeft: `3px solid ${T.teal}` }}>
                  <span style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: T.teal, fontFamily: T.fm, display: 'block', marginBottom: 10 }}>SMART SUGGESTIONS</span>
                  {suggestions.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < suggestions.length - 1 ? 10 : 0, padding: '4px 0' }}>
                      <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: 'center' }}>{s.icon}</span>
                      <span style={{ fontSize: 11, color: T.t2, fontFamily: T.fm, lineHeight: 1.6 }}>{s.text}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  }

  // ── Labs view ──
  if (sv === 'labs') {
    if (!isPro) {
      return (
        <div style={{ animation: 'fadeUp .5s ease both' }}>
          <header style={{ ...S.header, marginBottom: 14 }}><h1 style={{ ...S.brand, fontSize: 20 }}>METRICS</h1><p style={S.sub}>Lab Results <ProBadge /></p></header>
          {segBar}
          <ProLock onUpgrade={onUpgrade} label="Lab Results">
            <div style={{ textAlign: 'center', padding: '50px 20px 40px' }}>
              <div style={{ width: 56, height: 56, margin: '0 auto 20px', borderRadius: '50%', border: `1px solid ${T.goldM}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Enso size={28} /></div>
              <p style={{ fontFamily: T.fd, fontSize: 22, fontWeight: 300, color: T.t2, letterSpacing: 1, lineHeight: 1.3, padding: '0 20px' }}>Your bloodwork tells the story your mirror cannot.</p>
              <p style={{ fontFamily: T.fm, fontSize: 11, color: T.t3, marginTop: 12, lineHeight: 1.6, letterSpacing: 0.5, padding: '0 30px' }}>Add lab results to see how your protocol is landing in the body and what your markers reveal.</p>
              <button style={{ ...S.logBtn, marginTop: 24 }}>Add Lab Results</button>
            </div>
          </ProLock>
        </div>
      );
    }

    const sortedResults = [...results].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const selected = sortedResults.find(r => r.id === selectedLabId);

    // -------- LABS: DETAIL VIEW --------
    if (labView === 'detail' && selected) {
      const interp = selected.interpretation;
      const insightsByMarker = {};
      if (interp?.markerInsights) {
        interp.markerInsights.forEach(mi => { insightsByMarker[mi.marker] = mi; });
      }
      const prevResults = sortedResults.filter(r => r.id !== selected.id && r.date < selected.date).sort((a, b) => b.date.localeCompare(a.date));
      const getPrevValue = (key) => {
        const prev = prevResults.find(r => r.parsedMarkers && r.parsedMarkers[key] != null);
        return prev ? prev.parsedMarkers[key] : null;
      };

      return (
        <div style={{ animation: 'fadeUp .5s ease both' }}>
          <header style={{ ...S.header, marginBottom: 14 }}><h1 style={{ ...S.brand, fontSize: 20 }}>METRICS</h1><p style={S.sub}>Lab Results</p></header>
          {segBar}
          <button onClick={() => { setLabView('list'); setSelectedLabId(null); }} style={{ background: 'none', border: 'none', color: T.gold, fontFamily: T.fm, fontSize: 11, cursor: 'pointer', marginBottom: 10, padding: 0 }}>{'\u2190'} Labs</button>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: T.fd, fontSize: 22, color: T.t1, fontWeight: 300 }}>{selected.label || 'Lab Results'}</div>
            <div style={{ fontFamily: T.fm, fontSize: 10, color: T.t3, letterSpacing: 1, textTransform: 'uppercase' }}>{selected.date}</div>
          </div>

          {interp && (
            <div style={{ ...S.card, padding: 14, marginBottom: 10, borderLeft: `3px solid ${getStatusColor(interp.overallAssessment)}` }}>
              <div style={{ fontFamily: T.fd, fontSize: 18, color: T.t1, fontWeight: 300, lineHeight: 1.3 }}>{interp.headline}</div>
              {interp.protocolStory && <div style={{ fontFamily: T.fb, fontSize: 12, color: T.t2, marginTop: 8, lineHeight: 1.5 }}>{interp.protocolStory}</div>}
            </div>
          )}

          {/* Marker sections */}
          {Object.entries(MARKER_SECTIONS).map(([section, keys]) => {
            const visible = keys.filter(k => selected.parsedMarkers && selected.parsedMarkers[k] != null);
            if (visible.length === 0) return null;
            return (
              <div key={section} style={{ ...S.card, padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm, marginBottom: 12 }}>{section}</div>
                {visible.map(key => {
                  const value = selected.parsedMarkers[key];
                  const r = REFERENCE_RANGES[key]?.[sex] || REFERENCE_RANGES[key]?.both;
                  const unit = r?.unit || '';
                  const status = getMarkerStatus(key, value, sex);
                  const color = getStatusColor(status);
                  let pct = 50;
                  if (r) {
                    const min = r.low * 0.5;
                    const max = r.high < 900 ? r.high * 1.5 : r.optimal * 2;
                    const span = max - min || 1;
                    pct = Math.max(0, Math.min(100, ((Number(value) - min) / span) * 100));
                  }
                  const prevV = getPrevValue(key);
                  let trend = null;
                  if (prevV != null && Number(prevV) !== 0) {
                    const delta = (Number(value) - Number(prevV)) / Number(prevV);
                    if (Math.abs(delta) < 0.05) trend = { arrow: '\u2192', color: T.t3 };
                    else if (delta > 0) trend = { arrow: '\u2191', color: '#5cb870' };
                    else trend = { arrow: '\u2193', color: 'rgba(220,80,80,0.8)' };
                  }
                  const mi = insightsByMarker[key] || insightsByMarker[MARKER_LABELS[key]];
                  return (
                    <div key={key} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontFamily: T.fm, color: T.t2 }}>{MARKER_LABELS[key] || key}</span>
                        <span style={{ fontSize: 14, fontFamily: T.fm, fontWeight: 600, color: T.t1 }}>
                          {value} <span style={{ fontSize: 10, color: T.t3, fontWeight: 400 }}>{unit}</span>
                          {trend && <span style={{ marginLeft: 6, color: trend.color, fontSize: 12 }}>{trend.arrow}</span>}
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, position: 'relative', background: 'linear-gradient(90deg, rgba(220,80,80,0.3) 0%, rgba(220,80,80,0.2) 15%, rgba(92,184,112,0.4) 40%, rgba(92,184,112,0.4) 60%, rgba(220,80,80,0.2) 85%, rgba(220,80,80,0.3) 100%)' }}>
                        <div style={{ position: 'absolute', left: `${pct}%`, top: -2, width: 10, height: 10, borderRadius: '50%', background: color, border: '2px solid #0f1114', transform: 'translateX(-50%)' }} />
                      </div>
                      {mi?.protocolContext && <div style={{ fontSize: 10, fontFamily: T.fb, color: T.t3, marginTop: 6, fontStyle: 'italic', lineHeight: 1.4 }}>{mi.protocolContext}</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Key findings */}
          {interp?.keyFindings && interp.keyFindings.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm, marginBottom: 8 }}>KEY FINDINGS</div>
              {[...interp.keyFindings].sort((a, b) => { const o = { urgent: 0, caution: 1, info: 2 }; return (o[a.severity] ?? 3) - (o[b.severity] ?? 3); }).map((f, i) => (
                <div key={i} style={{ ...S.card, padding: 12, marginBottom: 6, borderLeft: `3px solid ${getStatusColor(f.severity === 'urgent' ? 'urgent' : f.severity === 'caution' ? 'monitor' : 'ok')}` }}>
                  <div style={{ fontFamily: T.fm, fontSize: 12, color: T.t1, fontWeight: 600, marginBottom: 4 }}>{f.finding}</div>
                  <div style={{ fontFamily: T.fb, fontSize: 11, color: T.t2, lineHeight: 1.4 }}>{f.detail}</div>
                  {f.relatedCompounds && f.relatedCompounds.length > 0 && <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>{f.relatedCompounds.map((c, j) => <span key={j} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'rgba(201,168,76,0.1)', color: T.gold, fontFamily: T.fm }}>{c}</span>)}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {interp?.summary && (
            <div style={{ ...S.card, padding: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm, marginBottom: 8, borderBottom: `1px solid ${T.goldM || 'rgba(201,168,76,0.3)'}`, paddingBottom: 6 }}>SUMMARY</div>
              {interp.summary.split('\n\n').map((p, i) => <p key={i} style={{ fontFamily: T.fb, fontSize: 12, color: T.t2, lineHeight: 1.6, marginBottom: 10 }}>{p}</p>)}
            </div>
          )}

          {/* Questions for doctor */}
          {interp?.questionsForDoctor && interp.questionsForDoctor.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm, marginBottom: 8 }}>QUESTIONS FOR YOUR DOCTOR</div>
              {interp.questionsForDoctor.map((q, i) => (
                <div key={i} style={{ ...S.card, padding: 12, marginBottom: 6, borderLeft: `3px solid ${T.gold}` }}>
                  <div style={{ fontFamily: T.fm, fontSize: 12, color: T.t1, marginBottom: 4 }}>{q.question}</div>
                  <div style={{ fontFamily: T.fb, fontSize: 10, color: T.t3, fontStyle: 'italic' }}>{q.why}</div>
                </div>
              ))}
            </div>
          )}

          {/* Next labs */}
          {interp?.nextLabRecommendation && (
            <div style={{ ...S.card, padding: 14, marginBottom: 10, border: '1px solid ' + (T.goldM || 'rgba(201,168,76,0.3)') }}>
              <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm, marginBottom: 6 }}>NEXT LABS</div>
              <div style={{ fontFamily: T.fm, fontSize: 12, color: T.t1, marginBottom: 4 }}>{interp.nextLabRecommendation.timing}</div>
              <div style={{ fontFamily: T.fb, fontSize: 11, color: T.t2, marginBottom: 6 }}>{interp.nextLabRecommendation.reason}</div>
              {interp.nextLabRecommendation.priorityMarkers && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{interp.nextLabRecommendation.priorityMarkers.map((m, i) => <span key={i} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'rgba(201,168,76,0.1)', color: T.gold, fontFamily: T.fm }}>{m}</span>)}</div>
              )}
            </div>
          )}

          {!interp && (
            <button onClick={() => handleAnalyzeExisting(selected)} disabled={analyzing} style={{ ...S.logBtn, width: '100%', marginBottom: 10 }}>
              {analyzing && analyzingId === selected.id ? loadingText : 'Analyze Results'}
            </button>
          )}
          {analysisError && <div style={{ fontSize: 11, color: 'rgba(220,80,80,0.9)', fontFamily: T.fm, marginBottom: 10, textAlign: 'center' }}>{analysisError}</div>}

          <div style={{ fontSize: 10, fontFamily: T.fb, fontStyle: 'italic', color: T.t3, textAlign: 'center', marginTop: 20, lineHeight: 1.5, padding: '0 10px' }}>
            Samsara provides educational context only. This is not medical advice. Always consult a qualified healthcare provider before making any changes to your protocol.
          </div>
        </div>
      );
    }

    // -------- LABS: ADD VIEW --------
    if (labView === 'add') {
      const hasExtracted = Object.keys(pendingMarkers).length > 0;
      const commonKeys = ['totalTestosterone', 'freeTestosterone', 'lh', 'fsh', 'estradiol', 'igf1', 'tsh', 'glucose', 'hba1c', 'totalCholesterol', 'ldl', 'hdl', 'triglycerides', 'hematocrit', 'ast', 'alt', 'vitaminD', 'cortisol', 'creatinine'];
      if (sex === 'male') commonKeys.push('psa');
      const allKeys = Object.keys(MARKER_LABELS);
      const otherKeys = allKeys.filter(k => !commonKeys.includes(k));

      const setMarker = (k, v) => setPendingMarkers({ ...pendingMarkers, [k]: v });

      const renderMarkerRow = (key) => {
        const v = pendingMarkers[key];
        const r = REFERENCE_RANGES[key]?.[sex] || REFERENCE_RANGES[key]?.both;
        const unit = r?.unit || '';
        const status = getMarkerStatus(key, v, sex);
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, fontSize: 11, fontFamily: T.fm, color: T.t2 }}>{MARKER_LABELS[key]}</div>
            <input
              type="number"
              step="0.01"
              value={v ?? ''}
              onChange={e => setMarker(key, e.target.value)}
              placeholder=""
              style={{ width: 80, padding: '6px 8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: T.t1, fontFamily: T.fm, fontSize: 12 }}
            />
            <div style={{ width: 50, fontSize: 9, color: T.t3, fontFamily: T.fm }}>{unit}</div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: v != null && v !== '' ? getStatusColor(status) : 'rgba(255,255,255,0.1)' }} />
          </div>
        );
      };

      return (
        <div style={{ animation: 'fadeUp .5s ease both' }}>
          <header style={{ ...S.header, marginBottom: 14 }}><h1 style={{ ...S.brand, fontSize: 20 }}>METRICS</h1><p style={S.sub}>Add Lab Results</p></header>
          {segBar}
          <button onClick={() => { setLabView('list'); resetAddForm(); }} style={{ background: 'none', border: 'none', color: T.gold, fontFamily: T.fm, fontSize: 11, cursor: 'pointer', marginBottom: 10, padding: 0 }}>{'\u2190'} Cancel</button>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 6 }}>
            <button onClick={() => setAddTab('camera')} style={{ flex: 1, padding: '8px 10px', background: addTab === 'camera' ? 'rgba(201,168,76,0.15)' : 'transparent', border: 'none', color: addTab === 'camera' ? T.gold : T.t3, fontFamily: T.fm, fontSize: 11, borderRadius: 4, cursor: 'pointer' }}>Camera / Text</button>
            <button onClick={() => setAddTab('manual')} style={{ flex: 1, padding: '8px 10px', background: addTab === 'manual' ? 'rgba(201,168,76,0.15)' : 'transparent', border: 'none', color: addTab === 'manual' ? T.gold : T.t3, fontFamily: T.fm, fontSize: 11, borderRadius: 4, cursor: 'pointer' }}>Manual Entry</button>
          </div>

          {addTab === 'camera' && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fb, marginBottom: 10, lineHeight: 1.5 }}>
                Upload a PDF, snap a photo, or paste text from your lab report. Samsara will extract the values automatically.
              </div>
              <input ref={pdfInputRef} type="file" accept="application/pdf" onChange={handlePDFUpload} style={{ display: 'none' }} />
              <button onClick={() => pdfInputRef.current?.click()} disabled={loadingPDF} style={{ ...S.logBtn, width: '100%', marginBottom: 8 }}>
                {loadingPDF ? 'Reading PDF...' : 'Upload PDF'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageUpload} style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current?.click()} disabled={loadingImage} style={{ ...S.newVialBtn, width: '100%', marginBottom: 10 }}>
                {loadingImage ? 'Reading image...' : 'Use Camera'}
              </button>
              <textarea
                value={rawLabText}
                onChange={e => setRawLabText(e.target.value)}
                placeholder=""
                style={{ width: '100%', height: 160, padding: 10, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: T.t1, fontFamily: T.fm, fontSize: 11, resize: 'vertical', boxSizing: 'border-box' }}
              />
              <button onClick={handleParseText} style={{ ...S.newVialBtn, width: '100%', marginTop: 8 }}>Extract Values</button>
            </div>
          )}

          {hasExtracted && (
            <div style={{ fontSize: 11, fontFamily: T.fm, color: '#5cb870', marginBottom: 10, textAlign: 'center' }}>
              {Object.keys(pendingMarkers).filter(k => pendingMarkers[k] != null && pendingMarkers[k] !== '').length} values found
            </div>
          )}

          {/* Review / manual entry form */}
          {(addTab === 'manual' || hasExtracted) && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, marginBottom: 4, letterSpacing: 1 }}>DATE</div>
                  <input type="date" value={labDate} onChange={e => setLabDate(e.target.value)} style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: T.t1, fontFamily: T.fm, fontSize: 12, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, marginBottom: 4, letterSpacing: 1 }}>REPORT NAME</div>
                  <input type="text" value={labLabel} onChange={e => setLabLabel(e.target.value)} placeholder="" style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: T.t1, fontFamily: T.fm, fontSize: 12, boxSizing: 'border-box' }} />
                </div>
              </div>

              {addTab === 'manual' ? (
                <>
                  {Object.entries(MARKER_SECTIONS).map(([section, keys]) => {
                    const vis = keys.filter(k => showMoreManual || commonKeys.includes(k));
                    if (vis.length === 0) return null;
                    return (
                      <div key={section} style={{ ...S.card, padding: 12, marginBottom: 10 }}>
                        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm, marginBottom: 10 }}>{section}</div>
                        {vis.map(renderMarkerRow)}
                      </div>
                    );
                  })}
                  <button onClick={() => setShowMoreManual(!showMoreManual)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: T.t3, fontFamily: T.fm, fontSize: 10, padding: '8px', borderRadius: 4, width: '100%', marginBottom: 10, cursor: 'pointer' }}>
                    {showMoreManual ? 'Show Less' : 'Show More Markers'}
                  </button>
                </>
              ) : (
                Object.entries(MARKER_SECTIONS).map(([section, keys]) => {
                  const vis = keys.filter(k => pendingMarkers[k] != null && pendingMarkers[k] !== '');
                  if (vis.length === 0) return null;
                  return (
                    <div key={section} style={{ ...S.card, padding: 12, marginBottom: 10 }}>
                      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm, marginBottom: 10 }}>{section}</div>
                      {vis.map(renderMarkerRow)}
                    </div>
                  );
                })
              )}

              {analysisError && <div style={{ fontSize: 11, color: 'rgba(220,80,80,0.9)', fontFamily: T.fm, marginBottom: 10, textAlign: 'center' }}>{analysisError}</div>}

              <button onClick={() => handleSaveLab(true)} disabled={analyzing} style={{ ...S.logBtn, width: '100%', marginBottom: 8 }}>
                {analyzing ? loadingText : 'Save & Analyze'}
              </button>
              <button onClick={() => handleSaveLab(false)} style={{ ...S.newVialBtn, width: '100%' }}>Save Only</button>
            </div>
          )}
        </div>
      );
    }

    // -------- LABS: LIST VIEW --------
    if (results.length === 0) {
      return (
        <div style={{ animation: 'fadeUp .5s ease both' }}>
          <header style={{ ...S.header, marginBottom: 14 }}><h1 style={{ ...S.brand, fontSize: 20 }}>METRICS</h1><p style={S.sub}>Lab Results</p></header>
          {segBar}
          <div style={{ textAlign: 'center', padding: '50px 20px 40px' }}>
            <div style={{ width: 56, height: 56, margin: '0 auto 20px', borderRadius: '50%', border: `1px solid ${T.goldM}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Enso size={28} /></div>
            <p style={{ fontFamily: T.fd, fontSize: 22, fontWeight: 300, color: T.t2, letterSpacing: 1, lineHeight: 1.3, padding: '0 20px' }}>Your bloodwork tells the story your mirror cannot.</p>
            <p style={{ fontFamily: T.fm, fontSize: 11, color: T.t3, marginTop: 12, lineHeight: 1.6, letterSpacing: 0.5, padding: '0 30px' }}>Add lab results to see how your protocol is landing{'\n'}in the body and what your markers reveal.</p>
            <button onClick={() => setLabView('add')} style={{ ...S.logBtn, marginTop: 24 }}>Add Lab Results</button>
          </div>
        </div>
      );
    }

    const checklist = getChecklistMarkers();
    const priorityMarkers = ['totalTestosterone', 'igf1', 'estradiol', 'hematocrit', 'glucose', 'lh', 'hba1c', 'vitaminD', 'ast'];
    const trendMarkers = priorityMarkers.filter(k => sortedResults.filter(r => r.parsedMarkers && r.parsedMarkers[k] != null).length >= 2);

    return (
      <div style={{ animation: 'fadeUp .5s ease both' }}>
        <header style={{ ...S.header, marginBottom: 14 }}><h1 style={{ ...S.brand, fontSize: 20 }}>METRICS</h1><p style={S.sub}>Lab Results</p></header>
        {segBar}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 }}>
          <div style={{ fontFamily: T.fd, fontSize: 18, color: T.t1, fontWeight: 300, letterSpacing: 0.5 }}>Lab Results</div>
          <button onClick={() => setLabView('add')} style={{ background: T.goldS, border: `1px solid ${T.goldM}`, color: T.gold, fontFamily: T.fm, fontSize: 11, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', letterSpacing: 0.5 }}>+ Add</button>
        </div>

        {!checklistDismissed && (
          <div style={{ ...S.card, padding: 14, marginBottom: 13, border: `1px solid ${T.goldM}`, background: 'rgba(201,168,76,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm }}>RECOMMENDED MARKERS</div>
              <button onClick={() => setChecklistDismissed(true)} style={{ background: 'none', border: 'none', color: T.t3, fontSize: 14, cursor: 'pointer', padding: 0, lineHeight: 1 }}>{'\u00D7'}</button>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {checklist.map((m, i) => <span key={i} style={{ fontSize: 9, padding: '3px 8px', borderRadius: 3, background: 'rgba(201,168,76,0.1)', color: T.gold, fontFamily: T.fm }}>{m}</span>)}
            </div>
            <div style={{ fontSize: 10, fontFamily: T.fb, color: T.t3, lineHeight: 1.5 }}>
              Best value: Walk-In Lab or Ulta Lab Tests ... no doctor required. Estimated cost: $150-250 for full panel.
            </div>
          </div>
        )}

        {sortedResults.map(r => {
          const interp = r.interpretation;
          const dotColor = interp ? getStatusColor(interp.overallAssessment) : (T.t4 || T.t3);
          const chips = priorityMarkers.filter(k => r.parsedMarkers && r.parsedMarkers[k] != null).slice(0, 5);
          return (
            <div key={r.id} style={{ ...S.card, padding: 14, marginBottom: 13, cursor: 'pointer' }} onClick={() => { setSelectedLabId(r.id); setLabView('detail'); }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <div style={{ fontFamily: T.fd, fontSize: 16, color: T.t1, fontWeight: 300 }}>{r.date}</div>
                  <div style={{ fontSize: 10, fontFamily: T.fm, color: T.t3, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>{r.label || 'Lab Results'}</div>
                </div>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor }} />
              </div>

              {chips.length > 0 && (
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 8 }}>
                  {chips.map(k => {
                    const value = r.parsedMarkers[k];
                    const status = getMarkerStatus(k, value, sex);
                    const color = getStatusColor(status);
                    return (
                      <div key={k} style={{ flexShrink: 0, padding: '4px 8px', borderRadius: 3, background: 'rgba(0,0,0,0.3)', border: `1px solid ${color}40` }}>
                        <div style={{ fontSize: 8, color: T.t3, fontFamily: T.fm, textTransform: 'uppercase', letterSpacing: 0.5 }}>{MARKER_LABELS[k]}</div>
                        <div style={{ fontSize: 11, color, fontFamily: T.fm, fontWeight: 600 }}>{value}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {interp?.keyFindings && interp.keyFindings.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                  {interp.keyFindings.slice(0, 2).map((f, i) => {
                    const c = getStatusColor(f.severity === 'urgent' ? 'urgent' : f.severity === 'caution' ? 'monitor' : 'ok');
                    return <span key={i} style={{ fontSize: 9, padding: '3px 6px', borderRadius: 3, background: `${c}20`, color: c, fontFamily: T.fm }}>{f.finding}</span>;
                  })}
                </div>
              )}

              <div onClick={e => e.stopPropagation()}>
                {interp ? (
                  <div style={{ fontSize: 10, color: T.gold, fontFamily: T.fm, letterSpacing: 1.5, textTransform: 'uppercase' }}>VIEW ANALYSIS {'\u2192'}</div>
                ) : (
                  <button onClick={() => handleAnalyzeExisting(r)} disabled={analyzing} style={{ background: T.goldS, border: `1px solid ${T.goldM}`, color: T.gold, fontFamily: T.fm, fontSize: 10, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', letterSpacing: 0.5 }}>
                    {analyzing && analyzingId === r.id ? loadingText : 'Analyze'}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {analysisError && <div style={{ fontSize: 11, color: 'rgba(220,80,80,0.9)', fontFamily: T.fm, marginBottom: 10, textAlign: 'center' }}>{analysisError}</div>}

        {trendMarkers.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg, transparent, ${T.goldM})` }} />
              <span style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm }}>BIOMARKER TRENDS</span>
              <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg, ${T.goldM}, transparent)` }} />
            </div>
            {trendMarkers.map(k => {
              const points = [...results].filter(r => r.parsedMarkers && r.parsedMarkers[k] != null).sort((a, b) => a.date.localeCompare(b.date)).map(r => ({ label: r.date.slice(5), value: Number(r.parsedMarkers[k]) }));
              if (points.length < 2) return null;
              const last = points[points.length - 1].value;
              const r = REFERENCE_RANGES[k]?.[sex] || REFERENCE_RANGES[k]?.both;
              return (
                <ChartCard key={k} title={MARKER_LABELS[k]} rightLabel={`${last}${r ? ' ' + r.unit : ''}`} height={140}>
                  <LineChartVis data={points} color="rgba(201,168,76,0.8)" height={140} />
                </ChartCard>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Charts view (default) ──
  const sorted = [...checkins].sort((a, b) => a.date.localeCompare(b.date));
  const weightData = sorted.filter(c => c.weight != null && parseFloat(c.weight) > 0).map(c => ({ label: c.date.slice(5), value: parseFloat(c.weight) }));
  const waistData = sorted.filter(c => c.waist != null && parseFloat(c.waist) > 0).map(c => ({ label: c.date.slice(5), value: parseFloat(c.waist) }));
  const scoreData = sorted.filter(c => c.analysis?.rateScore && c.analysis.rateScore > 0).map(c => ({ label: c.date.slice(5), value: c.analysis.rateScore }));
  const bfData = sorted.filter(c => c.analysis?.bodyFatEstimate).map(c => ({ label: c.date.slice(5), value: parseBF(c.analysis.bodyFatEstimate) })).filter(d => d.value > 0);

  const wDelta = weightData.length >= 2 ? weightData[weightData.length - 1].value - weightData[0].value : 0;
  const waDelta = waistData.length >= 2 ? waistData[waistData.length - 1].value - waistData[0].value : 0;

  const trajectory = calculateTrajectory ? calculateTrajectory(checkins, profile?.targetWeight || 170, profile?.targetWaist || 26) : {};
  const milestones = detectMilestones ? detectMilestones(checkins) : [];

  return (
    <div style={{ animation: 'fadeUp .5s ease both' }}>
      <header style={{ ...S.header, marginBottom: 14 }}><h1 style={{ ...S.brand, fontSize: 20 }}>METRICS</h1><p style={S.sub}>Progress Charts</p></header>
      {segBar}

      {sorted.length < 2 ? <div style={{ textAlign: 'center', padding: '60px 20px 40px' }}><div style={{ width: 48, height: 48, margin: '0 auto 20px', borderRadius: '50%', border: `1px solid ${T.goldM}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SamsaraSymbol size={24} /></div><p style={{ fontFamily: T.fd, fontSize: 22, fontWeight: 300, color: T.t2, letterSpacing: 1, lineHeight: 1.3 }}>The data awaits</p><p style={{ fontFamily: T.fm, fontSize: 11, color: T.t3, marginTop: 10, lineHeight: 1.6, letterSpacing: 0.5 }}>Log two or more check-ins in the Body tab{'\n'}to see your progress charts emerge.</p></div>
        : <div>
          {checkins.length >= 5 && (trajectory.daysToTargetWeight || trajectory.daysToTargetWaist) && (
            <div style={{ ...S.card, padding: 14, marginBottom: 13, border: `1px solid ${T.goldM}`, background: 'rgba(201,168,76,0.04)' }}>
              <span style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm, display: 'block', marginBottom: 10 }}>TRAJECTORY</span>
              {trajectory.daysToTargetWeight && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: trajectory.daysToTargetWaist ? 8 : 0 }}>
                  <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, width: 50 }}>Weight</span>
                  <span style={{ fontSize: 13, fontFamily: T.fm, color: T.t1 }}>170 lbs in <span style={{ color: T.gold, fontWeight: 600 }}>{trajectory.daysToTargetWeight}d</span></span>
                  <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginLeft: 'auto' }}>{trajectory.projectedWeightDate}</span>
                </div>
              )}
              {trajectory.daysToTargetWaist && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: T.t3, fontFamily: T.fm, width: 50 }}>Waist</span>
                  <span style={{ fontSize: 13, fontFamily: T.fm, color: T.t1 }}>26in in <span style={{ color: T.gold, fontWeight: 600 }}>{trajectory.daysToTargetWaist}d</span></span>
                  <span style={{ fontSize: 10, color: T.t3, fontFamily: T.fm, marginLeft: 'auto' }}>{trajectory.projectedWaistDate}</span>
                </div>
              )}
            </div>
          )}

          {milestones.length > 0 ? (
            <div style={{ marginBottom: 13 }}>
              <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm, marginBottom: 8 }}>MILESTONES</div>
              {milestones.map((m, i) => (
                <div key={i} style={{ ...S.card, padding: '10px 14px', marginBottom: 6, borderLeft: `3px solid ${T.gold}`, background: 'rgba(201,168,76,0.04)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.goldS, border: `1px solid ${T.goldM}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: T.gold }}>{'\u2605'}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, fontFamily: T.fm, color: T.t1, fontWeight: 500 }}>{m.label}</span>
                  </div>
                  <span style={{ fontSize: 10, fontFamily: T.fm, color: T.t3, letterSpacing: 0.5, flexShrink: 0 }}>{m.date}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ ...S.card, padding: '14px', marginBottom: 13, textAlign: 'center', borderStyle: 'dashed' }}>
              <span style={{ fontSize: 11, fontFamily: T.fm, color: T.t3, letterSpacing: 0.5 }}>No milestones yet -- keep logging</span>
            </div>
          )}

          <ChartCard title="Body Weight" rightLabel={weightData.length ? `${weightData[weightData.length - 1].value} lbs ${'\u00B7'} ${wDelta >= 0 ? '+' : ''}${wDelta.toFixed(1)}` : ''}>
            <LineChartVis data={weightData} color="rgba(0,210,180,0.8)" />
          </ChartCard>
          <ChartCard title="Waist" rightLabel={waistData.length ? `${waistData[waistData.length - 1].value}" ${'\u00B7'} ${waDelta >= 0 ? '+' : ''}${waDelta.toFixed(1)}"` : ''}>
            <LineChartVis data={waistData} color="rgba(201,168,76,0.8)" />
          </ChartCard>
          <ChartCard title="Recomp Signal" subtitle="Weight vs Waist - the real metric">
            <RecompChart weightData={weightData} waistData={waistData} />
          </ChartCard>
          {scoreData.length >= 2 && <ChartCard title="Rate Score" rightLabel={scoreData.length ? `${scoreData[scoreData.length - 1].value}/10` : ''}><BarChartVis data={scoreData} /></ChartCard>}
          {bfData.length >= 2 && <ChartCard title="Body Fat %" rightLabel={bfData.length ? `${bfData[bfData.length - 1].value}%` : ''}>
            <LineChartVis data={bfData} color="rgba(150,120,220,0.8)" />
          </ChartCard>}
          <ChartCard title="Adherence - Last 30 Days" height={120}><AdherenceHeatmap logs={logs} stack={stack} /></ChartCard>

          {/* Subjective tracking */}
          <SubjectiveSection subjective={subjective} setSubjective={setSubjective} getSubjectiveChartData={getSubjectiveChartData} />

          {/* Lab biomarker timeline overlay */}
          {(() => {
            if (!results || results.length < 2) return null;
            const sortedResults = [...results].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            // Find markers with 2+ data points
            const markerCounts = {};
            sortedResults.forEach(r => {
              if (!r.parsedMarkers) return;
              Object.keys(r.parsedMarkers).forEach(k => {
                if (r.parsedMarkers[k] != null && !isNaN(Number(r.parsedMarkers[k]))) {
                  markerCounts[k] = (markerCounts[k] || 0) + 1;
                }
              });
            });
            const trendKeys = Object.keys(markerCounts).filter(k => markerCounts[k] >= 2).slice(0, 4);
            if (trendKeys.length === 0) return null;
            return (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 8 }}>
                  <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg, transparent, ${T.goldM})` }} />
                  <span style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: T.gold, fontFamily: T.fm }}>BIOMARKER TRENDS</span>
                  <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg, ${T.goldM}, transparent)` }} />
                </div>
                {trendKeys.map(k => {
                  const points = sortedResults.filter(r => r.parsedMarkers && r.parsedMarkers[k] != null).map(r => ({ label: r.date.slice(5), value: Number(r.parsedMarkers[k]) }));
                  const last = points[points.length - 1].value;
                  const ref = REFERENCE_RANGES[k]?.[sex] || REFERENCE_RANGES[k]?.both;
                  const unit = ref ? ref.unit : '';
                  const inRange = ref ? (last >= ref.low && last <= ref.high) : true;
                  return (
                    <ChartCard key={k} title={MARKER_LABELS[k] || k} rightLabel={`${last}${unit ? ' ' + unit : ''}`} height={140}>
                      <LineChartVis data={points} color={inRange ? 'rgba(0,210,180,0.8)' : 'rgba(220,80,80,0.8)'} height={140} />
                    </ChartCard>
                  );
                })}
              </div>
            );
          })()}
        </div>}
    </div>
  );
}
