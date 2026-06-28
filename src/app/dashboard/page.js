'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './dashboard.module.css';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { LEVELS, PACKAGES } from '@/lib/utils/constants';
import { formatUSDT, formatPoints, formatCurrency, getKYCStatusLabel, getKYCStatusVariant } from '@/lib/utils/formatters';
import { Trophy, ChevronRight, Lock, Check, Clock, Wallet, Copy, Shield, DollarSign, ArrowDownToLine, User } from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';
import { useTranslation } from '@/lib/store/languageStore';
import { createLevelClaim, getUserClaimedLevels, getUserByUid } from '@/lib/supabase/database';

export default function DashboardPage() {
  const [receiveModal, setReceiveModal] = useState({ open: false, level: null });
  const [toast, setToast] = useState(null);
  const [claimedLevels, setClaimedLevels] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const { t } = useTranslation();
  const { user: authUser, setUser } = useAuthStore();
  
  // Resolve authUser from store
  const user = {
    login: authUser?.displayLogin || 'User',
    balance: authUser?.balance || 0,
    totalPoints: authUser?.totalPoints || 0,
    currentLevel: authUser?.currentLevel || 0,
    referralCode: authUser?.referralCode || '',
    kycStatus: authUser?.kycStatus || 'none',
    activePackages: authUser?.activePackages || {
      pkg19: false, pkg49: false, pkg99: false,
      pkg199: false, pkg399: false, pkg799: false,
    },
  };

  useEffect(() => {
    const activeUser = useAuthStore.getState().user;
    async function loadClaimed() {
      if (!activeUser?.uid) return;
      try {
        const levels = await getUserClaimedLevels(activeUser.uid);
        setClaimedLevels(levels);
      } catch (err) {
        console.error('Failed to load claimed levels: ', err);
      }
    }
    loadClaimed();
  }, []);

  const checkLevelStatus = (level) => {
    const hasPoints = user.totalPoints >= level.points;
    const hasPackages = level.requiredPkgs.every((pkgId) => user.activePackages[pkgId] === true);
    const isClaimed = claimedLevels.includes(level.level);
    return { hasPoints, hasPackages, isReady: hasPoints && hasPackages && !isClaimed, isClaimed };
  };

  const handleReceiveClick = (level) => {
    const status = checkLevelStatus(level);
    if (status.isClaimed) {
      showToast(t('level_claimed_already', 'Bu səviyyə artıq istifadə olunub'));
      return;
    }
    if (!status.isReady) {
      showToast(t('requirements_not_met', 'Şərtlər yerinə yetirilməyib'));
      return;
    }
    setReceiveModal({ open: true, level });
  };

  const handleSubmitClaim = async () => {
    const activeUser = useAuthStore.getState().user;
    if (!receiveModal.level || !activeUser?.uid) return;

    setSubmitting(true);
    try {
      await createLevelClaim(
        activeUser.uid,
        receiveModal.level.level,
        receiveModal.level.bonus,
        'balance'
      );

      // Fetch updated user profile and update Zustand store
      const updatedProfile = await getUserByUid(activeUser.uid);
      if (updatedProfile) {
        setUser({
          ...activeUser,
          balance: Number(updatedProfile.balance),
          totalPoints: Number(updatedProfile.total_points),
          currentLevel: Number(updatedProfile.current_level),
          claimedLevels: updatedProfile.claimed_levels || [],
        });
      }

      setClaimedLevels((prev) => [...prev, receiveModal.level.level]);
      setReceiveModal({ open: false, level: null });

      const successMsg = t('bonus_added_to_balance', '{{bonus}} balansınıza əlavə edildi!')
        .replace('{{bonus}}', formatUSDT(receiveModal.level.bonus));
      showToast(successMsg);
    } catch (err) {
      showToast(t('error', 'Xəta') + ': ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const getRequiredPackageNames = (requiredPkgs) => {
    return requiredPkgs
      .map((id) => PACKAGES.find((p) => p.id === id)?.displayName)
      .filter(Boolean)
      .join(', ');
  };

  const referralLink = `https://levelup.com/register?ref=${user.referralCode}`;

  const handleCopyRef = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      showToast(t('copied', 'Kopyalandı!'));
    } catch (err) {
      showToast(t('error', 'Xəta') + ': ' + err.message);
    }
  };

  return (
    <div className={styles.dashboard}>
      {/* Welcome Card */}
      <div className={styles.welcomeCard}>
        <div className={styles.welcomeHeader}>
          <div>
            <h2 className={styles.welcomeTitle}>{t('welcome_back', 'Xoş Gəldiniz')}, {user.login}!</h2>
            <span className={styles.kycBadge}>
              KYC: <span className={styles[getKYCStatusVariant(user.kycStatus)]}>{getKYCStatusLabel(user.kycStatus, t)}</span>
            </span>
          </div>
        </div>
        <div className={styles.balanceRow}>
          <div className={styles.balanceBox}>
            <span className={styles.balanceLabel}>{t('balance', 'Balans')}</span>
            <span className={styles.balanceAmount}>{formatCurrency(user.balance)}</span>
          </div>
          <Link href="/dashboard/personal-info" className={`${styles.balanceBox} ${styles.balanceBoxLink}`}>
            <span className={styles.balanceLabel} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span>{t('personal_info', 'Şəxsi Məlumat')}</span>
              <User size={16} color="var(--color-secondary)" />
            </span>
            <span className={styles.balanceLinkText}>
              {t('manage_profile', 'Hesabı İdarə Et')} →
            </span>
          </Link>
        </div>
        <div className={styles.refRow}>
          <span className={styles.refLabel}>{t('referral_code', 'Referal Kodu')}: {user.referralCode}</span>
          <button className={styles.refCopyBtn} onClick={handleCopyRef}>
            <Copy size={14} /> {t('copy', 'Kopyala')}
          </button>
        </div>
      </div>

      {/* Points Summary */}
      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon}>
            <Trophy size={24} />
          </div>
          <div>
            <div className={styles.summaryLabel}>{t('total_points_label', 'Ümumi Xallar')}</div>
            <div className={styles.summaryValue}>{Number(user.totalPoints).toFixed(1)}</div>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryIcon} style={{ background: 'rgba(124,77,255,0.12)' }}>
            <Shield size={24} color="var(--color-accent)" />
          </div>
          <div>
            <div className={styles.summaryLabel}>{t('active_packages', 'Aktiv Paketlər')}</div>
            <div className={styles.summaryValue}>
              {Object.values(user.activePackages).filter(Boolean).length} / 6
            </div>
          </div>
        </div>
      </div>

      {/* Level Table */}
      <h2 className={styles.sectionTitle}>{t('withdrawal_levels', 'Çıxarış Səviyyələri')}</h2>
      <div className={styles.levelList}>
        {LEVELS.map((level) => {
          const status = checkLevelStatus(level);
          const progressPercent = Math.min(
            (user.totalPoints / level.points) * 100,
            100
          );

          return (
            <div
              key={level.level}
              className={`${styles.levelCard} ${status.isReady ? styles.levelReady : ''} ${status.isClaimed ? styles.levelClaimed : ''}`}
            >
              <div className={styles.levelHeader}>
                <div className={styles.levelBadge}>
                  <span className={styles.levelNum}>LVL {level.level}</span>
                </div>
                <div className={styles.levelBonus}>
                  {formatUSDT(level.bonus)}
                </div>
              </div>

              {/* Progress */}
              <div className={styles.progressSection}>
                <div className={styles.progressLabel}>
                  {formatPoints(user.totalPoints, level.points)}
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Required Packages */}
              {level.requiredPkgs.length > 0 && (
                <div className={styles.reqPkgs}>
                  {!status.hasPackages ? (
                    <Lock size={12} />
                  ) : (
                    <Check size={12} color="var(--color-success)" />
                  )}
                  <span>
                    {t('required', 'Tələb')}: {getRequiredPackageNames(level.requiredPkgs)}
                  </span>
                </div>
              )}

              {/* Action */}
              <div className={styles.levelAction}>
                {status.isClaimed ? (
                  <Badge variant="success" size="sm">{t('claimed', 'İstifadə olunub')} ✓</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant={status.isReady ? 'primary' : 'ghost'}
                    onClick={() => handleReceiveClick(level)}
                    disabled={!status.isReady}
                  >
                    {status.isReady ? t('receive', 'Bonus Al') : t('locked', 'Kilidli')}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Receive Modal */}
      <Modal
        isOpen={receiveModal.open}
        onClose={() => setReceiveModal({ open: false, level: null })}
        title={t('claim_level_bonus', 'Səviyyə Bonusunu Al')}
        size="sm"
      >
        {receiveModal.level && (
          <div className={styles.receiveModal}>
            <div className={styles.receiveInfo}>
              <Trophy size={20} color="var(--color-warning)" />
              <span>LVL {receiveModal.level.level} — {formatUSDT(receiveModal.level.bonus)}</span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '16px 0', textAlign: 'center' }}>
              {t('claim_modal_desc', 'Bu səviyyəni aktiv etmək istəyirsiniz? Səviyyə üçün tələb olunan {{points}} point balansınızdan çıxılacaq və {{bonus}} bonus dərhal USDT balansınıza əlavə olunacaq.')
                .replace('{{points}}', receiveModal.level.points)
                .replace('{{bonus}}', formatUSDT(receiveModal.level.bonus))}
            </p>
            <Button
              fullWidth
              size="lg"
              onClick={handleSubmitClaim}
              loading={submitting}
            >
              {t('confirm_and_activate', 'Təsdiqlə və Aktiv Et')}
            </Button>
          </div>
        )}
      </Modal>

      {/* Toast */}
      {toast && (
        <div className={styles.toast}>
          {toast}
        </div>
      )}
    </div>
  );
}
