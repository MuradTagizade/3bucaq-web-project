/**
 * LEVEL UP — Formatters
 */

import { useLanguageStore } from '@/lib/store/languageStore';
import { translations } from './translations';

const DEFAULT_LANG = 'en';

// Locale used for Intl date formatting per UI language.
const INTL_LOCALE = {
  en: 'en-US',
  ru: 'ru-RU',
  tr: 'tr-TR',
  de: 'de-DE',
  fr: 'fr-FR',
};

function currentLang() {
  try {
    return useLanguageStore.getState().language || DEFAULT_LANG;
  } catch (e) {
    return DEFAULT_LANG;
  }
}

function resolveKey(dict, key) {
  if (!dict) return undefined;
  if (key.includes('.')) {
    let current = dict;
    for (const part of key.split('.')) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }
  return dict[key];
}

function getTranslation(key, fallback) {
  try {
    const lang = currentLang();
    // Current language first, then English base.
    const active = resolveKey(translations[lang], key);
    if (active !== undefined) return active;
    const base = resolveKey(translations[DEFAULT_LANG], key);
    if (base !== undefined) return base;
  } catch (e) {
    // Fallback if store is not initialized or inside SSR
  }
  return fallback;
}

export function formatCurrency(amount, currency = '$') {
  if (amount == null) return `${currency}0.00`;
  
  if (amount >= 1000000) {
    return `${currency}${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${currency}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${currency}${Number(amount).toFixed(2)}`;
}

export function formatUSDT(amount) {
  if (amount == null) return '0 USDT';
  return `${Number(amount).toLocaleString('en-US')} USDT`;
}

export function formatPoints(current, required) {
  return `${Number(current).toFixed(1)} / ${Number(required).toFixed(1)}`;
}

export function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const locale = INTL_LOCALE[currentLang()] || 'en-US';
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const locale = INTL_LOCALE[currentLang()] || 'en-US';
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCompactNumber(num) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function getTransactionTypeLabel(type) {
  const defaultLabels = {
    transfer: 'Transfer',
    referral_bonus: 'Referral bonus',
    depth_bonus: 'Depth bonus',
    daily_earning: 'Daily earning',
    package_purchase: 'Package purchase',
    level_bonus: 'Level bonus',
    deposit: 'Deposit',
    withdrawal: 'Withdrawal',
    admin_adjust: 'Admin adjustment',
  };

  const txLabels = getTranslation('tx_type_labels', defaultLabels);
  return txLabels[type] || defaultLabels[type] || type;
}

export function getKYCStatusLabel(status) {
  if (status === 'none') return getTranslation('kyc_not_submitted', 'Not submitted');
  const map = {
    pending: getTranslation('pending', 'Pending'),
    approved: getTranslation('approved', 'Approved'),
    rejected: getTranslation('rejected', 'Rejected'),
  };
  return map[status] || status;
}

export function getKYCStatusVariant(status) {
  const variants = {
    none: 'info',
    pending: 'warning',
    approved: 'success',
    rejected: 'error',
  };
  return variants[status] || 'info';
}

export function getPackageDisplayName(pkgId) {
  const names = {
    pkg19: '#19',
    pkg49: '#49',
    pkg99: '#99',
    pkg199: '#199',
    pkg399: '#399',
    pkg799: '#799',
  };
  return names[pkgId] || pkgId;
}
