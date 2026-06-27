/**
 * LEVEL UP — Formatters
 */

import { useLanguageStore } from '@/lib/store/languageStore';
import { translations } from './translations';

function getTranslation(key, fallback) {
  try {
    const lang = useLanguageStore.getState().language || 'az';
    const dict = translations[lang] || translations.az;
    if (dict) {
      if (key.includes('.')) {
        const parts = key.split('.');
        let current = dict;
        for (const part of parts) {
          if (current === undefined || current === null) {
            current = undefined;
            break;
          }
          current = current[part];
        }
        if (current !== undefined) {
          return current;
        }
      } else if (dict[key] !== undefined) {
        return dict[key];
      }
    }
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
  let lang = 'az';
  try {
    lang = useLanguageStore.getState().language || 'az';
  } catch (e) {}
  return date.toLocaleDateString(lang === 'az' ? 'az-AZ' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  let lang = 'az';
  try {
    lang = useLanguageStore.getState().language || 'az';
  } catch (e) {}
  return date.toLocaleString(lang === 'az' ? 'az-AZ' : 'en-US', {
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
    transfer: 'Hesabdan transfer',
    referral_bonus: '10% bonus',
    depth_bonus: '1% referal bonusu',
    daily_earning: 'Gündəlik qazanc',
    package_purchase: 'Paket alışı',
    level_bonus: 'Level bonusu',
    deposit: 'Depozit',
    withdrawal: 'Çıxarış',
    admin_adjust: 'Admin düzəlişi',
  };
  
  const txLabels = getTranslation('tx_type_labels', defaultLabels);
  return txLabels[type] || defaultLabels[type] || type;
}

export function getKYCStatusLabel(status) {
  const defaultLabels = {
    none: 'Təqdim edilməyib',
    pending: 'Gözləyir',
    approved: 'Təsdiqlənib',
    rejected: 'Rədd edilib',
  };
  
  const kycLabels = getTranslation('kyc_status_labels', defaultLabels);
  // check direct mapping or under doc_types
  if (status === 'none') return getTranslation('not_submitted', defaultLabels.none);
  return kycLabels[status] || getTranslation(status, defaultLabels[status]) || status;
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
