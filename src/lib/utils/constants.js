/**
 * LEVEL UP — Business Logic Constants
 * Paket məlumatları, level tələbləri, və sistem konfiqurasiyası
 */

export const PACKAGES = [
  {
    id: 'pkg19',
    price: 19,
    points: 0.6,
    dailyEarning: 0,
    type: 'investment',
    displayName: '#19',
    description: '0.6 point qazandırır',
    color: '#00E676',
    expiryDays: 180,
  },
  {
    id: 'pkg49',
    price: 49,
    points: 1.5,
    dailyEarning: 0,
    type: 'investment',
    displayName: '#49',
    description: '1.5 point qazandırır',
    color: '#00E5FF',
    expiryDays: 180,
  },
  {
    id: 'pkg99',
    price: 99,
    points: 3,
    dailyEarning: 0,
    type: 'investment',
    displayName: '#99',
    description: '3 point qazandırır',
    color: '#7C4DFF',
    expiryDays: 180,
  },
  {
    id: 'pkg199',
    price: 199,
    points: 6,
    dailyEarning: 0,
    type: 'investment',
    displayName: '#199',
    description: '6 point qazandırır',
    color: '#536DFE',
    expiryDays: 180,
  },
  {
    id: 'pkg399',
    price: 399,
    points: 12,
    dailyEarning: 3.3,
    type: 'earning',
    displayName: '#399',
    description: 'Gündəlik $3.3 qazanc, 12 point',
    color: '#FFD600',
    expiryDays: 120,
  },
  {
    id: 'pkg799',
    price: 799,
    points: 24,
    dailyEarning: 6.5,
    type: 'earning',
    displayName: '#799',
    description: 'Gündəlik $6.5 qazanc, 24 point',
    color: '#FF9100',
    expiryDays: 120,
  },
];

export const LEVELS = [
  { level: 1, points: 30, bonus: 99, requiredPkgs: [] },
  { level: 2, points: 109, bonus: 299, requiredPkgs: ['pkg19', 'pkg49'] },
  { level: 3, points: 268, bonus: 499, requiredPkgs: ['pkg19', 'pkg49'] },
  { level: 4, points: 597, bonus: 999, requiredPkgs: ['pkg19', 'pkg49'] },
  { level: 5, points: 1266, bonus: 1999, requiredPkgs: ['pkg19', 'pkg49', 'pkg99'] },
  { level: 6, points: 2615, bonus: 4399, requiredPkgs: ['pkg19', 'pkg49', 'pkg99'] },
  { level: 7, points: 5314, bonus: 8999, requiredPkgs: ['pkg19', 'pkg49', 'pkg99', 'pkg199'] },
  { level: 8, points: 10723, bonus: 18999, requiredPkgs: ['pkg19', 'pkg49', 'pkg99', 'pkg199', 'pkg399'] },
  { level: 9, points: 21552, bonus: 39999, requiredPkgs: ['pkg19', 'pkg49', 'pkg99', 'pkg199', 'pkg399'] },
  { level: 10, points: 43321, bonus: 72999, requiredPkgs: ['pkg19', 'pkg49', 'pkg99', 'pkg199', 'pkg399'] },
];

export const REFERRAL_BONUS = {
  firstLine: 0.10,   // 10%
  depthLine: 0.01,   // 1% (lines 2-5)
  maxDepth: 5,
};

export const BLOCK_DURATIONS = [
  { value: 7, label: '7 gün' },
  { value: 30, label: '30 gün' },
  { value: 180, label: '180 gün' },
  { value: 365, label: '365 gün' },
];

export const PASSWORD_RULES = {
  minLength: 10,
  requireUppercase: true,
  requireNumber: true,
};

export const PAGINATION = {
  subscribersPerPage: 15,
  historyPerPage: 20,
};

export const TRANSACTION_TYPES = {
  TRANSFER: 'transfer',
  REFERRAL_BONUS: 'referral_bonus',
  DEPTH_BONUS: 'depth_bonus',
  DAILY_EARNING: 'daily_earning',
  PACKAGE_PURCHASE: 'package_purchase',
  LEVEL_BONUS: 'level_bonus',
  DEPOSIT: 'deposit',
  WITHDRAWAL: 'withdrawal',
  ADMIN_ADJUST: 'admin_adjust',
};

export const CLAIM_STATUS = {
  PENDING: 'pending',
  DONE: 'done',
  REJECTED: 'rejected',
};

export const KYC_STATUS = {
  NONE: 'none',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const KYC_DOC_TYPES = [
  { value: 'passport', label: 'Pasport' },
  { value: 'id_card', label: 'Şəxsiyyət Vəsiqəsi' },
  { value: 'driving_license', label: 'Sürücülük Vəsiqəsi' },
];

export const NAV_ITEMS = [
  { id: 'home', label: 'Ana Səhifə', href: '/dashboard', icon: 'triangle' },
  { id: 'hotbed', label: 'Hot Bed', href: '/dashboard/hotbed', icon: 'flame' },
  { id: 'subscribers', label: 'Referallar', href: '/dashboard/subscribers', icon: 'users' },
  { id: 'transfer', label: 'Transfer', href: '/dashboard/transfer', icon: 'arrowLeftRight' },
];

export const MENU_ITEMS = [
  { id: 'deposit', label: 'Depozit', href: '/dashboard/deposit', icon: 'wallet' },
  { id: 'history', label: 'USDT Tarixçə', href: '/dashboard/history', icon: 'history' },
  { id: 'personalInfo', label: 'Şəxsi Məlumat', href: '/dashboard/personal-info', icon: 'userCircle' },
  { id: 'kyc', label: 'KYC', href: '/dashboard/kyc', icon: 'shieldCheck' },
];
