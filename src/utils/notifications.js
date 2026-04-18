/* SAMSARA v3.4 - Local Push Notifications (Capacitor + Web fallback) */

import { LocalNotifications } from '@capacitor/local-notifications';

const PREFIX = 'samsara_notif_';

// ─── Capacitor detection ──────────────────────────────────────

let _useCapacitor = false;
try {
  _useCapacitor = typeof LocalNotifications !== 'undefined' && !!LocalNotifications.schedule;
} catch {
  _useCapacitor = false;
}

// ─── Core API ─────────────────────────────────────────────────

export function isSupported() {
  if (_useCapacitor) return true;
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export async function requestPermission() {
  if (_useCapacitor) {
    try {
      const result = await LocalNotifications.requestPermissions();
      // Capacitor returns { display: 'granted' | 'denied' | 'prompt' ... }
      return result.display === 'granted' ? 'granted' : result.display === 'denied' ? 'denied' : 'default';
    } catch {
      return 'unsupported';
    }
  }
  // Web fallback
  if (!('Notification' in window)) return 'unsupported';
  const result = await Notification.requestPermission();
  return result; // 'granted' | 'denied' | 'default'
}

// Safely read current permission without crashing on iOS WebView
// (where Notification is undefined but Capacitor provides the real API).
export async function getPermission() {
  if (_useCapacitor) {
    try {
      const result = await LocalNotifications.checkPermissions();
      return result.display === 'granted' ? 'granted' : result.display === 'denied' ? 'denied' : 'default';
    } catch {
      return 'unsupported';
    }
  }
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.permission; // 'granted' | 'denied' | 'default'
  }
  return 'unsupported';
}

// ─── Web fallback helpers ─────────────────────────────────────

const MAX_TIMEOUT = 2147483647;
const _activeTimeouts = {};

async function _webShowNow({ title, body, tag }) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: tag || 'samsara',
        vibrate: [100, 50, 100],
      });
      return;
    } catch { /* fall through to basic Notification */ }
  }
  new Notification(title, { body, tag: tag || 'samsara' });
}

function _webSchedule({ title, body, tag, delayMs }) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const clamped = Math.min(delayMs, MAX_TIMEOUT);
  const id = setTimeout(() => {
    _webShowNow({ title, body, tag });
    delete _activeTimeouts[tag || 'default'];
  }, clamped);
  if (tag) _activeTimeouts[tag] = id;
}

function _webCancelByTag(tag) {
  if (_activeTimeouts[tag]) {
    clearTimeout(_activeTimeouts[tag]);
    delete _activeTimeouts[tag];
  }
}

function _webCancelAll() {
  for (const tag of Object.keys(_activeTimeouts)) {
    clearTimeout(_activeTimeouts[tag]);
  }
  Object.keys(_activeTimeouts).forEach(k => delete _activeTimeouts[k]);
}

// ─── localStorage persistence ─────────────────────────────────

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

// ─── Capacitor scheduling helpers ─────────────────────────────

let _nextNotifId = 1;
const _tagToIds = {}; // tag -> [id, ...]

function _allocId(tag) {
  const id = _nextNotifId++;
  if (tag) {
    if (!_tagToIds[tag]) _tagToIds[tag] = [];
    _tagToIds[tag].push(id);
  }
  return id;
}

async function _capacitorCancelByTag(tag) {
  if (!_tagToIds[tag] || _tagToIds[tag].length === 0) return;
  try {
    await LocalNotifications.cancel({
      notifications: _tagToIds[tag].map(id => ({ id })),
    });
  } catch { /* ignore */ }
  delete _tagToIds[tag];
}

async function _capacitorCancelAll() {
  const allIds = Object.values(_tagToIds).flat();
  if (allIds.length > 0) {
    try {
      await LocalNotifications.cancel({
        notifications: allIds.map(id => ({ id })),
      });
    } catch { /* ignore */ }
  }
  Object.keys(_tagToIds).forEach(k => delete _tagToIds[k]);
}

async function _capacitorSchedule({ title, body, tag, atDate }) {
  const id = _allocId(tag);
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          schedule: { at: atDate },
          sound: undefined,
          extra: { tag: tag || 'samsara' },
        },
      ],
    });
  } catch (err) {
    console.warn('[Samsara] Failed to schedule notification:', err);
  }
  return id;
}

async function _capacitorShowNow({ title, body, tag }) {
  const id = _allocId(tag);
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          schedule: { at: new Date(Date.now() + 1000) }, // 1s from now
          sound: undefined,
          extra: { tag: tag || 'samsara' },
        },
      ],
    });
  } catch (err) {
    console.warn('[Samsara] Failed to show notification:', err);
  }
}

// ─── Unified schedule / cancel ────────────────────────────────

async function cancelByTag(tag) {
  if (_useCapacitor) {
    await _capacitorCancelByTag(tag);
  } else {
    _webCancelByTag(tag);
  }
}

async function cancelAll() {
  if (_useCapacitor) {
    await _capacitorCancelAll();
  } else {
    _webCancelAll();
  }
}

async function showNow({ title, body, tag }) {
  if (_useCapacitor) {
    await _capacitorShowNow({ title, body, tag });
  } else {
    await _webShowNow({ title, body, tag });
  }
}

async function scheduleAt({ title, body, tag, atDate }) {
  if (_useCapacitor) {
    return _capacitorSchedule({ title, body, tag, atDate });
  }
  // Web fallback: use delay
  const delayMs = Math.max(0, atDate.getTime() - Date.now());
  _webSchedule({ title, body, tag, delayMs });
}

// ─── Time helpers ─────────────────────────────────────────────

function nextTimeAt(hour, minute) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target;
}

function nextDayTimeAt(dayOfWeek, hour) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);
  let daysAhead = dayOfWeek - now.getDay();
  if (daysAhead < 0 || (daysAhead === 0 && target <= now)) daysAhead += 7;
  target.setDate(target.getDate() + daysAhead);
  return target;
}

// ─── Specific Schedulers ──────────────────────────────────────

export async function scheduleDailyReminder({ hourOfDay, minuteOfDay, message }) {
  await cancelByTag('daily_reminder');
  const atDate = nextTimeAt(hourOfDay, minuteOfDay);
  saveSchedule('daily_reminder', { hourOfDay, minuteOfDay, message });
  return scheduleAt({
    title: 'Protocol Reminder',
    body: message || 'Time to log your compounds',
    tag: 'daily_reminder',
    atDate,
  });
}

export async function scheduleWeeklyDose({ compound, dayOfWeek, hour }) {
  const tag = 'weekly_' + compound.id;
  await cancelByTag(tag);
  const atDate = nextDayTimeAt(dayOfWeek, hour || 9);
  saveSchedule(tag, { compoundId: compound.id, compoundName: compound.name, dayOfWeek, hour: hour || 9 });
  return scheduleAt({
    title: 'Weekly Dose: ' + compound.name,
    body: 'Time for your weekly ' + compound.name + ' injection',
    tag,
    atDate,
  });
}

export async function scheduleVialExpiry({ compoundName, reconDate, shelfLifeDays }) {
  const tag = 'expiry_' + compoundName.replace(/\s+/g, '_').toLowerCase();
  await cancelByTag(tag);
  const recon = new Date(reconDate);
  const expiry = new Date(recon);
  expiry.setDate(expiry.getDate() + shelfLifeDays);
  const warn = new Date(expiry);
  warn.setDate(warn.getDate() - 3);
  warn.setHours(9, 0, 0, 0);
  const now = new Date();
  let atDate;
  if (warn <= now && expiry > now) {
    // Already within 3 days -- schedule for tomorrow 9am
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    atDate = tomorrow;
  } else if (warn > now) {
    atDate = warn;
  } else {
    // Already expired
    return null;
  }
  saveSchedule(tag, { compoundName, reconDate, shelfLifeDays });
  return scheduleAt({
    title: 'Vial Expiring: ' + compoundName,
    body: compoundName + ' vial expires in 3 days. Check your supply.',
    tag,
    atDate,
  });
}

export async function scheduleStreakRisk({ dailyCompounds, logs }) {
  await cancelByTag('streak_risk');
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
    // Already past 8pm -- show now if still missing
    await showNow({
      title: 'Don\'t break your streak',
      body: missing.length + ' compound' + (missing.length > 1 ? 's' : '') + ' still need logging today',
      tag: 'streak_risk',
    });
    return null;
  }
  saveSchedule('streak_risk', { count: missing.length });
  return scheduleAt({
    title: 'Don\'t break your streak',
    body: missing.length + ' compound' + (missing.length > 1 ? 's' : '') + ' still need logging today',
    tag: 'streak_risk',
    atDate: eightPm,
  });
}

export async function scheduleSundaySummary() {
  await cancelByTag('sunday_summary');
  const atDate = nextDayTimeAt(0, 9); // Sunday 9am
  saveSchedule('sunday_summary', { enabled: true });
  return scheduleAt({
    title: 'Weekly Review Ready',
    body: 'See how your protocol performed this week',
    tag: 'sunday_summary',
    atDate,
  });
}

// ─── Master Init ──────────────────────────────────────────────

export async function initNotifications({ stack, vials, logs, settings }) {
  if (!isSupported()) return;

  // Check permission (Capacitor or Web)
  if (_useCapacitor) {
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') return;
    } catch { return; }
  } else {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
  }

  if (!settings) return;

  // Clear all previous scheduled notifications to avoid duplicates
  await cancelAll();

  // 1. Daily reminder
  if (settings.dailyReminderEnabled) {
    await scheduleDailyReminder({
      hourOfDay: settings.dailyReminderHour || 8,
      minuteOfDay: settings.dailyReminderMinute || 0,
      message: 'Time to log your compounds',
    });
  } else {
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
    clearSchedule('sunday_summary');
  }
}
