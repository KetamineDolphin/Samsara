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
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0 };

  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
    sxy += xs[i] * ys[i];
    sx2 += xs[i] * xs[i];
  }
  const denom = n * sx2 - sx * sx;
  if (denom === 0) return { slope: 0, intercept: sy / n };

  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
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

  // ── Weight regression ──
  const wPts = sorted.filter((c) => c.weight != null);
  let weightTrend = null;
  let daysToTargetWeight = null;
  let projectedWeightDate = null;

  if (wPts.length >= 5) {
    const xs = wPts.map((c) => diffDays(origin, c.date));
    const ys = wPts.map((c) => c.weight);
    const reg = linReg(xs, ys);

    // lbs per week = slope * 7
    weightTrend = round2(reg.slope * 7);

    if (targetWeight != null && reg.slope !== 0) {
      const currentW = reg.slope * todayDay + reg.intercept;
      // Only project if trend moves toward target
      const goingDown = reg.slope < 0 && currentW > targetWeight;
      const goingUp = reg.slope > 0 && currentW < targetWeight;
      if (goingDown || goingUp) {
        const targetDay = (targetWeight - reg.intercept) / reg.slope;
        daysToTargetWeight = Math.max(0, Math.ceil(targetDay - todayDay));
        projectedWeightDate = addDays(today, daysToTargetWeight);
      }
    }
  }

  // ── Waist regression ──
  const waPts = sorted.filter((c) => c.waist != null);
  let waistTrend = null;
  let daysToTargetWaist = null;
  let projectedWaistDate = null;

  if (waPts.length >= 5) {
    const xs = waPts.map((c) => diffDays(origin, c.date));
    const ys = waPts.map((c) => c.waist);
    const reg = linReg(xs, ys);

    waistTrend = round2(reg.slope * 7);

    if (targetWaist != null && reg.slope !== 0) {
      const currentWa = reg.slope * todayDay + reg.intercept;
      const goingDown = reg.slope < 0 && currentWa > targetWaist;
      const goingUp = reg.slope > 0 && currentWa < targetWaist;
      if (goingDown || goingUp) {
        const targetDay = (targetWaist - reg.intercept) / reg.slope;
        daysToTargetWaist = Math.max(0, Math.ceil(targetDay - todayDay));
        projectedWaistDate = addDays(today, daysToTargetWaist);
      }
    }
  }

  return {
    weightTrend,
    waistTrend,
    daysToTargetWeight,
    daysToTargetWaist,
    projectedWeightDate,
    projectedWaistDate,
  };
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
        model: 'claude-sonnet-4-20250514',
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
