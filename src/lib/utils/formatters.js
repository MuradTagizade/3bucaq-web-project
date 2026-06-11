/**
 * 3bucaq — Formatters
 */

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
  return date.toLocaleDateString('az-AZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('az-AZ', {
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
  const labels = {
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
  return labels[type] || type;
}

export function getKYCStatusLabel(status) {
  const labels = {
    none: 'Təqdim edilməyib',
    pending: 'Gözləyir',
    approved: 'Təsdiqlənib',
    rejected: 'Rədd edilib',
  };
  return labels[status] || status;
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
