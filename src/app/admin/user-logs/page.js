'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import styles from '../admin-dashboard.module.css';
import lStyles from './user-logs.module.css';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { Search, RefreshCw } from 'lucide-react';
import { useTranslation } from '@/lib/store/languageStore';
import { getUserActivity } from '@/lib/supabase/database';
import { formatDateTime } from '@/lib/utils/formatters';
import { LineChart } from '@/components/charts/Charts';

// Hərəkət növü → badge variantı və qrup
const ACTION_META = {
  registered:         { variant: 'info' },
  kyc_submitted:      { variant: 'warning' },
  kyc_approved:       { variant: 'success' },
  kyc_rejected:       { variant: 'error' },
  kyc_reset:          { variant: 'info' },
  profile_updated:    { variant: 'info' },
  blocked:            { variant: 'error' },
  unblocked:          { variant: 'success' },
  deposit_request:    { variant: 'info' },
  deposit:            { variant: 'success' },
  withdrawal_request: { variant: 'warning' },
  withdrawal:         { variant: 'warning' },
  transfer_out:       { variant: 'info' },
  transfer_in:        { variant: 'success' },
  package_purchase:   { variant: 'gold' },
  referral_bonus:     { variant: 'success' },
  depth_bonus:        { variant: 'success' },
  level_bonus:        { variant: 'gold' },
  level_bonus_claim:  { variant: 'gold' },
  daily_earning:      { variant: 'success' },
  points_earned:      { variant: 'info' },
  admin_adjust:       { variant: 'warning' },
};

const FILTER_ACTIONS = [
  'registered', 'kyc_submitted', 'kyc_approved', 'kyc_rejected', 'profile_updated',
  'blocked', 'unblocked', 'deposit_request', 'deposit', 'withdrawal_request',
  'transfer_out', 'transfer_in', 'package_purchase', 'referral_bonus', 'depth_bonus',
  'level_bonus', 'level_bonus_claim', 'daily_earning', 'points_earned', 'admin_adjust',
];

export default function AdminUserLogsPage() {
  const { t } = useTranslation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const load = useCallback(async (searchVal, actionVal) => {
    setLoading(true);
    try {
      const data = await getUserActivity(300, searchVal || null, actionVal || null);
      setEvents(data);
    } catch (err) {
      console.error('Failed to load user activity: ', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // İlk yükləmə dərhal; sonrakı axtarış/filtr dəyişikliklərində 400ms debounce
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      load('', '');
      return;
    }
    const id = setTimeout(() => { load(search.trim(), actionFilter); }, 400);
    return () => clearTimeout(id);
  }, [search, actionFilter, load]);

  // Gətirilən hadisələrdən günlük aktivlik seriyası (son 14 gün, lokal saat qurşağı)
  const dailySeries = useMemo(() => {
    const localKey = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const days = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = localKey(d);
      days.push({ key, d: key.slice(5), c: 0 });
    }
    const map = new Map(days.map((x) => [x.key, x]));
    events.forEach((e) => {
      if (!e.created_at) return;
      const bucket = map.get(localKey(new Date(e.created_at)));
      if (bucket) bucket.c += 1;
    });
    return days;
  }, [events]);

  const detailText = (e) => {
    const d = e.details || {};
    switch (e.action) {
      case 'transfer_out': return `→ ${d.to || '—'}`;
      case 'transfer_in': return `← ${d.from || '—'}`;
      case 'points_earned': return `${d.from || '—'} · ${d.package || ''} · L${d.line || '?'}`;
      case 'deposit_request':
      case 'withdrawal_request': return `${d.method || ''} ${d.network || ''} · ${d.status || ''}`.trim();
      case 'profile_updated': return (d.fields || []).join(', ');
      case 'kyc_submitted': case 'kyc_approved': case 'kyc_rejected': case 'kyc_reset':
        return `${d.from || '—'} → ${d.to || '—'}`;
      case 'blocked': return d.reason || '';
      case 'level_bonus_claim': return `LVL ${d.level || '?'}`;
      case 'registered': return d.user_code ? '' : '';
      default: return d.status || '';
    }
  };

  return (
    <div>
      <h1 className={styles.pageTitle}>{t('user_logs_title', 'İstifadəçi Logları')}</h1>
      <p className={lStyles.pageDesc}>
        {t('user_logs_desc', 'İstifadəçilərin bütün hərəkətləri: qeydiyyat, KYC, profil dəyişiklikləri, depozit/çıxarış sorğuları, köçürmələr, paket alışları, bonuslar və xallar.')}
      </p>

      <div className={styles.chartsGrid} style={{ gridTemplateColumns: '1fr' }}>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>{t('user_logs_chart_title', 'Hərəkət Aktivliyi (siyahıdakı hadisələr, gün üzrə)')}</h3>
          <LineChart data={dailySeries} color="var(--chart-1)" valueLabel={t('user_logs_chart_value', 'Hadisə')} height={150} />
        </div>
      </div>

      <div className={lStyles.filterRow}>
        <div className={lStyles.searchBox}>
          <Input
            placeholder={t('user_logs_search', 'İstifadəçi kodu ilə axtar...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search size={18} />}
          />
        </div>
        <select
          className={lStyles.actionSelect}
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">{t('all_actions', 'Bütün hərəkətlər')}</option>
          {FILTER_ACTIONS.map((a) => (
            <option key={a} value={a}>{t(`user_log_actions.${a}`, a)}</option>
          ))}
        </select>
        <button type="button" className={lStyles.refreshBtn} onClick={() => load(search.trim(), actionFilter)} title={t('refresh', 'Yenilə')}>
          <RefreshCw size={16} />
        </button>
      </div>

      <div className={styles.table}>
        <div className={lStyles.logHeader}>
          <span>{t('date', 'Tarix')}</span>
          <span>{t('user_code_col', 'Kod')}</span>
          <span>{t('action_col', 'Hərəkət')}</span>
          <span>{t('amount', 'Məbləğ')}</span>
          <span>{t('details_col', 'Detallar')}</span>
        </div>
        {loading ? (
          <div className={lStyles.empty}>{t('loading', 'Yüklənir...')}</div>
        ) : events.length === 0 ? (
          <div className={lStyles.empty}>{t('no_logs_found', 'Heç bir hadisə tapılmadı')}</div>
        ) : (
          events.map((e, i) => (
            <div key={`${e.created_at}-${e.user_code}-${e.action}-${i}`} className={lStyles.logRow}>
              <span className={lStyles.time}>{formatDateTime(e.created_at)}</span>
              <span className={styles.bold}>{e.user_code}</span>
              <span>
                <Badge variant={ACTION_META[e.action]?.variant || 'info'} size="sm">
                  {t(`user_log_actions.${e.action}`, e.action)}
                </Badge>
              </span>
              <span className={lStyles.amount}>
                {e.amount == null ? '—'
                  : e.action === 'points_earned' ? `${Number(e.amount)} P`
                  : `$${Number(e.amount).toLocaleString('en-US')}`}
              </span>
              <span className={lStyles.details}>{detailText(e)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
