// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Samsara v4.0 - Pharmacokinetics Engine
// src/data/pharmacokinetics.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// One-compartment model with first-order absorption
// (the Bateman function). Turns each compound's
// half-life and time-to-peak into:
//   - a relative plasma-concentration curve
//   - steady-state accumulation ratio + time to plateau
//   - a live "on-board" estimate from the actual dose log
//
// All concentrations are RELATIVE (fraction of a single
// dose's theoretical peak). We never claim absolute ng/mL
// because bioavailability and volume of distribution are
// unknown for research compounds — but the *shape*,
// accumulation, and relative trough/peak are meaningful
// and reproducible from published PK parameters.
//
// Pure functions. No UI. No dependencies.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const LN2 = Math.LN2;

// ─────────────────────────────────────────
// Dosing interval (hours) from a frequency key
// ─────────────────────────────────────────

const FREQ_INTERVAL_HOURS = {
  daily: 24,
  '2x_day': 12,
  '3x_day': 8,
  '2x_week': 84,      // ~3.5 days
  '3x_week': 56,      // ~2.33 days
  weekly: 168,
  intermittent: 48,   // ~every other day
  as_needed: null,    // no schedule
};

export function intervalHours(frequency) {
  return FREQ_INTERVAL_HOURS[frequency] ?? null;
}

// ─────────────────────────────────────────
// Elimination + absorption rate constants
// ─────────────────────────────────────────

// ke = ln(2) / t½    (per hour)
export function eliminationRate(halfLifeHours) {
  if (!halfLifeHours || halfLifeHours <= 0) return null;
  return LN2 / halfLifeHours;
}

// Derive the absorption rate constant ka from the observed
// time-to-peak (tmax). For a one-compartment oral/subq model:
//     tmax = ln(ka/ke) / (ka - ke)
// This is monotonic in ka (for ka > ke), so we solve it by
// bisection. If tmax is missing or unresolvable we fall back
// to ka = 5·ke (absorption ~5x faster than elimination — a
// reasonable default for injected peptides).
export function absorptionRate(halfLifeHours, peakPlasmaMinutes) {
  const ke = eliminationRate(halfLifeHours);
  if (ke == null) return null;

  const tmax = peakPlasmaMinutes != null ? peakPlasmaMinutes / 60 : null;
  if (tmax == null || tmax <= 0) return ke * 5;

  // tmax must be physically achievable. As ka → ke⁺, tmax → 1/ke.
  // If the requested tmax exceeds that limit, absorption can't be
  // the slower process — clamp to a fast default.
  const tmaxLimit = 1 / ke;
  if (tmax >= tmaxLimit) return ke * 8;

  const f = (ka) => Math.log(ka / ke) / (ka - ke) - tmax;

  // Bracket the root. f is negative for large ka (fast peak),
  // positive as ka → ke⁺ (slow peak → tmaxLimit).
  let lo = ke * 1.0001;
  let hi = ke * 2;
  let guard = 0;
  while (f(hi) > 0 && guard < 60) { hi *= 2; guard++; }

  let ka = ke * 5;
  for (let i = 0; i < 80; i++) {
    ka = (lo + hi) / 2;
    const v = f(ka);
    if (Math.abs(v) < 1e-7) break;
    if (v > 0) lo = ka; else hi = ka;
  }
  return ka;
}

// ─────────────────────────────────────────
// Single-dose concentration (Bateman function)
// ─────────────────────────────────────────

// Relative plasma concentration at time t (hours) after a
// single dose, normalised so the peak of ONE dose = 1.0.
// C(t) = A · (e^{-ke·t} − e^{-ka·t})
// where A is chosen so max(C) = 1.
export function singleDoseConc(t, ke, ka) {
  if (t < 0) return 0;
  if (ka == null || ke == null) return 0;

  // Special case ka ≈ ke → flip-flop degenerate form.
  if (Math.abs(ka - ke) < 1e-6) {
    // C(t) = ke·t·e^{-ke·t}, peak at t = 1/ke where value = 1/e
    const peak = 1 / Math.E;
    return (ke * t * Math.exp(-ke * t)) / peak;
  }

  const tmax = Math.log(ka / ke) / (ka - ke);
  const peak = Math.exp(-ke * tmax) - Math.exp(-ka * tmax);
  if (peak <= 0) return 0;
  const raw = Math.exp(-ke * t) - Math.exp(-ka * t);
  return Math.max(0, raw / peak);
}

// ─────────────────────────────────────────
// Steady-state accumulation
// ─────────────────────────────────────────

/**
 * Steady-state metrics for repeated dosing at a fixed interval.
 * Uses the closed-form multiple-dosing accumulation factor.
 *
 * accumulationRatio R = 1 / (1 − e^{−ke·τ})
 * timeToSteadyState ≈ 5 half-lives (97% of plateau)
 *
 * @returns {null|{accumulationRatio, timeToSteadyStateHours,
 *   timeToSteadyStateDays, ssPeak, ssTrough, fluctuationPct, plateaus}}
 */
export function steadyState(halfLifeHours, frequency) {
  const ke = eliminationRate(halfLifeHours);
  const tau = intervalHours(frequency);
  if (ke == null || tau == null) return null;

  const decayPerInterval = Math.exp(-ke * tau);
  const accumulationRatio = 1 / (1 - decayPerInterval);

  // Peak/trough of the accumulated curve, in single-dose-peak units.
  const ssPeak = accumulationRatio;                 // just after a dose
  const ssTrough = accumulationRatio * decayPerInterval; // right before next
  const fluctuationPct = ssPeak > 0
    ? ((ssPeak - ssTrough) / ssPeak) * 100
    : 0;

  const timeToSteadyStateHours = (halfLifeHours * 5);

  return {
    accumulationRatio: round3(accumulationRatio),
    timeToSteadyStateHours: round2(timeToSteadyStateHours),
    timeToSteadyStateDays: round2(timeToSteadyStateHours / 24),
    ssPeak: round3(ssPeak),
    ssTrough: round3(ssTrough),
    fluctuationPct: round1(fluctuationPct),
    // "plateaus" = does the drug meaningfully accumulate?
    // <1.15x accumulation → essentially no build-up (short t½ vs interval)
    plateaus: accumulationRatio >= 1.15,
  };
}

// ─────────────────────────────────────────
// Simulated curve for an idealised schedule
// ─────────────────────────────────────────

/**
 * Build a sampled plasma curve for a compound dosed on a regular
 * schedule for `days`, assuming perfect adherence. Superposes the
 * Bateman response of every scheduled dose.
 *
 * @returns {null|{points:[{hour,day,conc}], steadyState, ke, ka,
 *   firstDoseHour}}
 */
export function simulateSchedule(compound, days = 21, samplesPerDay = 8) {
  const halfLife = compound?.halfLifeHours;
  const ke = eliminationRate(halfLife);
  const ka = absorptionRate(halfLife, compound?.peakPlasmaMinutes);
  const tau = intervalHours(compound?.frequency);
  if (ke == null || ka == null || tau == null) return null;

  const totalHours = days * 24;
  // Dose administration times (hours). For daily+ we anchor at 0.
  const doseTimes = [];
  for (let t = 0; t <= totalHours; t += tau) doseTimes.push(t);

  const step = 24 / samplesPerDay;
  const points = [];
  for (let h = 0; h <= totalHours; h += step) {
    let c = 0;
    for (const dt of doseTimes) {
      if (dt > h) break;
      c += singleDoseConc(h - dt, ke, ka);
    }
    points.push({ hour: round2(h), day: round2(h / 24), conc: round3(c) });
  }

  return {
    points,
    steadyState: steadyState(halfLife, compound.frequency),
    ke: round3(ke),
    ka: round3(ka),
    doseCount: doseTimes.length,
  };
}

// ─────────────────────────────────────────
// Live "on-board" estimate from the real dose log
// ─────────────────────────────────────────

/**
 * Estimate current relative plasma level for a compound from the
 * user's actual logged doses (not an idealised schedule). Each log
 * contributes a decaying Bateman tail; we sum the survivors.
 *
 * Result is expressed both in single-dose-peak units and as a
 * percentage of the compound's expected steady-state peak, so the
 * UI can say "you're at ~82% of steady-state levels."
 *
 * @param {Array} compoundLogs - logs for ONE compound, each {date,time?}
 * @param {Object} compound - library/stack entry with PK fields + frequency
 * @param {Date|number} [nowMs] - evaluation time (defaults to Date.now())
 * @returns {null|{level, pctOfSteadyPeak, lastDoseHoursAgo,
 *   trend, dosesCounted, halfLifeHours}}
 */
export function currentOnBoard(compoundLogs, compound, nowMs) {
  const halfLife = compound?.halfLifeHours;
  const ke = eliminationRate(halfLife);
  const ka = absorptionRate(halfLife, compound?.peakPlasmaMinutes);
  if (ke == null || ka == null) return null;
  if (!Array.isArray(compoundLogs) || compoundLogs.length === 0) return null;

  const now = nowMs != null ? new Date(nowMs).getTime() : Date.now();

  // Only doses within ~8 half-lives still matter (>99.6% cleared).
  const windowMs = halfLife * 8 * 3600 * 1000;

  const doseMs = compoundLogs
    .map((l) => logTimestamp(l))
    .filter((ms) => ms != null && ms <= now && now - ms <= windowMs)
    .sort((a, b) => a - b);

  if (doseMs.length === 0) return null;

  let level = 0;
  for (const ms of doseMs) {
    const hoursAgo = (now - ms) / 3600000;
    level += singleDoseConc(hoursAgo, ke, ka);
  }

  const lastDoseHoursAgo = (now - doseMs[doseMs.length - 1]) / 3600000;

  // Compare against the expected steady-state peak for this schedule.
  const ss = steadyState(halfLife, compound.frequency);
  const pctOfSteadyPeak = ss && ss.ssPeak > 0
    ? Math.round((level / ss.ssPeak) * 100)
    : null;

  // Trend: compare level now vs 1 hour ago to know if rising or clearing.
  let past = 0;
  for (const ms of doseMs) {
    const hoursAgo = (now - 3600000 - ms) / 3600000;
    if (hoursAgo < 0) continue;
    past += singleDoseConc(hoursAgo, ke, ka);
  }
  let trend = 'clearing';
  if (level > past * 1.02) trend = 'rising';
  else if (Math.abs(level - past) <= past * 0.02) trend = 'stable';

  return {
    level: round3(level),
    pctOfSteadyPeak,
    lastDoseHoursAgo: round1(lastDoseHoursAgo),
    trend,
    dosesCounted: doseMs.length,
    halfLifeHours: halfLife,
  };
}

// ─────────────────────────────────────────
// Human-readable status label for the dose log
// ─────────────────────────────────────────

/**
 * Classify where a compound is in its kinetics right now, for a
 * status chip. Uses time-to-peak and half-life to distinguish
 * absorbing / peaking / active / clearing / cleared.
 */
export function kineticsStatus(compound, lastDoseMs, nowMs) {
  const halfLife = compound?.halfLifeHours;
  if (!halfLife || lastDoseMs == null) return null;
  const now = nowMs != null ? new Date(nowMs).getTime() : Date.now();
  const hoursAgo = (now - lastDoseMs) / 3600000;
  if (hoursAgo < 0) return null;

  const tmaxH = (compound?.peakPlasmaMinutes ?? 30) / 60;

  if (hoursAgo < tmaxH * 0.6) return { phase: 'absorbing', label: 'Absorbing' };
  if (hoursAgo < tmaxH * 1.8) return { phase: 'peaking', label: 'Peak plasma' };
  if (hoursAgo < halfLife) return { phase: 'active', label: 'Active' };
  if (hoursAgo < halfLife * 4) return { phase: 'clearing', label: 'Clearing' };
  return { phase: 'cleared', label: 'Cleared' };
}

// ─────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────

function logTimestamp(l) {
  if (!l || !l.date) return null;
  // Logs store date as 'YYYY-MM-DD' and optionally a time like '08:30'
  // or '8:30 AM'. Build a local timestamp; fall back to local noon so
  // an undated-time dose lands mid-day rather than midnight UTC.
  let iso = l.date;
  const time = parseClock(l.time);
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  if (time) { d.setHours(time.h, time.m, 0, 0); }
  else { d.setHours(12, 0, 0, 0); }
  return d.getTime();
}

function parseClock(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const mer = m[3] ? m[3].toUpperCase() : null;
  if (mer === 'PM' && h < 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }
function round3(n) { return Math.round(n * 1000) / 1000; }
