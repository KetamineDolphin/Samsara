/* SAMSARA v4.0 - Cloud Sync Layer
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Syncs localStorage data to Supabase.
   localStorage remains source of truth — Supabase is the backup/sync layer.
   Works offline, queues changes, flushes when back online.
*/
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isCloudConfigured } from '../utils/supabase';

// Keys that should sync to cloud (exclude calc/offline_queue — ephemeral)
const SYNC_KEYS = ['settings', 'stack', 'logs', 'vials', 'checkins', 'sites', 'profile', 'subjective', 'labs'];
const DEBOUNCE_MS = 2000;
const LS_PREFIX = 'samsara_';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Sync status tracking
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

// status: 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'disabled'
let _syncStatus = 'idle';
let _lastSynced = null;
const _listeners = new Set();

function setSyncStatus(status) {
  _syncStatus = status;
  if (status === 'synced') _lastSynced = new Date();
  _listeners.forEach(fn => fn({ status: _syncStatus, lastSynced: _lastSynced }));
}

/** React hook for sync status */
export function useSyncStatus() {
  const [state, setState] = useState({ status: _syncStatus, lastSynced: _lastSynced });
  useEffect(() => {
    _listeners.add(setState);
    return () => _listeners.delete(setState);
  }, []);
  return state;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Push: localStorage → Supabase
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function pushKey(userId, key) {
  if (!supabase || !userId) return;
  const lsKey = LS_PREFIX + key;
  const raw = localStorage.getItem(lsKey);
  if (!raw) return;

  try {
    const value = JSON.parse(raw);
    const { error } = await supabase
      .from('user_data')
      .upsert({
        user_id: userId,
        key,
        value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,key' });

    if (error) throw error;
  } catch (e) {
    console.warn('Sync push failed for', key, e.message);
    throw e;
  }
}

/** Push all syncable keys to Supabase */
export async function pushAll(userId) {
  if (!supabase || !userId) return;
  if (!navigator.onLine) { setSyncStatus('offline'); return; }

  setSyncStatus('syncing');
  try {
    await Promise.all(SYNC_KEYS.map(key => pushKey(userId, key)));
    setSyncStatus('synced');
  } catch (e) {
    setSyncStatus('error');
    console.warn('Push all failed:', e.message);
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Pull: Supabase → localStorage
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/** Pull all data from Supabase into localStorage. Returns true if data was applied. */
export async function pullAll(userId) {
  if (!supabase || !userId) return false;
  if (!navigator.onLine) { setSyncStatus('offline'); return false; }

  setSyncStatus('syncing');
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('key, value, updated_at')
      .eq('user_id', userId);

    if (error) throw error;
    if (!data || data.length === 0) return false;

    let applied = false;
    for (const row of data) {
      if (!SYNC_KEYS.includes(row.key)) continue;
      const lsKey = LS_PREFIX + row.key;
      const localRaw = localStorage.getItem(lsKey);
      const localUpdated = localStorage.getItem(lsKey + '_updated');

      // Conflict resolution: cloud wins if newer, or if local has no timestamp
      const cloudTime = new Date(row.updated_at).getTime();
      const localTime = localUpdated ? new Date(localUpdated).getTime() : 0;

      if (cloudTime >= localTime) {
        localStorage.setItem(lsKey, JSON.stringify(row.value));
        localStorage.setItem(lsKey + '_updated', row.updated_at);
        applied = true;
      }
    }

    setSyncStatus('synced');
    return applied;
  } catch (e) {
    setSyncStatus('error');
    console.warn('Pull all failed:', e.message);
    return false;
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Merge: Smart conflict resolution for arrays (logs, checkins, etc.)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/** Merge pull — for arrays, union by unique ID; for objects, cloud wins */
export async function mergePull(userId) {
  if (!supabase || !userId) return false;
  if (!navigator.onLine) { setSyncStatus('offline'); return false; }

  setSyncStatus('syncing');
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('key, value, updated_at')
      .eq('user_id', userId);

    if (error) throw error;
    if (!data || data.length === 0) return false;

    const ARRAY_KEYS = ['logs', 'checkins', 'sites', 'subjective', 'labs'];
    let applied = false;

    for (const row of data) {
      if (!SYNC_KEYS.includes(row.key)) continue;
      const lsKey = LS_PREFIX + row.key;
      const localRaw = localStorage.getItem(lsKey);

      if (ARRAY_KEYS.includes(row.key) && Array.isArray(row.value)) {
        // Merge arrays: union by stringified entry (dedup)
        const local = localRaw ? JSON.parse(localRaw) : [];
        const cloud = row.value;
        const seen = new Set();
        const merged = [];
        for (const item of [...cloud, ...local]) {
          const key = JSON.stringify(item);
          if (!seen.has(key)) { seen.add(key); merged.push(item); }
        }
        // Sort by date if available
        merged.sort((a, b) => {
          const da = a.date || a.timestamp || '';
          const db = b.date || b.timestamp || '';
          return da < db ? -1 : da > db ? 1 : 0;
        });
        localStorage.setItem(lsKey, JSON.stringify(merged));
        applied = true;
      } else {
        // Objects: cloud wins
        localStorage.setItem(lsKey, JSON.stringify(row.value));
        applied = true;
      }
      localStorage.setItem(lsKey + '_updated', row.updated_at);
    }

    setSyncStatus('synced');
    return applied;
  } catch (e) {
    setSyncStatus('error');
    console.warn('Merge pull failed:', e.message);
    return false;
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Auto-sync hook: debounced push on any storage change
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/** Hook that auto-pushes changes to Supabase when data changes */
export function useAutoSync(userId, deps = []) {
  const timerRef = useRef(null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  useEffect(() => {
    if (!isCloudConfigured() || !userId) return;

    // Debounce: wait for writes to settle, then push
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (userIdRef.current && navigator.onLine) {
        pushAll(userIdRef.current);
        // Stamp update times
        SYNC_KEYS.forEach(key => {
          const lsKey = LS_PREFIX + key;
          if (localStorage.getItem(lsKey)) {
            localStorage.setItem(lsKey + '_updated', new Date().toISOString());
          }
        });
      }
    }, DEBOUNCE_MS);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [userId, ...deps]);

  // Sync on reconnect
  useEffect(() => {
    if (!isCloudConfigured() || !userId) return;
    const handleOnline = () => {
      setSyncStatus('syncing');
      pushAll(userId);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [userId]);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Auth helpers
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/** Get current session user ID */
export async function getCurrentUserId() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id || null;
  } catch {
    return null;
  }
}

/** Sign up with email + password */
export async function signUp(email, password) {
  if (!supabase) return { error: 'Cloud sync not configured' };
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  return { user: data.user, session: data.session };
}

/** Sign in with email + password */
export async function signIn(email, password) {
  if (!supabase) return { error: 'Cloud sync not configured' };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return { user: data.user, session: data.session };
}

/** Sign in with magic link (passwordless) */
export async function signInMagicLink(email) {
  if (!supabase) return { error: 'Cloud sync not configured' };
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) return { error: error.message };
  return { success: true };
}

/** Sign out */
export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
  setSyncStatus('idle');
}

/** Listen for auth state changes */
export function onAuthChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return () => data.subscription.unsubscribe();
}
