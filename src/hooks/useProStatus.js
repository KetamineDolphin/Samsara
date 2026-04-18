/* SAMSARA v4.0 - Pro subscription status hook */
import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

// Beta flag — paywall is disabled while we wire up App Store IAP.
// Set back to `false` once StoreKit products are live in App Store Connect.
const PAYWALL_DISABLED = true;

const PRODUCT_IDS = {
  month: 'samsara_pro_monthly',
  year: 'samsara_pro_annual',
};

/* ── localStorage receipt cache ── */
const CACHE_KEY = 'samsara_pro_receipt';

function getCachedReceipt() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const receipt = JSON.parse(raw);
    // Check expiry
    if (receipt.expiresAt && new Date(receipt.expiresAt) < new Date()) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return receipt;
  } catch { return null; }
}

function cacheReceipt(receipt) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(receipt)); } catch {}
}

function clearReceipt() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

/* ── StoreKit 2 via Capacitor bridge ── */
// This will be backed by a native plugin once configured in Xcode.
// For now, provides the full API surface so the UI is completely wired.

async function fetchProducts() {
  if (!Capacitor.isNativePlatform()) return [];
  try {
    // Will use @capacitor-community/in-app-purchases or similar
    // For now return empty — products show from our hardcoded pricing
    return [];
  } catch { return []; }
}

async function purchaseProduct(productId) {
  if (!Capacitor.isNativePlatform()) {
    // Web fallback — mark as pro for testing
    const receipt = { productId, purchasedAt: new Date().toISOString(), expiresAt: null, platform: 'web_test' };
    cacheReceipt(receipt);
    return receipt;
  }
  // Native purchase flow will go here
  throw new Error('Native purchases not yet configured — set up App Store Connect products first');
}

async function restorePurchases() {
  if (!Capacitor.isNativePlatform()) {
    const cached = getCachedReceipt();
    if (cached) return cached;
    return null;
  }
  // Native restore flow will go here
  return null;
}

/* ── Hook ── */
export function useProStatus(profile, setProfile) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);

  // Check status on mount
  useEffect(() => {
    const check = async () => {
      // First check profile tier (set by successful purchase)
      if (profile?.tier === 'pro') {
        setLoading(false);
        return;
      }
      // Then check cached receipt
      const receipt = getCachedReceipt();
      if (receipt) {
        setProfile(p => ({ ...p, tier: 'pro' }));
      }
      // Load products
      const prods = await fetchProducts();
      setProducts(prods);
      setLoading(false);
    };
    check();
  }, []);

  // While PAYWALL_DISABLED is true, every feature is unlocked — beta period.
  // On web (non-native), all features are free — pro gate only applies on iOS.
  const isPro = PAYWALL_DISABLED || !Capacitor.isNativePlatform() || profile?.tier === 'pro';

  const purchase = useCallback(async (planKey) => {
    const productId = PRODUCT_IDS[planKey];
    if (!productId) throw new Error('Unknown plan: ' + planKey);
    const receipt = await purchaseProduct(productId);
    if (receipt) {
      cacheReceipt(receipt);
      setProfile(p => ({ ...p, tier: 'pro' }));
      return true;
    }
    return false;
  }, [setProfile]);

  const restore = useCallback(async () => {
    const receipt = await restorePurchases();
    if (receipt) {
      cacheReceipt(receipt);
      setProfile(p => ({ ...p, tier: 'pro' }));
      return true;
    }
    return false;
  }, [setProfile]);

  const downgrade = useCallback(() => {
    clearReceipt();
    setProfile(p => ({ ...p, tier: 'free' }));
  }, [setProfile]);

  return { isPro, loading, products, purchase, restore, downgrade, PRODUCT_IDS };
}

/* ── Free tier limits ── */
export const FREE_LIMITS = {
  checkins: 3,           // 3 body check-ins
  aiAnalysesPerMonth: 1, // 1 AI analysis
  dexaScans: 0,          // No DEXA scans
  labScans: 0,           // No lab scans
  cloudSync: true,       // Cloud sync available to all users
  weeklyCoaching: false,  // No weekly AI summary
  exportData: false,     // No data export
};

export function canUseFeature(feature, profile, counts = {}) {
  if (PAYWALL_DISABLED || profile?.tier === 'pro') return true;
  switch (feature) {
    case 'checkin': return (counts.checkins || 0) < FREE_LIMITS.checkins;
    case 'aiAnalysis': return (counts.aiAnalyses || 0) < FREE_LIMITS.aiAnalysesPerMonth;
    case 'dexaScan': return false;
    case 'labScan': return false;
    case 'cloudSync': return true;
    case 'weeklyCoaching': return false;
    case 'exportData': return false;
    default: return true; // calc, logging, streaks are always free
  }
}
