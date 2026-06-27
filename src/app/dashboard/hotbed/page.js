'use client';

import { useState } from 'react';
import styles from './hotbed.module.css';
import Toggle from '@/components/ui/Toggle';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { PACKAGES } from '@/lib/utils/constants';
import { formatCurrency } from '@/lib/utils/formatters';
import { Info, Flame, Zap } from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';
import { useTranslation } from '@/lib/store/languageStore';
import { buyPackage, getUserByUid } from '@/lib/supabase/database';

export default function HotBedPage() {
  const { t } = useTranslation();
  const { user: authUser, setUser } = useAuthStore();
  const [confirmModal, setConfirmModal] = useState({ open: false, pkg: null });
  const [infoModal, setInfoModal] = useState(false);

  const packages = authUser?.activePackages || {
    pkg19: false,
    pkg49: false,
    pkg99: false,
    pkg199: false,
    pkg399: false,
    pkg799: false,
  };

  const handleToggle = (pkg) => {
    if (packages[pkg.id]) return; // Can't turn off
    setConfirmModal({ open: true, pkg });
  };

  const confirmPurchase = async () => {
    if (!confirmModal.pkg || !authUser) return;
    try {
      await buyPackage(authUser.uid, confirmModal.pkg.id, confirmModal.pkg.price);
      
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
    } catch (err) {
      alert(t('error_occurred', 'Xəta baş verdi') + ': ' + err.message);
    } finally {
      setConfirmModal({ open: false, pkg: null });
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
        {PACKAGES.map((pkg) => (
          <div
            key={pkg.id}
            className={`${styles.packageCard} ${packages[pkg.id] ? styles.active : ''}`}
          >
            <div className={styles.pkgHeader}>
              <div className={styles.pkgPrice} style={{ color: pkg.color }}>
                {formatCurrency(pkg.price)}
              </div>
              <Toggle
                checked={packages[pkg.id]}
                onChange={() => handleToggle(pkg)}
                label
              />
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
          </div>
        ))}
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
            <div className={styles.confirmActions}>
              <Button variant="ghost" onClick={() => setConfirmModal({ open: false, pkg: null })}>
                {t('no', 'Xeyr')}
              </Button>
              <Button onClick={confirmPurchase}>
                {t('yes', 'Bəli')}
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
          <p>{t('pkg_desc_earn', 'Bu paketlər həm xal, həm gündəlik dollar qazandırır. Qazanc Transfer balansına yığılır.')}</p>

          <div className={styles.infoTable}>
            <div className={styles.infoRow}>
              <span>{t('package', 'Paket')}</span>
              <span>{t('points', 'Point')}</span>
              <span>{t('daily', 'Gündəlik')}</span>
            </div>
            {PACKAGES.map((pkg) => (
              <div key={pkg.id} className={styles.infoRow}>
                <span style={{ color: pkg.color }}>{pkg.displayName}</span>
                <span>{pkg.points > 0 ? pkg.points : '-'}</span>
                <span>{pkg.dailyEarning > 0 ? formatCurrency(pkg.dailyEarning) : '-'}</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
