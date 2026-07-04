'use client';

import { useState, useEffect } from 'react';
import styles from '../admin-dashboard.module.css';
import cStyles from './claims.module.css';
import Badge from '@/components/ui/Badge';
import { useTranslation } from '@/lib/store/languageStore';
import { formatDateTime } from '@/lib/utils/formatters';
import { getLevelClaims } from '@/lib/supabase/database';

// Səviyyə bonusları avtomatik balansa ödənilir (compact §9) — bu səhifə
// yalnız ödənilmiş bonusların tarixçəsini göstərir, təsdiq/rədd yoxdur.
export default function AdminBonusHistoryPage() {
  const { t } = useTranslation();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getLevelClaims();
        setClaims(data);
      } catch (err) {
        console.error('Failed to load bonus history: ', err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const STATUS_BADGES = {
    done: { variant: 'success', label: t('bonus_status.done', 'Ödənilib') },
    pending: { variant: 'warning', label: t('pending', 'Gözləyir') },
    rejected: { variant: 'error', label: t('rejected', 'Rədd edilib') },
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <span>{t('loading', 'Yüklənir...')}</span>
      </div>
    );
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>{t('claims', 'Bonus Tarixçəsi')}</h1>
      <p className={cStyles.pageDesc}>
        {t('bonus_history_desc', 'Səviyyə bonusları şərtlər dolduqda avtomatik olaraq istifadəçinin balansına ödənilir. Aşağıda bütün bonus ödənişlərinin tarixçəsi göstərilir.')}
      </p>

      <div className={styles.table}>
        <div className={cStyles.claimHeader}>
          <span>{t('claims_table_header.user', 'İstifadəçi')}</span>
          <span>{t('claims_table_header.level', 'Level')}</span>
          <span>{t('claims_table_header.bonus', 'Bonus')}</span>
          <span>{t('claims_table_header.date', 'Tarix')}</span>
          <span>{t('claims_table_header.type', 'Növ')}</span>
          <span>{t('claims_table_header.status', 'Status')}</span>
        </div>
        {claims.length === 0 && (
          <div className={cStyles.empty}>{t('no_claims_found', 'Hələ bonus ödənişi yoxdur')}</div>
        )}
        {claims.map((c) => {
          const badge = STATUS_BADGES[c.status] || STATUS_BADGES.pending;
          return (
            <div key={c.id} className={cStyles.claimRow}>
              <span className={styles.bold}>{c.login}</span>
              <span>LVL {c.level}</span>
              <span>${Number(c.bonus_amount).toLocaleString()}</span>
              <span>{formatDateTime(c.created_at)}</span>
              <span>
                <Badge variant={c.claim_type === 'balance' ? 'info' : 'gold'} size="sm">
                  {c.claim_type === 'balance' ? t('balance', 'Balans') : t('crypto', 'Kripto')}
                </Badge>
              </span>
              <span>
                <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
