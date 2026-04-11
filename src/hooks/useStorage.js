/* SAMSARA v4.0 - Split localStorage with export/import + IndexedDB photo storage */
import { useState, useEffect, useCallback } from "react";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   localStorage layer
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const KEYS = {
  settings: "samsara_settings",
  stack: "samsara_stack",
  logs: "samsara_logs",
  vials: "samsara_vials",
  checkins: "samsara_checkins",
  sites: "samsara_sites",
  calc: "samsara_calc",
  profile: "samsara_profile",
  subjective: "samsara_subjective",
  labs: "samsara_labs",
  offline_queue: "samsara_offline_queue",
};

function loadKey(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveKey(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Quota exceeded — try to save anyway after trimming
    console.warn('Storage quota warning for key:', key);
    try {
      // Attempt emergency save — trim old entries from arrays
      const str = JSON.stringify(value);
      if (str.length > 500000 && Array.isArray(value)) {
        // Keep last 500 entries to free space
        const trimmed = value.slice(-500);
        localStorage.setItem(key, JSON.stringify(trimmed));
        console.warn('Trimmed ' + key + ' to last 500 entries');
      }
    } catch (e2) {
      console.error('Storage save failed completely:', key);
    }
  }
}

export function useStorage(key, fallback) {
  const storageKey = KEYS[key] || key;
  const [value, setValue] = useState(() => loadKey(storageKey, fallback));

  useEffect(() => {
    saveKey(storageKey, value);
  }, [storageKey, value]);

  return [value, setValue];
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Storage health monitoring
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/** Get localStorage usage stats */
export function getStorageHealth() {
  let totalBytes = 0;
  const breakdown = {};
  const keyNames = Object.entries(KEYS);

  for (const [name, key] of keyNames) {
    try {
      const raw = localStorage.getItem(key);
      const bytes = raw ? raw.length * 2 : 0; // JS strings are UTF-16
      totalBytes += bytes;
      breakdown[name] = { bytes, kb: (bytes / 1024).toFixed(1), count: null };
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) breakdown[name].count = parsed.length;
        } catch {}
      }
    } catch {}
  }

  // Estimate total localStorage capacity (~5MB on most browsers)
  const capacityBytes = 5 * 1024 * 1024;
  const usedPct = (totalBytes / capacityBytes) * 100;
  const healthy = usedPct < 70;
  const warning = usedPct >= 70 && usedPct < 90;
  const critical = usedPct >= 90;

  return {
    totalBytes,
    totalKb: (totalBytes / 1024).toFixed(1),
    totalMb: (totalBytes / (1024 * 1024)).toFixed(2),
    usedPct: usedPct.toFixed(1),
    healthy,
    warning,
    critical,
    breakdown,
    status: critical ? 'critical' : warning ? 'warning' : 'healthy',
  };
}

/** React hook for storage health - checks on mount and when deps change */
export function useStorageHealth(deps = []) {
  const [health, setHealth] = useState(() => getStorageHealth());
  useEffect(() => {
    setHealth(getStorageHealth());
  }, deps);
  return health;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   IndexedDB photo storage
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const DB_NAME = "samsara_photos";
const DB_VERSION = 1;
const STORE_NAME = "photos";

function openPhotoDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save a photo to IndexedDB. id format: "{checkinId}_{slot}" */
export async function savePhoto(checkinId, slot, base64) {
  try {
    const db = await openPhotoDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({
      id: `${checkinId}_${slot}`,
      checkinId,
      slot,
      data: base64,
      timestamp: Date.now(),
    });
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
  } catch (e) {
    console.warn("Photo save failed:", e);
  }
}

/** Get a single photo by checkinId + slot */
export async function getPhoto(checkinId, slot) {
  try {
    const db = await openPhotoDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(`${checkinId}_${slot}`);
    return new Promise((res) => {
      req.onsuccess = () => res(req.result?.data || null);
      req.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}

/** Get all photos for a checkin */
export async function getPhotosForCheckin(checkinId) {
  try {
    const db = await openPhotoDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const all = await new Promise((res, rej) => {
      const req = store.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = rej;
    });
    return all.filter((p) => p.checkinId === checkinId);
  } catch {
    return [];
  }
}

/** Delete all photos for a checkin */
export async function deletePhotosForCheckin(checkinId) {
  try {
    const db = await openPhotoDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const slot of ["front", "side", "back", "flex"]) {
      store.delete(`${checkinId}_${slot}`);
    }
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
  } catch (e) {
    console.warn("Photo delete failed:", e);
  }
}

/** Get all photos (for export) */
export async function getAllPhotos() {
  try {
    const db = await openPhotoDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    return new Promise((res) => {
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });
  } catch {
    return [];
  }
}

/** Import photos from export data */
export async function importPhotos(photosArray) {
  if (!Array.isArray(photosArray) || photosArray.length === 0) return;
  try {
    const db = await openPhotoDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const photo of photosArray) {
      store.put(photo);
    }
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
  } catch (e) {
    console.warn("Photo import failed:", e);
  }
}

/** Get photo storage size estimate */
export async function getPhotoStorageSize() {
  try {
    const photos = await getAllPhotos();
    let bytes = 0;
    for (const p of photos) {
      bytes += (p.data || "").length * 0.75; // base64 to approximate bytes
    }
    return { count: photos.length, bytes, mb: (bytes / (1024 * 1024)).toFixed(2) };
  } catch {
    return { count: 0, bytes: 0, mb: "0" };
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Export / Import (async - includes photos)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/** Export all data as JSON (async - includes IndexedDB photos) */
export async function exportAllData(includePhotos = true) {
  const data = {};
  Object.entries(KEYS).forEach(([name, key]) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) data[name] = JSON.parse(raw);
    } catch (e) {}
  });
  data.exportDate = new Date().toISOString();
  data.version = "3.5";

  if (includePhotos) {
    try {
      data.photos = await getAllPhotos();
    } catch {
      data.photos = [];
    }
  }

  return data;
}

/** Import data from JSON (async - handles IndexedDB photos) */
export async function importAllData(jsonData) {
  try {
    const data = typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;
    Object.entries(KEYS).forEach(([name, key]) => {
      if (data[name]) {
        localStorage.setItem(key, JSON.stringify(data[name]));
      }
    });

    // Import photos if present
    if (data.photos && Array.isArray(data.photos)) {
      await importPhotos(data.photos);
    }

    return true;
  } catch (e) {
    return false;
  }
}

/** Clear all data (async - clears IndexedDB too) */
export async function clearAllData() {
  Object.values(KEYS).forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  });

  // Clear IndexedDB
  try {
    const db = await openPhotoDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
  } catch {}
}

/** Storage size estimate (localStorage only) */
export function getStorageSize() {
  let total = 0;
  Object.values(KEYS).forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) total += raw.length * 2; // UTF-16
    } catch (e) {}
  });
  return {
    bytes: total,
    kb: (total / 1024).toFixed(1),
    mb: (total / (1024 * 1024)).toFixed(2),
  };
}
