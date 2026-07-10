// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Samsara v4.0 - Body Composition Math
// src/utils/bodyComp.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// Deterministic anthropometric calculations. The AI vision model
// should estimate only what requires *looking* at a photo (regional
// fat %, symmetry, body type). Everything downstream of that —
// BMI, FFMI, RMR, lean/fat mass split, fat-distribution ratios,
// visceral proxy, metabolic age, population percentile — is math,
// and math belongs in code: exact, reproducible, and identical for
// the same inputs every time.
//
// Sex-aware where the reference biology differs (essential fat,
// bone mineral fraction, FFMI norms, BF% percentile curves).
//
// Pure functions. No dependencies.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const LB_PER_KG = 2.2046226218;
const M_PER_IN = 0.0254;

export function lbsToKg(lbs) { return lbs / LB_PER_KG; }
export function inToM(inches) { return inches * M_PER_IN; }

export function heightInches(profile) {
  if (!profile || !profile.height) return null;
  const { feet, inches } = profile.height;
  const total = (Number(feet) || 0) * 12 + (Number(inches) || 0);
  return total > 0 ? total : null;
}

// ─────────────────────────────────────────
// Core splits and indices
// ─────────────────────────────────────────

// Fat mass / fat-free (lean) mass from weight + body-fat %.
export function massSplit(weightLbs, bodyFatPct) {
  if (!weightLbs || bodyFatPct == null) return null;
  const bf = clamp(bodyFatPct, 2, 60);
  const fatLbs = weightLbs * (bf / 100);
  const leanLbs = weightLbs - fatLbs;
  return { fatLbs: round1(fatLbs), leanLbs: round1(leanLbs) };
}

// Bone mineral as a fraction of body weight (whole-body DEXA BMC is
// ~3–4% of mass; a bit higher in males). Used to break the "lean"
// slice into soft-lean + bone for the composition bar.
export function boneMineralPct(sex) {
  return sex === 'female' ? 3.4 : 3.8;
}

export function bmi(weightLbs, heightIn) {
  if (!weightLbs || !heightIn) return null;
  const kg = lbsToKg(weightLbs);
  const m = inToM(heightIn);
  return round1(kg / (m * m));
}

// Fat-Free Mass Index. leanLbs = fat-free mass.
export function ffmi(leanLbs, heightIn) {
  if (!leanLbs || !heightIn) return null;
  const kg = lbsToKg(leanLbs);
  const m = inToM(heightIn);
  return round1(kg / (m * m));
}

// Height-normalised FFMI (Kouri): corrects the index to a 1.8 m
// reference so tall and short lifters compare fairly.
export function normalizedFFMI(leanLbs, heightIn) {
  const raw = ffmi(leanLbs, heightIn);
  if (raw == null || !heightIn) return null;
  const m = inToM(heightIn);
  return round1(raw + 6.1 * (1.8 - m));
}

// Resting metabolic rate — Katch-McArdle (lean-mass based), the
// right choice once body composition is known. kcal/day.
export function rmrKatchMcArdle(leanLbs) {
  if (!leanLbs) return null;
  return Math.round((370 + 21.6 * lbsToKg(leanLbs)) / 10) * 10;
}

// ─────────────────────────────────────────
// Fat distribution from regional readings
// ─────────────────────────────────────────

const TRUNK_REGIONS = ['chest', 'upperAbs', 'lowerAbs', 'obliques', 'upperBack', 'lowerBack'];
const LIMB_REGIONS = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
const ANDROID_REGIONS = ['upperAbs', 'lowerAbs', 'obliques', 'lowerBack']; // central/abdominal
const GYNOID_REGIONS = ['glutes', 'leftLeg', 'rightLeg'];                   // hip/thigh

function regionMean(regions, keys) {
  const vals = keys
    .map((k) => regions?.[k]?.fatPct)
    .filter((v) => v != null && !isNaN(v));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function fatDistribution(regions) {
  if (!regions) return {};
  const trunk = regionMean(regions, TRUNK_REGIONS);
  const limb = regionMean(regions, LIMB_REGIONS);
  const android = regionMean(regions, ANDROID_REGIONS);
  const gynoid = regionMean(regions, GYNOID_REGIONS);

  return {
    androidFatPct: android != null ? round1(android) : null,
    gynoidFatPct: gynoid != null ? round1(gynoid) : null,
    agRatio: android != null && gynoid ? round2(android / gynoid) : null,
    trunkToLimbFatRatio: trunk != null && limb ? round2(trunk / limb) : null,
  };
}

// Bilateral symmetry from paired regions (10 = perfect). Derived
// from the left/right lean-mass and fat deltas the model reported,
// so it's consistent instead of an eyeballed number.
export function symmetryScore(regions) {
  const pairs = [['leftArm', 'rightArm'], ['leftLeg', 'rightLeg']];
  let penalty = 0, counted = 0;
  for (const [l, r] of pairs) {
    const a = regions?.[l], b = regions?.[r];
    if (!a || !b) continue;
    counted++;
    const fatDelta = Math.abs((a.fatPct ?? 0) - (b.fatPct ?? 0));
    const leanDelta = a.leanLbs && b.leanLbs
      ? Math.abs(a.leanLbs - b.leanLbs) / ((a.leanLbs + b.leanLbs) / 2) * 100
      : 0;
    penalty += fatDelta * 0.25 + leanDelta * 0.15;
  }
  if (counted === 0) return null;
  return round1(clamp(10 - penalty / counted, 1, 10));
}

// ─────────────────────────────────────────
// Waist-derived visceral + central-adiposity proxies
// ─────────────────────────────────────────

// Waist-to-height ratio — one of the best-validated single markers
// of central adiposity and cardiometabolic risk. 0.5 is the classic
// "keep your waist under half your height" threshold.
export function waistToHeight(waistIn, heightIn) {
  if (!waistIn || !heightIn) return null;
  return round2(waistIn / heightIn);
}

/**
 * Estimated visceral adipose tissue AREA (cm²) as a transparent
 * function of waist circumference, sex, and age. This is a proxy
 * (photos can't see visceral fat), but it's a *reproducible* proxy
 * anchored to a real measurement instead of an LLM guess. Buckets
 * match the UI: <100 normal, 100–160 elevated, >160 high.
 */
export function visceralEstimate(waistIn, sex, age) {
  if (!waistIn) return { area: null, rating: null };
  const waistCm = waistIn * 2.54;
  const a = Number(age) || 35;
  // Waist is the dominant term; men carry more VAT at a given waist.
  const sexTerm = sex === 'female' ? -22 : 0;
  const area = Math.max(20, Math.round(2.9 * waistCm + 1.1 * a + sexTerm - 210));
  const rating = area < 100 ? 'normal' : area < 160 ? 'elevated' : 'high';
  return { area, rating };
}

// ─────────────────────────────────────────
// Metabolic age + population percentile from BF%
// ─────────────────────────────────────────

// Age-referenced median body-fat % (rough NHANES-style anchors).
function bfMedianForAge(sex, age) {
  const a = clamp(Number(age) || 35, 18, 75);
  if (sex === 'female') return 25 + (a - 20) * 0.18;   // ~25% at 20 → ~35% at 75
  return 15 + (a - 20) * 0.20;                          // ~15% at 20 → ~26% at 75
}

/**
 * Metabolic age: the age at which the person's body-fat % would be
 * the population median. Leaner-than-median → younger metabolic age.
 * Deterministic and monotonic, unlike an LLM's freehand number.
 */
export function metabolicAge(bodyFatPct, sex, age) {
  if (bodyFatPct == null) return null;
  const a = Number(age) || 35;
  const slope = sex === 'female' ? 0.18 : 0.20;
  const median = bfMedianForAge(sex, a);
  const delta = (bodyFatPct - median) / slope; // years of offset
  return Math.round(clamp(a + delta, 18, 80));
}

/**
 * Population percentile for leanness (higher = leaner than more of
 * the same-sex, similar-age population). Logistic curve centred on
 * the age median with a sex-specific spread.
 */
export function leannessPercentile(bodyFatPct, sex, age) {
  if (bodyFatPct == null) return null;
  const median = bfMedianForAge(sex, age);
  const spread = sex === 'female' ? 6.5 : 6.0; // ~1 SD of BF%
  const z = (bodyFatPct - median) / spread;
  const pct = 100 / (1 + Math.exp(-1.6 * -z)); // lower BF% → higher pct
  return Math.round(clamp(pct, 1, 99));
}

// FFMI classification band (sex-aware — natural ceilings differ).
export function ffmiBand(ffmiVal, sex) {
  if (ffmiVal == null) return null;
  const t = sex === 'female'
    ? { below: 14, avg: 16, above: 18, excellent: 20 }
    : { below: 18, avg: 20, above: 22, excellent: 25 };
  if (ffmiVal < t.below) return 'Below Average';
  if (ffmiVal < t.avg) return 'Average';
  if (ffmiVal < t.above) return 'Above Average';
  if (ffmiVal < t.excellent) return 'Excellent';
  return 'Elite';
}

// ─────────────────────────────────────────
// Orchestrator: derive ALL metrics from the model's visual estimate
// ─────────────────────────────────────────

/**
 * Given the vision model's *visual* readings (total & regional
 * body-fat %) plus known ground truth (weight, waist, height, sex,
 * age), compute every derived clinical metric deterministically and
 * return them in the shape the DEXA report already expects.
 *
 * @param {Object} visual - model output: {totalBodyFatPct, regions{...fatPct}}
 * @param {Object} ctx - {weightLbs, waistIn, heightIn, sex, age}
 */
export function deriveScanMetrics(visual, ctx) {
  const { weightLbs, waistIn, heightIn, sex, age } = ctx || {};
  const bf = visual?.totalBodyFatPct;
  const out = {};

  const split = massSplit(weightLbs, bf);
  if (split) {
    out.totalFatMassLbs = split.fatLbs;
    out.totalLeanMassLbs = split.leanLbs;
  }
  out.boneMineralPct = boneMineralPct(sex);

  if (heightIn) {
    out.bmi = bmi(weightLbs, heightIn);
    if (split) {
      out.ffmi = ffmi(split.leanLbs, heightIn);
      out.normalizedFFMI = normalizedFFMI(split.leanLbs, heightIn);
      out.estimatedRMR = rmrKatchMcArdle(split.leanLbs);
    }
  }

  // Regional lean mass: distribute fat-free mass across regions using
  // the model's relative regional lean weights if present; otherwise
  // leave the model's per-region leanLbs untouched.
  const dist = fatDistribution(visual?.regions);
  Object.assign(out, dist);

  const sym = symmetryScore(visual?.regions);
  if (sym != null) out.symmetryScore = sym;

  const visc = visceralEstimate(waistIn, sex, age);
  if (visc.area != null) {
    out.visceralFatArea = visc.area;
    out.visceralFatRating = visc.rating;
  }
  const whtr = waistToHeight(waistIn, heightIn);
  if (whtr != null) out.waistToHeight = whtr;

  if (bf != null) {
    out.metabolicAge = metabolicAge(bf, sex, age);
    out.populationPercentile = leannessPercentile(bf, sex, age);
  }

  return out;
}

// ─────────────────────────────────────────
// helpers
// ─────────────────────────────────────────

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }
