'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './hotbed.module.css';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { PACKAGES } from '@/lib/utils/constants';
import { formatCurrency } from '@/lib/utils/formatters';
import { Info, Flame, Zap, Clock } from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';
import { useTranslation } from '@/lib/store/languageStore';
import { buyPackage, getUserByUid } from '@/lib/supabase/database';

export default function HotBedPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user: authUser, setUser } = useAuthStore();
  const [confirmModal, setConfirmModal] = useState({ open: false, pkg: null });
  const [insufficientModal, setInsufficientModal] = useState({ open: false, pkg: null });
  const [infoModal, setInfoModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const packages = authUser?.activePackages || {
    pkg19: false,
    pkg49: false,
    pkg99: false,
    pkg199: false,
    pkg399: false,
    pkg799: false,
  };

  const activatedAt = authUser?.packageActivatedAt || {};

  const getDaysRemaining = (pkgId) => {
    const activationDate = activatedAt[pkgId];
    if (!activationDate) return null;

    const pkg = PACKAGES.find((p) => p.id === pkgId);
    if (!pkg || !pkg.expiryDays) return null;

    const activated = new Date(activationDate);
    const unlockDate = new Date(activated.getTime() + pkg.expiryDays * 24 * 60 * 60 * 1000);
    const now = new Date();
    const remaining = Math.ceil((unlockDate - now) / (1000 * 60 * 60 * 24));

    return remaining;
  };

  const handleToggle = (pkg) => {
    if (packages[pkg.id]) return; // Cannot buy active packages
    setConfirmModal({ open: true, pkg });
  };

  const refreshUser = async () => {
    const updatedProfile = await getUserByUid(authUser.uid);
    if (updatedProfile) {
      setUser({
        ...authUser,
        balance: Number(updatedProfile.balance),
        totalPoints: Number(updatedProfile.total_points),
        activePackages: {
          pkg19: updatedProfile.active_packages?.pkg19 || false,
          pkg49: updatedProfile.active_packages?.pkg49 || false,
          pkg99: updatedProfile.active_packages?.pkg99 || false,
          pkg199: updatedProfile.active_packages?.pkg199 || false,
          pkg399: updatedProfile.active_packages?.pkg399 || false,
          pkg799: updatedProfile.active_packages?.pkg799 || false,
        },
        packageActivatedAt: updatedProfile.package_activated_at || {},
      });
    }
  };

  const confirmPurchase = async () => {
    if (!confirmModal.pkg || !authUser) return;

    // Client-side balance check
    const balance = authUser.balance || 0;
    if (balance < confirmModal.pkg.price) {
      const pkg = confirmModal.pkg;
      setConfirmModal({ open: false, pkg: null });
      setInsufficientModal({ open: true, pkg });
      return;
    }

    setLoading(true);
    try {
      await buyPackage(authUser.uid, confirmModal.pkg.id, confirmModal.pkg.price);
      await refreshUser();
      setConfirmModal({ open: false, pkg: null });
    } catch (err) {
      const errMsg = err.message || '';
      if (errMsg.includes('kifayət etmir') || errMsg.includes('balance') || errMsg.includes('insufficient')) {
        const pkg = confirmModal.pkg;
        setConfirmModal({ open: false, pkg: null });
        setInsufficientModal({ open: true, pkg });
      } else {
        alert(t('error_occurred', 'Xəta baş verdi') + ': ' + err.message);
        setConfirmModal({ open: false, pkg: null });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.hotbed}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>
          <Flame size={22} color="var(--color-warning)" />
          {t('hotbed_packages', 'Hot Bed Paketləri')}
        </h2>
        <button className={styles.infoBtn} onClick={() => setInfoModal(true)}>
          <Info size={20} />
        </button>
      </div>

      <div className={styles.packageList}>
        {PACKAGES.map((pkg) => {
          const isActive = packages[pkg.id];
          const daysLeft = getDaysRemaining(pkg.id);

          return (
            <div
              key={pkg.id}
              className={`${styles.packageCard} ${isActive ? styles.active : ''}`}
            >
              <div className={styles.pkgHeader}>
                <div className={styles.pkgPrice} style={{ color: pkg.color }}>
                  {formatCurrency(pkg.price)}
                </div>
              </div>
              <div className={styles.pkgInfo}>
                <Badge variant={pkg.type === 'earning' ? 'gold' : 'info'} size="sm">
                  {pkg.type === 'earning' ? t('earning', 'Qazanc') : t('investment', 'Yatırım')}
                </Badge>
                <span className={styles.pkgDesc}>{t(pkg.id + '_desc', pkg.description)}</span>
              </div>
              {pkg.dailyEarning > 0 && (
                <div className={styles.dailyTag}>
                  <Zap size={14} />
                  {t('daily_gain', 'Gündəlik')} {formatCurrency(pkg.dailyEarning)}
                </div>
              )}

              {/* Expiry / Remaining Time */}
              {isActive && daysLeft !== null && daysLeft > 0 && (
                <div className={styles.lockStatus}>
                  <Clock size={13} />
                  <span>{daysLeft} {t('days_remaining', 'gün qalıb')}</span>
                </div>
              )}

              {/* Buy / Active Button */}
              <div className={styles.pkgAction} style={{ marginTop: 'auto' }}>
                {isActive ? (
                  <Button
                    variant="ghost"
                    disabled={true}
                    fullWidth
                    style={{
                      borderColor: 'rgba(0, 255, 163, 0.2)',
                      background: 'rgba(0, 255, 163, 0.05)',
                      color: 'var(--color-success)',
                      cursor: 'not-allowed',
                      opacity: 0.9
                    }}
                  >
                    {t('active', 'Aktivdir')}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => handleToggle(pkg)}
                    fullWidth
                  >
                    {t('buy_package', 'Satın Al')}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm Purchase Modal */}
      <Modal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, pkg: null })}
        title={t('confirm_purchase_title', 'Paketi Aktiv Edin?')}
        size="sm"
      >
        {confirmModal.pkg && (
          <div className={styles.confirmContent}>
            <p>
              {t('confirm_purchase_desc', '{{package}} paketini {{price}} məbləğinə aktiv etmək istəyirsiniz?')
                .replace('{{package}}', confirmModal.pkg.displayName)
                .replace('{{price}}', formatCurrency(confirmModal.pkg.price))}
            </p>
            <p className={styles.confirmNote}>
              {t('price_deducted_from_balance', 'Məbləğ əsas balansınızdan çıxılacaq.')}
            </p>
            <p className={styles.confirmNote}>
              <Clock size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
              {' '}
              {confirmModal.pkg.expiryDays 
                ? t('lock_period_info', 'Müddət: {{days}} gün').replace('{{days}}', confirmModal.pkg.expiryDays)
                : t('lifetime_info', 'Müddət: Ömürlük')
              }
            </p>
            <div className={styles.confirmActions}>
              <Button variant="ghost" onClick={() => setConfirmModal({ open: false, pkg: null })}>
                {t('no', 'Xeyr')}
              </Button>
              <Button onClick={confirmPurchase} loading={loading}>
                {t('yes', 'Bəli')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Insufficient Balance Modal */}
      <Modal
        isOpen={insufficientModal.open}
        onClose={() => setInsufficientModal({ open: false, pkg: null })}
        title={t('insufficient_balance_title', 'Balans Kifayət Etmir')}
        size="sm"
      >
        {insufficientModal.pkg && (
          <div className={styles.confirmContent}>
            <p style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
              {t('insufficient_balance_desc', 'Balansınızda kifayət qədər məbləğ yoxdur. Zəhmət olmasa balansa depozit əlavə edin.')}
            </p>
            <div className={styles.confirmActions} style={{ gridTemplateColumns: '1fr' }}>
              <Button onClick={() => {
                setInsufficientModal({ open: false, pkg: null });
                router.push('/dashboard/deposit');
              }}>
                {t('go_to_deposit', 'Depozit edin')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Info Modal */}
      <Modal
        isOpen={infoModal}
        onClose={() => setInfoModal(false)}
        title={t('package_info_title', 'Paket Məlumatları')}
        size="md"
      >
        <div className={styles.infoContent}>
          <h4>{t('investment_packages', 'Yatırım Paketləri')}</h4>
          <p>{t('pkg_desc_invest', 'Bu paketlər gündəlik qazanc vermir, lakin xal (point) qazandırır. Xallar level yüksəlmək və bonus qazanmaq üçün lazımdır.')}</p>

          <h4>{t('earning_packages', 'Qazanc Paketləri')}</h4>
          <p>{t('pkg_desc_earn', 'Bu paketlər həm xal, həm gündəlik dollar qazandırır. Qazanc balansınıza əlavə olunur.')}</p>

          <h4>{t('lock_info_title', 'Paket Müddətləri')}</h4>
          <p>{t('lock_info_desc_updated', 'Yatırım paketləri (#19-#199) bir dəfə alınır və ömürlük (süresiz) aktiv qalır. Qazanc paketləri (#399-#799) isə 120 gün aktiv qalır və müddət bitdikdən sonra yenidən alınmalıdır.')}</p>

          <div className={styles.infoTable}>
            <div className={styles.infoRow}>
              <span>{t('package', 'Paket')}</span>
              <span>{t('points', 'Point')}</span>
              <span>{t('daily', 'Gündəlik')}</span>
              <span>{t('lock_days', 'Müddət')}</span>
            </div>
            {PACKAGES.map((pkg) => (
              <div key={pkg.id} className={styles.infoRow}>
                <span style={{ color: pkg.color }}>{pkg.displayName}</span>
                <span>{pkg.points > 0 ? pkg.points : '-'}</span>
                <span>{pkg.dailyEarning > 0 ? formatCurrency(pkg.dailyEarning) : '-'}</span>
                <span>{pkg.expiryDays ? `${pkg.expiryDays} ${t('days_short', 'gün')}` : t('lifetime', 'Ömürlük')}</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
