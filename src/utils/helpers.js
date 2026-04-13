/* SAMSARA v3.0 - Utility Functions */

export const getToday = () => new Date().toISOString().slice(0, 10);
export const getNow = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const doseMgOf = (c) => c.unit === "mcg" ? c.dose / 1000 : c.dose;
export const concOf = (c) => c.waterMl > 0 ? c.vialMg / c.waterMl : 0;
export const unitsOf = (c) => { const cn = concOf(c); return cn > 0 ? (doseMgOf(c) / cn) * 100 : 0; };
export const dosesPerVial = (c) => { const d = doseMgOf(c); return d > 0 ? c.vialMg / d : 0; };
export const fmtDose = (c) => c.unit === "mg" ? `${c.dose} mg` : `${c.dose} mcg`;
export const daysNextWeekly = () => { const d = new Date().getDay(), diff = (7 - d) % 7; return diff === 0 ? 7 : diff; };
export const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const getWeekStart = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); };

// Vial freshness - days since reconstitution
export const vialAge = (vial) => {
  if (!vial || !vial.reconDate) return 0;
  const now = new Date();
  const recon = new Date(vial.reconDate + "T00:00:00");
  return Math.floor((now - recon) / (1000 * 60 * 60 * 24));
};

// Vial freshness status
export const vialFreshness = (vial) => {
  const age = vialAge(vial);
  if (age >= 42) return { status: "expired", color: "rgba(220,80,80,0.8)", label: "Expired - replace vial" };
  if (age >= 28) return { status: "warning", color: "rgba(255,180,50,0.8)", label: `${42 - age}d until expiry` };
  return { status: "fresh", color: "rgba(92,184,112,0.6)", label: `Reconstituted ${age}d ago` };
};

// Usable doses accounting for ~5% dead volume waste
export const usableDoses = (c) => {
  const total = dosesPerVial(c);
  return Math.floor(total * 0.95);
};

// Injection site rotation - suggest next site based on history
export const SITE_LIST = [
  { id: "abdomen_left", label: "Abdomen L", region: "abdomen" },
  { id: "abdomen_right", label: "Abdomen R", region: "abdomen" },
  { id: "upper_abdomen_left", label: "Upper Abdomen L", region: "abdomen" },
  { id: "upper_abdomen_right", label: "Upper Abdomen R", region: "abdomen" },
  { id: "thigh_left", label: "Thigh L", region: "thigh" },
  { id: "thigh_right", label: "Thigh R", region: "thigh" },
  { id: "delt_left", label: "Delt L", region: "delt" },
  { id: "delt_right", label: "Delt R", region: "delt" },
  { id: "glute_left", label: "Glute L", region: "glute" },
  { id: "glute_right", label: "Glute R", region: "glute" },
  { id: "love_handle_left", label: "Love Handle L", region: "love_handle" },
  { id: "love_handle_right", label: "Love Handle R", region: "love_handle" },
  { id: "lat_left", label: "Lat L", region: "lat" },
  { id: "lat_right", label: "Lat R", region: "lat" },
  { id: "calf_left", label: "Calf L", region: "calf" },
  { id: "calf_right", label: "Calf R", region: "calf" },
];

export const suggestNextSite = (siteHistory) => {
  if (!siteHistory || siteHistory.length === 0) return SITE_LIST[0];
  // Count usage in last 14 days
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const cutoff = twoWeeksAgo.toISOString().slice(0, 10);
  const recent = siteHistory.filter(s => s.date >= cutoff);
  const counts = {};
  SITE_LIST.forEach(s => { counts[s.id] = 0; });
  recent.forEach(s => { counts[s.siteId] = (counts[s.siteId] || 0) + 1; });
  // Return least-used site
  const sorted = SITE_LIST.slice().sort((a, b) => counts[a.id] - counts[b.id]);
  return sorted[0];
};

// Escalation scheduler
export const getEscalationStatus = (compound) => {
  if (!compound.escalation) return null;
  const { protocol, currentStep, stepIntervalDays, lastStepDate } = compound.escalation;
  if (!protocol || currentStep >= protocol.length - 1) return { canStep: false, label: "At target dose" };
  const daysSinceStep = lastStepDate ? vialAge({ reconDate: lastStepDate }) : 999;
  const daysUntilNext = Math.max(0, stepIntervalDays - daysSinceStep);
  return {
    canStep: daysUntilNext === 0,
    currentDose: protocol[currentStep],
    nextDose: protocol[currentStep + 1],
    daysUntilNext,
    step: currentStep + 1,
    totalSteps: protocol.length,
    label: daysUntilNext > 0 ? `${daysUntilNext}d until next step` : "Ready to escalate",
  };
};

// Parse body fat string to number: "21-22%" -> 21.5
export const parseBF = (str) => {
  if (!str) return null;
  const nums = str.match(/(\d+\.?\d*)/g);
  if (!nums) return null;
  return nums.reduce((a, b) => a + parseFloat(b), 0) / nums.length;
};
