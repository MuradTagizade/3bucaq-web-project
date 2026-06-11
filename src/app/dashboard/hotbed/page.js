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
import { buyPackage, getUserByUid } from '@/lib/supabase/database';

export default function HotBedPage() {
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
      alert('Xəta baş verdi: ' + err.message);
    } finally {
      setConfirmModal({ open: false, pkg: null });
    }
  };

  return (
    <div className={styles.hotbed}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>
          <Flame size={22} color="var(--color-warning)" />
          Hot Bed Paketləri
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
                {pkg.type === 'earning' ? 'Qazanc' : 'Yatırım'}
              </Badge>
              <span className={styles.pkgDesc}>{pkg.description}</span>
            </div>
            {pkg.dailyEarning > 0 && (
              <div className={styles.dailyTag}>
                <Zap size={14} />
                Gündəlik {formatCurrency(pkg.dailyEarning)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Confirm Purchase Modal */}
      <Modal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, pkg: null })}
        title="Paketi Aktiv Edin?"
        size="sm"
      >
        {confirmModal.pkg && (
          <div className={styles.confirmContent}>
            <p>
              <strong>{confirmModal.pkg.displayName}</strong> paketini{' '}
              <span style={{ color: confirmModal.pkg.color }}>
                {formatCurrency(confirmModal.pkg.price)}
              </span>{' '}
              məbləğinə aktiv etmək istəyirsiniz?
            </p>
            <p className={styles.confirmNote}>
              Məbləğ əsas balansınızdan çıxılacaq.
            </p>
            <div className={styles.confirmActions}>
              <Button variant="ghost" onClick={() => setConfirmModal({ open: false, pkg: null })}>
                Xeyr
              </Button>
              <Button onClick={confirmPurchase}>
                Bəli
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Info Modal */}
      <Modal
        isOpen={infoModal}
        onClose={() => setInfoModal(false)}
        title="Paket Məlumatları"
        size="md"
      >
        <div className={styles.infoContent}>
          <h4>Yatırım Paketləri</h4>
          <p>Bu paketlər gündəlik qazanc vermir, lakin xal (point) qazandırır. Xallar level yüksəlmək və bonus qazanmaq üçün lazımdır.</p>

          <h4>Qazanc Paketləri</h4>
          <p>Bu paketlər həm xal, həm gündəlik dollar qazandırır. Qazanc Transfer balansına yığılır.</p>

          <div className={styles.infoTable}>
            <div className={styles.infoRow}>
              <span>Paket</span>
              <span>Point</span>
              <span>Gündəlik</span>
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
