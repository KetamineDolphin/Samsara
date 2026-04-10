/* SAMSARA v3.4 - Local Push Notifications */

const PREFIX = 'samsara_notif_';
const MAX_TIMEOUT = 2147483647; // ~24.8 days max for setTimeout

// ─── Core API ──────────────────────────────────────────────────

export function isSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export async function requestPermission() {
  if (!isSupported()) return 'unsupported';
  const result = await Notification.requestPermission();
  return result; // 'granted' | 'denied' | 'default'
}

export async function showNow({ title, body, tag }) {
  if (!isSupported() || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: tag || 'samsara',
    vibrate: [100, 50, 100],
  });
}

// ─── Scheduling ────────────────────────────────────────────────

const _activeTimeouts = {};

export async function scheduleNotification({ title, body, tag, delayMs }) {
  if (!isSupported() || Notification.permission !== 'granted') return null;
  // Clamp to max timeout; for longer delays, initNotifications reschedules on app open
  const clamped = Math.min(delayMs, MAX_TIMEOUT);
  const id = setTimeout(() => {
    showNow({ title, body, tag });
    delete _activeTimeouts[tag || 'default'];
  }, clamped);
  if (tag) _activeTimeouts[tag] = id;
  return id;
}

export function cancelNotification(timeoutId) {
  clearTimeout(timeoutId);
}

function cancelByTag(tag) {
  if (_activeTimeouts[tag]) {
    clearTimeout(_activeTimeouts[tag]);
    delete _activeTimeouts[tag];
  }
}

// ─── localStorage persistence ──────────────────────────────────

export function getScheduledKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k.replace(PREFIX, ''));
  }
  return keys;
}

export function saveSchedule(key, schedule) {
  localStorage.setItem(PREFIX + key, JSON.stringify(schedule));
}

export function loadSchedule(key) {
  const raw = localStorage.getItem(PREFIX + key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearSchedule(key) {
  localStorage.removeItem(PREFIX + key);
}

// ─── Specific Schedulers ───────────────────────────────────────

function msUntilTime(hour, minute) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target - now;
}

function msUntilDayTime(dayOfWeek, hour) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);
  let daysAhead = dayOfWeek - now.getDay();
  if (daysAhead < 0 || (daysAhead === 0 && target <= now)) daysAhead += 7;
  target.setDate(target.getDate() + daysAhead);
  return target - now;
}

export async function scheduleDailyReminder({ hourOfDay, minuteOfDay, message }) {
  cancelByTag('daily_reminder');
  const delay = msUntilTime(hourOfDay, minuteOfDay);
  saveSchedule('daily_reminder', { hourOfDay, minuteOfDay, message });
  return scheduleNotification({
    title: 'Protocol Reminder',
    body: message || 'Time to log your compounds',
    tag: 'daily_reminder',
    delayMs: delay,
  });
}

export async function scheduleWeeklyDose({ compound, dayOfWeek, hour }) {
  const tag = 'weekly_' + compound.id;
  cancelByTag(tag);
  const delay = msUntilDayTime(dayOfWeek, hour || 9);
  saveSchedule(tag, { compoundId: compound.id, compoundName: compound.name, dayOfWeek, hour: hour || 9 });
  return scheduleNotification({
    title: 'Weekly Dose: ' + compound.name,
    body: 'Time for your weekly ' + compound.name + ' injection',
    tag,
    delayMs: delay,
  });
}

export async function scheduleVialExpiry({ compoundName, reconDate, shelfLifeDays }) {
  const tag = 'expiry_' + compoundName.replace(/\s+/g, '_').toLowerCase();
  cancelByTag(tag);
  const recon = new Date(reconDate);
  const expiry = new Date(recon);
  expiry.setDate(expiry.getDate() + shelfLifeDays);
  const warn = new Date(expiry);
  warn.setDate(warn.getDate() - 3);
  warn.setHours(9, 0, 0, 0);
  const now = new Date();
  let delay;
  if (warn <= now && expiry > now) {
    // Already within 3 days — schedule for tomorrow 9am
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    delay = tomorrow - now;
  } else if (warn > now) {
    delay = warn - now;
  } else {
    // Already expired
    return null;
  }
  saveSchedule(tag, { compoundName, reconDate, shelfLifeDays });
  return scheduleNotification({
    title: 'Vial Expiring: ' + compoundName,
    body: compoundName + ' vial expires in 3 days. Check your supply.',
    tag,
    delayMs: delay,
  });
}

export async function scheduleStreakRisk({ dailyCompounds, logs }) {
  cancelByTag('streak_risk');
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = (logs || []).filter(l => l.date === today);
  const loggedIds = new Set(todayLogs.map(l => l.compoundId));
  const missing = dailyCompounds.filter(c => !loggedIds.has(c.compoundId));
  if (missing.length === 0) {
    clearSchedule('streak_risk');
    return null;
  }
  const now = new Date();
  const eightPm = new Date(now);
  eightPm.setHours(20, 0, 0, 0);
  if (eightPm <= now) {
    // Already past 8pm — show now if still missing
    showNow({
      title: 'Don\'t break your streak',
      body: missing.length + ' compound' + (missing.length > 1 ? 's' : '') + ' still need logging today',
      tag: 'streak_risk',
    });
    return null;
  }
  const delay = eightPm - now;
  saveSchedule('streak_risk', { count: missing.length });
  return scheduleNotification({
    title: 'Don\'t break your streak',
    body: missing.length + ' compound' + (missing.length > 1 ? 's' : '') + ' still need logging today',
    tag: 'streak_risk',
    delayMs: delay,
  });
}

export async function scheduleSundaySummary() {
  cancelByTag('sunday_summary');
  const delay = msUntilDayTime(0, 9); // Sunday 9am
  saveSchedule('sunday_summary', { enabled: true });
  return scheduleNotification({
    title: 'Weekly Review Ready',
    body: 'See how your protocol performed this week',
    tag: 'sunday_summary',
    delayMs: delay,
  });
}

// ─── Master Init ───────────────────────────────────────────────

export async function initNotifications({ stack, vials, logs, settings }) {
  if (!isSupported() || Notification.permission !== 'granted') return;
  if (!settings) return;

  // 1. Daily reminder
  if (settings.dailyReminderEnabled) {
    await scheduleDailyReminder({
      hourOfDay: settings.dailyReminderHour || 8,
      minuteOfDay: settings.dailyReminderMinute || 0,
      message: 'Time to log your compounds',
    });
  } else {
    cancelByTag('daily_reminder');
    clearSchedule('daily_reminder');
  }

  // 2. Weekly dose reminders
  if (settings.weeklyDoseEnabled && stack) {
    const weeklyCompounds = stack.filter(s => s.frequency === '2x_week' || s.frequency === '1x_week' || s.frequency === 'weekly');
    for (const c of weeklyCompounds) {
      await scheduleWeeklyDose({
        compound: { id: c.compoundId, name: c.name || c.compoundId },
        dayOfWeek: c.preferredDay || 1, // default Monday
        hour: 9,
      });
    }
  }

  // 3. Vial expiry warnings
  if (settings.vialExpiryEnabled && vials) {
    for (const [key, vial] of Object.entries(vials)) {
      if (vial.reconDate && vial.shelfLifeDays) {
        await scheduleVialExpiry({
          compoundName: vial.name || key,
          reconDate: vial.reconDate,
          shelfLifeDays: vial.shelfLifeDays,
        });
      }
    }
  }

  // 4. Streak risk
  if (settings.streakEnabled && stack) {
    const dailyCompounds = stack.filter(s => s.frequency === 'daily' || s.frequency === '5on2off');
    if (dailyCompounds.length > 0) {
      await scheduleStreakRisk({ dailyCompounds, logs });
    }
  }

  // 5. Sunday summary
  if (settings.sundaySummaryEnabled) {
    await scheduleSundaySummary();
  } else {
    cancelByTag('sunday_summary');
    clearSchedule('sunday_summary');
  }
}
