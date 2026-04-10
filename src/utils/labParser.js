/* SAMSARA v3.4 - Lab Report Parser */

const PATTERNS = {
  totalTestosterone: [
    /testosterone[,\s]+total[:\s]+(\d+\.?\d*)/i,
    /total\s+testosterone[:\s]+(\d+\.?\d*)/i,
    /^testosterone[:\s]+(\d+\.?\d*)/im,
  ],
  freeTestosterone: [
    /testosterone[,\s]+free[:\s]+(\d+\.?\d*)/i,
    /free\s+testosterone[:\s]+(\d+\.?\d*)/i,
  ],
  shbg: [
    /\bshbg\b[:\s]+(\d+\.?\d*)/i,
    /sex\s+hormone\s+binding[:\s]+(\d+\.?\d*)/i,
  ],
  lh: [
    /\blh\b[:\s]+(\d+\.?\d*)/i,
    /luteinizing\s+hormone[:\s]+(\d+\.?\d*)/i,
  ],
  fsh: [
    /\bfsh\b[:\s]+(\d+\.?\d*)/i,
    /follicle\s+stimulating[:\s]+(\d+\.?\d*)/i,
  ],
  estradiol: [
    /estradiol[:\s]+(\d+\.?\d*)/i,
    /\be2\b[:\s]+(\d+\.?\d*)/i,
  ],
  prolactin: [
    /prolactin[:\s]+(\d+\.?\d*)/i,
  ],
  dheas: [
    /dhea-?s[:\s]+(\d+\.?\d*)/i,
    /dehydroepiandrosterone\s+sulfate[:\s]+(\d+\.?\d*)/i,
  ],
  igf1: [
    /igf-?1[:\s]+(\d+\.?\d*)/i,
    /insulin.like\s+growth\s+factor[:\s]+(\d+\.?\d*)/i,
    /somatomedin[:\s]+(\d+\.?\d*)/i,
  ],
  gh: [
    /\bgh\b[:\s]+(\d+\.?\d*)/i,
    /growth\s+hormone[:\s]+(\d+\.?\d*)/i,
    /\bhgh\b[:\s]+(\d+\.?\d*)/i,
  ],
  tsh: [
    /\btsh\b[:\s]+(\d+\.?\d*)/i,
    /thyroid\s+stimulating[:\s]+(\d+\.?\d*)/i,
  ],
  freeT4: [
    /free\s+t4[:\s]+(\d+\.?\d*)/i,
    /\bft4\b[:\s]+(\d+\.?\d*)/i,
    /thyroxine[,\s]+free[:\s]+(\d+\.?\d*)/i,
  ],
  freeT3: [
    /free\s+t3[:\s]+(\d+\.?\d*)/i,
    /\bft3\b[:\s]+(\d+\.?\d*)/i,
    /triiodothyronine[,\s]+free[:\s]+(\d+\.?\d*)/i,
  ],
  glucose: [
    /fasting\s+glucose[:\s]+(\d+\.?\d*)/i,
    /glucose[,\s]+fasting[:\s]+(\d+\.?\d*)/i,
    /\bglucose\b[:\s]+(\d+\.?\d*)/i,
  ],
  hba1c: [
    /hba1c[:\s]+(\d+\.?\d*)/i,
    /hemoglobin\s+a1c[:\s]+(\d+\.?\d*)/i,
    /\ba1c\b[:\s]+(\d+\.?\d*)/i,
  ],
  insulin: [
    /\binsulin\b[:\s]+(\d+\.?\d*)/i,
    /fasting\s+insulin[:\s]+(\d+\.?\d*)/i,
  ],
  totalCholesterol: [
    /cholesterol[,\s]+total[:\s]+(\d+\.?\d*)/i,
    /total\s+cholesterol[:\s]+(\d+\.?\d*)/i,
  ],
  ldl: [
    /\bldl\b[:\s]+(\d+\.?\d*)/i,
    /ldl.cholesterol[:\s]+(\d+\.?\d*)/i,
  ],
  hdl: [
    /\bhdl\b[:\s]+(\d+\.?\d*)/i,
    /hdl.cholesterol[:\s]+(\d+\.?\d*)/i,
  ],
  triglycerides: [
    /triglycerides[:\s]+(\d+\.?\d*)/i,
    /\btrig\b[:\s]+(\d+\.?\d*)/i,
  ],
  apob: [
    /\bapob\b[:\s]+(\d+\.?\d*)/i,
    /apolipoprotein\s+b[:\s]+(\d+\.?\d*)/i,
  ],
  hematocrit: [
    /hematocrit[:\s]+(\d+\.?\d*)/i,
    /\bhct\b[:\s]+(\d+\.?\d*)/i,
  ],
  hemoglobin: [
    /hemoglobin[:\s]+(\d+\.?\d*)/i,
    /\bhgb\b[:\s]+(\d+\.?\d*)/i,
  ],
  wbc: [
    /\bwbc\b[:\s]+(\d+\.?\d*)/i,
    /white\s+blood\s+cell[:\s]+(\d+\.?\d*)/i,
    /white\s+blood\s+count[:\s]+(\d+\.?\d*)/i,
  ],
  rbc: [
    /\brbc\b[:\s]+(\d+\.?\d*)/i,
    /red\s+blood\s+cell[:\s]+(\d+\.?\d*)/i,
  ],
  platelets: [
    /platelets[:\s]+(\d+\.?\d*)/i,
    /\bplt\b[:\s]+(\d+\.?\d*)/i,
  ],
  ast: [
    /\bast\b[:\s]+(\d+\.?\d*)/i,
    /aspartate\s+amino[:\s]+(\d+\.?\d*)/i,
  ],
  alt: [
    /\balt\b[:\s]+(\d+\.?\d*)/i,
    /alanine\s+amino[:\s]+(\d+\.?\d*)/i,
  ],
  creatinine: [
    /creatinine[:\s]+(\d+\.?\d*)/i,
  ],
  egfr: [
    /\begfr\b[:\s]+(\d+\.?\d*)/i,
    /estimated\s+gfr[:\s]+(\d+\.?\d*)/i,
  ],
  vitaminD: [
    /vitamin\s+d[:\s]+(\d+\.?\d*)/i,
    /25-oh[:\s]+(\d+\.?\d*)/i,
    /25\s+hydroxy[:\s]+(\d+\.?\d*)/i,
  ],
  cortisol: [
    /\bcortisol\b[:\s]+(\d+\.?\d*)/i,
    /am\s+cortisol[:\s]+(\d+\.?\d*)/i,
  ],
  psa: [
    /\bpsa\b[:\s]+(\d+\.?\d*)/i,
    /prostate\s+specific[:\s]+(\d+\.?\d*)/i,
  ],
  crp: [
    /hs-?crp[:\s]+(\d+\.?\d*)/i,
    /c-reactive\s+protein[:\s]+(\d+\.?\d*)/i,
    /\bcrp\b[:\s]+(\d+\.?\d*)/i,
  ],
  ferritin: [
    /ferritin[:\s]+(\d+\.?\d*)/i,
  ],
};

export function parseLabText(text) {
  const result = {};
  if (!text || typeof text !== 'string') {
    for (const key of Object.keys(PATTERNS)) result[key] = null;
    return result;
  }
  for (const [key, patterns] of Object.entries(PATTERNS)) {
    result[key] = null;
    for (const re of patterns) {
      const m = text.match(re);
      if (m && m[1]) {
        const v = parseFloat(m[1]);
        if (!isNaN(v)) { result[key] = v; break; }
      }
    }
  }
  return result;
}

export function extractLabDate(text) {
  if (!text) return null;
  const MONTHS = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  // ISO: YYYY-MM-DD
  let m = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  // MM/DD/YYYY
  m = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let yr = parseInt(m[3]);
    if (yr < 100) yr += 2000;
    const d = new Date(yr, parseInt(m[1]) - 1, parseInt(m[2]));
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  // DD-Mon-YYYY
  m = text.match(/(\d{1,2})[-\s]([A-Za-z]{3})[a-z]*[-\s](\d{2,4})/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (mo != null) {
      let yr = parseInt(m[3]);
      if (yr < 100) yr += 2000;
      const d = new Date(yr, mo, parseInt(m[1]));
      if (!isNaN(d)) return d.toISOString().slice(0, 10);
    }
  }
  // Month DD, YYYY
  m = text.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase().slice(0, 3)];
    if (mo != null) {
      const d = new Date(parseInt(m[3]), mo, parseInt(m[2]));
      if (!isNaN(d)) return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

export function countParsedMarkers(parsedMarkers) {
  if (!parsedMarkers) return 0;
  return Object.values(parsedMarkers).filter(v => v != null).length;
}
