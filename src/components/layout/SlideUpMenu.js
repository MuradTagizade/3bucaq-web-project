'use client';

import styles from './SlideUpMenu.module.css';
import { useUIStore } from '@/lib/store/uiStore';
import { useTranslation } from '@/lib/store/languageStore';
import {
  KeyRound, History, Link2, LogOut, X, Copy, Share2,
  Wallet, Star, User, ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

export default function SlideUpMenu({ referralLink = '', referralUnlocked = false, onLogout }) {
  const { menuOpen, closeMenu } = useUIStore();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleShare = async () => {
    if (!referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'LEVEL UP - ' + t('referral_link', 'Referal Link'),
          text: t('join_platform', 'LEVEL UP platformasına qoşulun!'),
          url: referralLink,
        });
      } catch {
        // user cancelled
      }
    }
  };

  if (!menuOpen) return null;

  const menuLinks = [
    { href: '/dashboard/deposit', label: t('deposit', 'Depozit'), icon: Wallet },
    { href: '/dashboard/history', label: t('history', 'USDT Tarixçə'), icon: History },
    { href: '/dashboard/personal-info', label: t('personal_info', 'Şəxsi Məlumat'), icon: User },
    { href: '/dashboard/kyc', label: t('kyc', 'KYC'), icon: ShieldCheck },
  ];

  return (
    <>
      <div className={styles.overlay} onClick={closeMenu} />
      <div className={styles.menu}>
        <div className={styles.header}>
          <h3 className={styles.title}>{t('menu', 'Menyu')}</h3>
          <button className={styles.closeBtn} onClick={closeMenu}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.items}>
          {menuLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href} className={styles.item} onClick={closeMenu}>
                <Icon size={20} />
                <span>{link.label}</span>
              </Link>
            );
          })}

          <div className={styles.refSection}>
            <div className={styles.item} style={{ cursor: 'default' }}>
              <Link2 size={20} />
              <span>{t('referral_link', 'Referal Link')}</span>
            </div>
            {referralUnlocked ? (
              <div className={styles.refActions}>
                <div className={styles.refLink}>{referralLink || t('loading', 'Yüklənir...')}</div>
                <div className={styles.refBtns}>
                  <button className={styles.refBtn} onClick={handleCopy}>
                    <Copy size={16} />
                    {copied ? t('copied', 'Kopyalandı!') : t('copy', 'Kopyala')}
                  </button>
                  <button className={styles.refBtn} onClick={handleShare}>
                    <Share2 size={16} />
                    {t('share', 'Paylaş')}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.refActions}>
                <div className={styles.refLink}>
                  🔒 {t('referral_locked_short', 'Referal linki üçün paket alın')}
                </div>
              </div>
            )}
          </div>
          <div className={styles.divider} />
          <button className={`${styles.item} ${styles.logout}`} onClick={onLogout}>
            <LogOut size={20} />
            <span>{t('logout', 'Çıxış')}</span>
          </button>
        </div>
      </div>
    </>
  );
}
