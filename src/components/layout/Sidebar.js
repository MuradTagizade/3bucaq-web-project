'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';
import Logo from './Logo';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LanguageToggle from '@/components/ui/LanguageToggle';
import { useAuthStore } from '@/lib/store/authStore';
import { useTranslation } from '@/lib/store/languageStore';
import {
  Triangle,
  ArrowLeftRight,
  Flame,
  Users,
  History,
  Copy,
  Check,
  LogOut,
  Shield,
  Wallet,
  Star,
  User,
  ShieldCheck,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

const SIDEBAR_ITEMS = [
  { id: 'home', label: 'Ana Səhifə', href: '/dashboard', icon: Triangle },
  { id: 'hotbed', label: 'Hot Bed', href: '/dashboard/hotbed', icon: Flame },
  { id: 'subscribers', label: 'Referallar', href: '/dashboard/subscribers', icon: Users },
  { id: 'transfer', label: 'Transfer & Çıxarış', href: '/dashboard/transfer', icon: ArrowLeftRight },
  { id: 'deposit', label: 'Depozit', href: '/dashboard/deposit', icon: Wallet },
  { id: 'history', label: 'USDT Tarixçə', href: '/dashboard/history', icon: History },
  { id: 'personalInfo', label: 'Şəxsi Məlumat', href: '/dashboard/personal-info', icon: User },
  { id: 'kyc', label: 'KYC', href: '/dashboard/kyc', icon: ShieldCheck },
];

export default function Sidebar({ userName, transferBalance, referralLink, onLogout }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { t, language } = useTranslation();
  const [copied, setCopied] = useState(false);

  const balance = user?.balance || 0;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  return (
    <aside className={styles.sidebar}>
      {/* Brand Logo */}
      <div className={styles.brand}>
        <Logo size={36} />
      </div>

      {/* User Info Card */}
      <div className={styles.userCard}>
        <div className={styles.greeting}>
          {t('hi', 'Hi')}: <span className={styles.name}>{userName || 'User'}</span>
        </div>
        
        <div className={styles.balances}>
          <div className={styles.balanceItem}>
            <span className={styles.balanceLabel}>{t('main_balance', 'Əsas Balans')}</span>
            <span className={styles.balanceValue}>{formatCurrency(balance)}</span>
          </div>
          <div className={styles.balanceItem}>
            <span className={styles.balanceLabel}>{t('transfer_balance', 'Transfer Balansı')}</span>
            <span className={styles.balanceValue}>{formatCurrency(transferBalance)}</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const translationKey = item.id === 'personalInfo' ? 'personal_info' : item.id === 'home' ? 'home' : item.id;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.navActive : ''}`}
            >
              <Icon size={18} />
              <span>{t(translationKey, item.label)}</span>
              {isActive && <span className={styles.activeIndicator} />}
            </Link>
          );
        })}

        {/* Admin Link (only shown if user is admin) */}
        {user?.role === 'admin' && (
          <Link
            href="/admin"
            className={`${styles.navItem} ${styles.adminLink}`}
          >
            <Shield size={18} color="var(--color-error)" />
            <span>{t('admin_panel', 'Admin Panel')}</span>
          </Link>
        )}
      </nav>

      {/* Referral Link & Logout */}
      <div className={styles.footer}>
        <div className={styles.refBox}>
          <div className={styles.refHeader}>
            <span className={styles.refTitle}>{t('your_ref_link', 'Referal Linkiniz')}</span>
            <button className={styles.copyBtn} onClick={handleCopyLink} aria-label="Kopyala">
              {copied ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
            </button>
          </div>
          <div className={styles.refLink} title={referralLink}>
            {user?.referralCode || ''}
          </div>
        </div>

        <div className={styles.footerButtons}>
          <LanguageToggle size={15} />
          <ThemeToggle size={18} className={styles.themeToggleSidebar} />
          <button className={styles.logoutBtn} onClick={onLogout}>
            <LogOut size={18} />
            <span>{t('logout', 'Çıxış')}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
