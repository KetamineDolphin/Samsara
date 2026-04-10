/* SAMSARA v3.0 - Split localStorage with export/import */
import { useState, useEffect, useCallback } from "react";

const KEYS = {
  settings: "samsara_settings",
  stack: "samsara_stack",
  logs: "samsara_logs",
  vials: "samsara_vials",
  checkins: "samsara_checkins",
  sites: "samsara_sites",
  calc: "samsara_calc",
  profile: "samsara_profile",
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
    // storage full
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

// Export all data as JSON
export function exportAllData() {
  const data = {};
  Object.entries(KEYS).forEach(([name, key]) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) data[name] = JSON.parse(raw);
    } catch (e) {}
  });
  data.exportDate = new Date().toISOString();
  data.version = "3.0";
  return data;
}

// Import data from JSON
export function importAllData(jsonData) {
  try {
    const data = typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;
    Object.entries(KEYS).forEach(([name, key]) => {
      if (data[name]) {
        localStorage.setItem(key, JSON.stringify(data[name]));
      }
    });
    return true;
  } catch (e) {
    return false;
  }
}

// Clear all data
export function clearAllData() {
  Object.values(KEYS).forEach(key => {
    try { localStorage.removeItem(key); } catch (e) {}
  });
}

// Storage size estimate
export function getStorageSize() {
  let total = 0;
  Object.values(KEYS).forEach(key => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) total += raw.length * 2; // UTF-16
    } catch (e) {}
  });
  return { bytes: total, kb: (total / 1024).toFixed(1), mb: (total / (1024 * 1024)).toFixed(2) };
}
