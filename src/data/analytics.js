// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Samsara v3.0 - Analytics Data Layer
// src/data/analytics.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// Pure functions for milestone detection,
// trajectory projection, weekly AI summaries,
// adherence stats, and subjective tracking.
//
// No UI. No dependencies. No default export.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

import { AI_MODEL } from '../utils/ai';

function toISO(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate, n) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function diffDays(a, b) {
  if (!a || !b) return 0;
  return Math.round(
    (new Date(b) - new Date(a)) / 86400000
  );
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function parseBFMidpoint(est) {
  if (!est || typeof est !== 'string') return null;
  const clean = est.replace(/[~%\s]/g, '');
  const range = clean.match(/(\d+(?:\.\d+)?)\s*[-]\s*(\d+(?:\.\d+)?)/);
  if (range) {
    return (parseFloat(range[1]) + parseFloat(range[2])) / 2;
  }
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function linReg(xs, ys) {
  return weightedLinReg(xs, ys, null);
}

/**
 * Weighted least-squares linear regression with goodness-of-fit
 * statistics. When `weights` is null, all points weigh equally.
 *
 * Body-composition trends are noisy and non-stationary (water,
 * glycogen, plateaus), so we exponentially up-weight recent
 * check-ins: a point measured `d` days before the latest one gets
 * weight 0.5^(d / halfLifeDays). This tracks the *current* rate of
 * change instead of being dragged by stale early data.
 *
 * Returns slope, intercept, R² (weighted), and the standard error
 * of the slope — which downstream code turns into a projection
 * confidence band.
 */
function weightedLinReg(xs, ys, weights) {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, r2: 0, slopeSE: 0, n };

  const w = weights || xs.map(() => 1);
  let sw = 0, swx = 0, swy = 0, swxy = 0, swx2 = 0;
  for (let i = 0; i < n; i++) {
    sw += w[i];
    swx += w[i] * xs[i];
    swy += w[i] * ys[i];
    swxy += w[i] * xs[i] * ys[i];
    swx2 += w[i] * xs[i] * xs[i];
  }
  const denom = sw * swx2 - swx * swx;
  if (denom === 0) return { slope: 0, intercept: swy / sw, r2: 0, slopeSE: 0, n };

  const slope = (sw * swxy - swx * swy) / denom;
  const intercept = (swy - slope * swx) / sw;

  // Weighted R² and residual variance for the slope standard error.
  const meanY = swy / sw;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const fit = slope * xs[i] + intercept;
    ssRes += w[i] * (ys[i] - fit) ** 2;
    ssTot += w[i] * (ys[i] - meanY) ** 2;
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  // SE(slope) from weighted residuals. Effective df = n − 2.
  const df = Math.max(1, n - 2);
  const sxxW = swx2 - (swx * swx) / sw; // weighted Σw(x−x̄)²
  const slopeSE = sxxW > 0 ? Math.sqrt((ssRes / df) / sxxW) : 0;

  return { slope, intercept, r2, slopeSE, n };
}

// Exponential recency weights keyed to a half-life in days.
function recencyWeights(xs, halfLifeDays) {
  if (!xs.length) return [];
  const latest = Math.max(...xs);
  return xs.map((x) => Math.pow(0.5, (latest - x) / halfLifeDays));
}

// ─────────────────────────────────────────
// 1. detectMilestones
// ─────────────────────────────────────────

/**
 * Scan checkin history and detect the first
 * occurrence of each milestone type.
 *
 * @param {Array} checkins - array of checkin objects
 * @returns {Array<{type: string, date: string, value: *, label: string}>}
 */
export function detectMilestones(checkins) {
  if (!Array.isArray(checkins) || checkins.length === 0) return [];

  const sorted = [...checkins].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  const milestones = [];
  const seen = new Set();

  function add(type, date, value, label) {
    if (seen.has(type)) return;
    seen.add(type);
    milestones.push({ type, date, value, label });
  }

  let minWeight = Infinity;
  let minWaist = Infinity;
  let maxScore = -Infinity;
  const bfThresholds = [20, 18, 15];
  const bfCrossed = new Set();

  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    const date = toISO(c.date);

    // ── new_low_weight ──
    if (c.weight != null && c.weight < minWeight) {
      minWeight = c.weight;
      // Only fire after the first checkin so the
      // initial weight is not itself a milestone
      if (i > 0) {
        add(
          'new_low_weight',
          date,
          c.weight,
          'New low weight: ' + c.weight + ' lbs'
        );
      }
    }

    // ── new_low_waist ──
    if (c.waist != null && c.waist < minWaist) {
      minWaist = c.waist;
      if (i > 0) {
        add(
          'new_low_waist',
          date,
          c.waist,
          'New low waist: ' + c.waist + ' in'
        );
      }
    }

    // ── bf_milestone ──
    if (c.analysis && c.analysis.bodyFatEstimate) {
      const bf = parseBFMidpoint(c.analysis.bodyFatEstimate);
      if (bf != null) {
        for (const thresh of bfThresholds) {
          if (bf < thresh && !bfCrossed.has(thresh)) {
            bfCrossed.add(thresh);
            add(
              'bf_milestone_' + thresh,
              date,
              bf,
              'Body fat below ' + thresh + '%'
            );
          }
        }
      }
    }

    // ── score_peak ──
    if (c.analysis && c.analysis.rateScore != null) {
      if (c.analysis.rateScore > maxScore) {
        maxScore = c.analysis.rateScore;
        if (i > 0) {
          add(
            'score_peak',
            date,
            maxScore,
            'New peak rate score: ' + maxScore
          );
        }
      }
    }

    // ── recomp_signal ──
    // Weight stable (+/-0.5 lb) while waist
    // drops > 0.25 inches vs previous checkin
    if (i > 0) {
      const prev = sorted[i - 1];
      if (
        c.weight != null && prev.weight != null &&
        c.waist != null && prev.waist != null
      ) {
        const wDelta = Math.abs(c.weight - prev.weight);
        const waistDrop = prev.waist - c.waist;
        if (wDelta <= 0.5 && waistDrop > 0.25) {
          add(
            'recomp_signal',
            date,
            { weightDelta: round2(c.weight - prev.weight), waistDrop: round2(waistDrop) },
            'Recomp signal: weight stable, waist dropping'
          );
        }
      }
    }
  }

  // ── streak_7 ──
  // 7 consecutive calendar days with at least
  // one checkin each day
  const dateSet = new Set(sorted.map((c) => toISO(c.date)));
  const allDates = [...dateSet].sort();
  let streak = 1;
  for (let i = 1; i < allDates.length; i++) {
    if (diffDays(allDates[i - 1], allDates[i]) === 1) {
      streak++;
      if (streak >= 7) {
        add(
          'streak_7',
          allDates[i],
          7,
          '7-day check-in streak'
        );
        break;
      }
    } else {
      streak = 1;
    }
  }

  return milestones;
}

// ─────────────────────────────────────────
// 2. calculateTrajectory
// ─────────────────────────────────────────

/**
 * Project weight and waist trends using
 * linear regression on the most recent
 * checkins. Requires 5+ data points.
 *
 * @param {Array} checkins
 * @param {number} targetWeight - goal weight in lbs
 * @param {number} targetWaist - goal waist in inches
 * @returns {Object}
 */
export function calculateTrajectory(checkins, targetWeight, targetWaist) {
  const empty = {
    weightTrend: null,
    waistTrend: null,
    daysToTargetWeight: null,
    daysToTargetWaist: null,
    projectedWeightDate: null,
    projectedWaistDate: null,
  };

  if (!Array.isArray(checkins) || checkins.length < 5) return empty;

  const sorted = [...checkins]
    .filter((c) => c.date != null)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (sorted.length < 5) return empty;

  const origin = sorted[0].date;
  const today = todayISO();
  const todayDay = diffDays(origin, today);

  const weight = projectMetric(sorted, 'weight', targetWeight, origin, todayDay, today);
  const waist = projectMetric(sorted, 'waist', targetWaist, origin, todayDay, today);

  return {
    weightTrend: weight.trend,
    waistTrend: waist.trend,
    daysToTargetWeight: weight.daysToTarget,
    daysToTargetWaist: waist.daysToTarget,
    projectedWeightDate: weight.projectedDate,
    projectedWaistDate: waist.projectedDate,
    weightProjection: weight.projection,
    waistProjection: waist.projection,
    // New: quantified confidence for each projection.
    weightFit: weight.fit,
    waistFit: waist.fit,
    weightDateRange: weight.dateRange,
    waistDateRange: waist.dateRange,
  };
}

/**
 * Fit one metric (weight or waist), project the date it reaches a
 * target, and quantify the uncertainty. Uses recency-weighted
 * regression (14-day half-life) so the projection follows the
 * current trend rather than the whole noisy history.
 */
function projectMetric(sorted, key, target, origin, todayDay, today) {
  const empty = { trend: null, daysToTarget: null, projectedDate: null, projection: [], fit: null, dateRange: null };
  const pts = sorted.filter((c) => c[key] != null);
  if (pts.length < 5) return empty;

  const xs = pts.map((c) => diffDays(origin, c.date));
  const ys = pts.map((c) => c[key]);
  const weights = recencyWeights(xs, 14);
  const reg = weightedLinReg(xs, ys, weights);

  const trend = round2(reg.slope * 7); // units per week
  const fit = { r2: round2(reg.r2), weeklyRate: trend, n: reg.n };

  let daysToTarget = null;
  let projectedDate = null;
  let dateRange = null;

  if (target != null && reg.slope !== 0) {
    const current = reg.slope * todayDay + reg.intercept;
    const goingDown = reg.slope < 0 && current > target;
    const goingUp = reg.slope > 0 && current < target;
    if (goingDown || goingUp) {
      const targetDay = (target - reg.intercept) / reg.slope;
      daysToTarget = Math.max(0, Math.ceil(targetDay - todayDay));
      projectedDate = addDays(today, daysToTarget);

      // Confidence band: perturb the slope by ±1 SE and re-solve the
      // crossing day. Wider spread → less certain ETA.
      if (reg.slopeSE > 0) {
        const optimistic = reg.slope + Math.sign(reg.slope) * reg.slopeSE;
        const pessimistic = reg.slope - Math.sign(reg.slope) * reg.slopeSE;
        const dayA = (target - reg.intercept) / optimistic;
        const earliest = Math.max(0, Math.ceil(dayA - todayDay));
        let latest = null;
        // A flatter slope may never reach target; guard the division.
        const stillConverges = (reg.slope < 0 && pessimistic < 0) || (reg.slope > 0 && pessimistic > 0);
        if (stillConverges) {
          const dayB = (target - reg.intercept) / pessimistic;
          latest = Math.max(0, Math.ceil(dayB - todayDay));
        }
        dateRange = {
          earliest: addDays(today, earliest),
          latest: latest != null ? addDays(today, latest) : null,
        };
      }
    }
  }

  // Projected line for chart overlays.
  const projection = [];
  const lastDay = xs[xs.length - 1];
  const endDay = daysToTarget ? todayDay + daysToTarget : todayDay + 30;
  const steps = Math.min(8, Math.max(3, Math.ceil((endDay - lastDay) / 7)));
  for (let i = 0; i <= steps; i++) {
    const d = lastDay + ((endDay - lastDay) * i / steps);
    const projected = reg.slope * d + reg.intercept;
    const dateStr = addDays(origin, Math.round(d));
    projection.push({ label: dateStr.slice(5), value: round2(projected) });
  }

  return { trend, daysToTarget, projectedDate, projection, fit, dateRange };
}

// ─────────────────────────────────────────
// 3. generateWeeklySummary
// ─────────────────────────────────────────

/**
 * Call Claude API with the last 7 days of
 * protocol data and return a concise
 * weekly coaching summary.
 *
 * @param {Array} logs - injection log entries
 * @param {Array} checkins - body checkins
 * @param {Array} stack - active compound stack
 * @returns {Promise<{summary: string, date: string}>}
 */
export async function generateWeeklySummary(logs, checkins, stack, { subjective, labResults, profile, adherenceStats, siteHistory } = {}) {
  const fallback = { summary: '', date: todayISO() };

  try {
    const cutoff = addDays(todayISO(), -7);

    const recentLogs = (logs || [])
      .filter((l) => l.date >= cutoff)
      .map((l) => ({
        name: l.name,
        date: l.date,
        dose: l.doseLabel || (l.dose + ' ' + (l.unit || '')),
      }));

    const recentCheckins = (checkins || [])
      .filter((c) => c.date != null)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 2)
      .map((c) => ({
        date: c.date,
        weight: c.weight,
        waist: c.waist,
        analysis: c.analysis ? { rateScore: c.analysis.rateScore, bodyFatEstimate: c.analysis.bodyFatEstimate } : null,
      }));

    const compoundNames = (stack || []).map((c) => c.name + ' (' + c.dose + ' ' + c.unit + ' ' + c.frequency + ')');

    // Subjective trends (last 7 days)
    const recentSubjective = (subjective || [])
      .filter((s) => s.date >= cutoff)
      .map((s) => ({ date: s.date, energy: s.energy, focus: s.focus, hunger: s.hunger, mood: s.mood }));

    // Latest lab highlights
    const latestLab = (labResults || [])
      .filter((r) => r.parsedMarkers)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      [0];
    const labSummary = latestLab ? { date: latestLab.date, markers: latestLab.parsedMarkers } : null;

    // Adherence
    const adherence = adherenceStats || null;

    // Profile context
    const goals = profile ? {
      targetWeight: profile.targetWeight,
      targetWaist: profile.targetWaist,
      targetBodyFat: profile.targetBodyFat,
      primaryGoal: profile.primaryGoal,
    } : null;

    const systemPrompt =
      'You are Samsara\'s AI coach. Analyze this week\'s full protocol data — ' +
      'injection adherence, body composition, subjective well-being trends, and lab markers. ' +
      'Return a 3-4 sentence summary: what went well, what to watch, and one specific ' +
      'actionable recommendation. Reference actual numbers from the data. ' +
      'Be direct, specific, and data-driven — never generic platitudes.';

    const sections = [
      'INJECTION LOGS (last 7 days):\n' + JSON.stringify(recentLogs),
      '\n\nACTIVE PROTOCOL:\n' + JSON.stringify(compoundNames),
    ];
    if (recentCheckins.length > 0) sections.push('\n\nBODY CHECK-INS:\n' + JSON.stringify(recentCheckins));
    if (recentSubjective.length > 0) sections.push('\n\nSUBJECTIVE TRENDS (last 7d):\n' + JSON.stringify(recentSubjective));
    if (adherence) sections.push('\n\nADHERENCE:\n' + JSON.stringify({ overallPct: adherence.overallPct, currentStreak: adherence.currentStreak, longestStreak: adherence.longestStreak }));
    if (labSummary) sections.push('\n\nLATEST LABS (' + labSummary.date + '):\n' + JSON.stringify(labSummary.markers));
    if (goals) sections.push('\n\nUSER GOALS:\n' + JSON.stringify(goals));

    const userMessage = sections.join('');

    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        summary: 'API error ' + res.status + ': ' + errText.slice(0, 200),
        date: todayISO(),
      };
    }

    const data = await res.json();
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .trim();

    return {
      summary: text || 'No summary returned.',
      date: todayISO(),
    };
  } catch (err) {
    return {
      summary: 'Summary generation failed: ' + (err.message || 'unknown error'),
      date: todayISO(),
    };
  }
}

// ─────────────────────────────────────────
// 4. getAdherenceStats
// ─────────────────────────────────────────

/**
 * Calculate protocol adherence statistics
 * over a lookback window.
 *
 * @param {Array} logs - injection log entries
 * @param {Array} stack - active compound stack
 * @param {number} [days=30] - lookback period
 * @returns {Object}
 */
export function getAdherenceStats(logs, stack, days) {
  const lookback = days != null && days > 0 ? days : 30;

  const empty = {
    overallPct: 0,
    byCompound: [],
    currentStreak: 0,
    longestStreak: 0,
    bestDay: null,
    worstDay: null,
  };

  if (!Array.isArray(stack) || stack.length === 0) return empty;

  const safeLogs = Array.isArray(logs) ? logs : [];
  const today = todayISO();
  const startDate = addDays(today, -lookback + 1);

  // Identify daily compounds (the ones that
  // create a daily obligation to track)
  const dailyCompounds = stack.filter(
    (c) => c.frequency === 'daily'
  );
  const weeklyCompounds = stack.filter(
    (c) => c.frequency === 'weekly' || c.frequency === '2x_week'
  );

  // ── Per-compound stats ──
  // Use each compound's addedDate if available so we don't penalise
  // compounds that were added mid-protocol.  For legacy compounds
  // without addedDate, fall back to the first log date for that
  // compound, or the start of the lookback window.
  const byCompound = stack.map((compound) => {
    const freq = compound.frequency || 'daily';

    // Determine the effective start date for this compound
    const allCompLogs = safeLogs.filter(
      (l) => l.cid === compound.id || l.compoundId === compound.id
    );
    const firstLogDate = allCompLogs.length > 0
      ? allCompLogs.reduce((min, l) => l.date < min ? l.date : min, allCompLogs[0].date)
      : null;
    const compStart = compound.addedDate || firstLogDate || startDate;
    // Effective window start is the later of lookback start and compound start
    const effectiveStart = compStart > startDate ? compStart : startDate;

    const compLogs = allCompLogs.filter(
      (l) => l.date >= effectiveStart && l.date <= today
    );

    // Count actual days in this compound's active window
    const activeDays = Math.max(1, Math.floor((new Date(today) - new Date(effectiveStart)) / 86400000) + 1);

    let expected = 0;
    if (freq === 'daily') {
      expected = activeDays;
    } else if (freq === '2x_day') {
      expected = activeDays * 2;
    } else if (freq === 'weekly') {
      expected = Math.max(1, Math.floor(activeDays / 7));
    } else if (freq === '2x_week') {
      expected = Math.max(1, Math.floor(activeDays / 7) * 2);
    } else {
      // intermittent / as_needed: no strict expectation
      expected = compLogs.length; // 100% by definition
    }

    const uniqueDays = new Set(compLogs.map((l) => l.date)).size;
    const actual = freq === '2x_day' ? compLogs.length : freq === 'daily' ? uniqueDays : compLogs.length;
    const pct = expected > 0 ? Math.min(100, Math.round((actual / expected) * 100)) : 100;
    const missed = Math.max(0, expected - actual);

    return { name: compound.name, pct, missed };
  });

  // ── Overall percentage ──
  const totalExpected = byCompound.reduce(
    (sum, c) => sum + (c.pct > 0 ? 100 : 0), 0
  );
  const totalActual = byCompound.reduce((sum, c) => sum + c.pct, 0);
  const overallPct = byCompound.length > 0
    ? Math.round(totalActual / byCompound.length)
    : 0;

  // ── Streaks (consecutive days all daily compounds logged) ──
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  if (dailyCompounds.length > 0) {
    // Walk backwards from today
    for (let i = 0; i < lookback; i++) {
      const d = addDays(today, -i);
      const dayLogs = safeLogs.filter((l) => l.date === d);
      // Only check compounds that were active on this day
      const activeOnDay = dailyCompounds.filter(c => {
        const cStart = c.addedDate || startDate;
        return d >= cStart;
      });
      // If no compounds were active yet on this day, skip (don't break streak)
      if (activeOnDay.length === 0) continue;
      const allLogged = activeOnDay.every(
        (c) => dayLogs.some((l) => l.cid === c.id || l.compoundId === c.id)
      );

      if (allLogged) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
        if (i === tempStreak - 1) currentStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }
  }

  // ── Best / worst day of week ──
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayTotals = [0, 0, 0, 0, 0, 0, 0];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];

  if (dailyCompounds.length > 0) {
    for (let i = 0; i < lookback; i++) {
      const d = addDays(today, -i);
      const dow = new Date(d).getDay();
      // Only count compounds that were active on this day
      const activeOnDay = dailyCompounds.filter(c => {
        const cStart = c.addedDate || startDate;
        return d >= cStart;
      });
      if (activeOnDay.length === 0) continue;
      dayCounts[dow]++;

      const dayLogs = safeLogs.filter((l) => l.date === d);
      const logged = activeOnDay.filter(
        (c) => dayLogs.some((l) => l.cid === c.id || l.compoundId === c.id)
      ).length;
      dayTotals[dow] += logged / activeOnDay.length;
    }
  }

  let bestDay = null;
  let worstDay = null;
  let bestPct = -1;
  let worstPct = 101;

  for (let i = 0; i < 7; i++) {
    if (dayCounts[i] === 0) continue;
    const pct = (dayTotals[i] / dayCounts[i]) * 100;
    if (pct > bestPct) { bestPct = pct; bestDay = dayNames[i]; }
    if (pct < worstPct) { worstPct = pct; worstDay = dayNames[i]; }
  }

  return {
    overallPct,
    byCompound,
    currentStreak,
    longestStreak,
    bestDay,
    worstDay,
  };
}

// ─────────────────────────────────────────
// 5. logSubjective
// ─────────────────────────────────────────

/**
 * Append a subjective daily entry to the
 * existing array. Clamps scores to 1-10.
 *
 * @param {Array} existing - current subjective log array
 * @param {Object} entry - {date, energy, focus, hunger, mood}
 * @returns {Array} new array with entry appended
 */
export function logSubjective(existing, entry) {
  const safe = Array.isArray(existing) ? [...existing] : [];

  if (!entry) return safe;

  function clamp(v) {
    if (v == null || isNaN(v)) return 5;
    return Math.max(1, Math.min(10, Math.round(v)));
  }

  const record = {
    date: entry.date || todayISO(),
    energy: clamp(entry.energy),
    focus: clamp(entry.focus),
    hunger: clamp(entry.hunger),
    mood: clamp(entry.mood),
  };

  safe.push(record);
  return safe;
}

// ─────────────────────────────────────────
// 6. getSubjectiveChartData
// ─────────────────────────────────────────

/**
 * Format subjective logs for chart rendering.
 * Returns the last N days of data with arrays
 * for each metric.
 *
 * @param {Array} subjective - subjective log array
 * @param {number} [days=30] - lookback period
 * @returns {{labels: string[], energy: number[], focus: number[], hunger: number[], mood: number[]}}
 */
export function getSubjectiveChartData(subjective, days) {
  const lookback = days != null && days > 0 ? days : 30;
  const cutoff = addDays(todayISO(), -lookback);

  const empty = { labels: [], energy: [], focus: [], hunger: [], mood: [] };

  if (!Array.isArray(subjective) || subjective.length === 0) return empty;

  const filtered = subjective
    .filter((s) => s.date >= cutoff)
    .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

  return {
    labels: filtered.map((s) => s.date),
    energy: filtered.map((s) => s.energy || 0),
    focus: filtered.map((s) => s.focus || 0),
    hunger: filtered.map((s) => s.hunger || 0),
    mood: filtered.map((s) => s.mood || 0),
  };
}
