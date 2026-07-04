'use client';

import { useState, useEffect } from 'react';
import styles from './admin-dashboard.module.css';
import { Users, DollarSign, TrendingUp, Wallet, ArrowDownToLine, ShieldCheck, Package, Star } from 'lucide-react';
import { getAdminStats, getAdminChartData } from '@/lib/supabase/database';
import { useTranslation } from '@/lib/store/languageStore';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { LineChart, DualBarChart, HBarChart, StatusStackedBar, RangeSelect } from '@/components/charts/Charts';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30d');
  const [chartsLoading, setChartsLoading] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    async function loadAll() {
      try {
        const [statsData, chartData] = await Promise.all([
          getAdminStats(),
          getAdminChartData('30d').catch((err) => { console.error('Chart data:', err.message); return null; }),
        ]);
        setStats(statsData);
        setCharts(chartData);
      } catch (err) {
        console.error('Failed to load admin stats:', err.message);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  const handleRangeChange = async (r) => {
    setRange(r);
    setChartsLoading(true);
    try {
      setCharts(await getAdminChartData(r));
    } catch (err) {
      console.error('Chart data:', err.message);
    } finally {
      setChartsLoading(false);
    }
  };

  const getActivePkgString = (pkgObj) => {
    if (!pkgObj) return t('no_package', 'Yoxdur');
    const list = [];
    if (pkgObj.pkg19) list.push('#19');
    if (pkgObj.pkg49) list.push('#49');
    if (pkgObj.pkg99) list.push('#99');
    if (pkgObj.pkg199) list.push('#199');
    if (pkgObj.pkg399) list.push('#399');
    if (pkgObj.pkg799) list.push('#799');
    return list.length > 0 ? list.join(', ') : t('no_package', 'Yoxdur');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <span>{t('loading', 'Yüklənir...')}</span>
      </div>
    );
  }

  const totals = charts?.totals || {};
  const statItems = [
    { label: t('admin_stats.totalUsers', 'Ümumi İstifadəçi'), value: stats?.totalUsers || 0, icon: Users, color: 'var(--color-primary)' },
    { label: t('admin_stats.totalBalance', 'Ümumi Balans'), value: formatCurrency(stats?.totalBalance || 0), icon: DollarSign, color: 'var(--color-warning)' },
    { label: t('admin_stats.dailyGrowth', 'Gündəlik Artım'), value: `+${stats?.dailyGrowth || 0}`, icon: TrendingUp, color: 'var(--color-secondary)' },
    { label: t('admin_stats.totalDeposits', 'Ümumi Depozit'), value: formatCurrency(totals.deposits_sum || 0), icon: Wallet, color: '#00E5FF' },
    { label: t('admin_stats.totalWithdrawals', 'Ümumi Çıxarış'), value: formatCurrency(totals.withdrawals_sum || 0), icon: ArrowDownToLine, color: '#FF9100' },
    { label: t('admin_stats.totalPoints', 'Ümumi Xal'), value: Number(totals.points_sum || 0).toFixed(1), icon: Star, color: '#7C4DFF' },
    { label: t('admin_stats.activePkgUsers', 'Paketli İstifadəçi'), value: totals.active_pkg_users || 0, icon: Package, color: 'var(--color-success)' },
    { label: t('admin_stats.pendingDeposits', 'Gözləyən Depozit'), value: stats?.pendingDeposits || 0, icon: Wallet, color: '#00E5FF' },
    { label: t('admin_stats.pendingWithdrawals', 'Gözləyən Çıxarış'), value: stats?.pendingWithdrawals || 0, icon: ArrowDownToLine, color: '#FF9100' },
    { label: t('admin_stats.pendingKYC', 'Gözləyən KYC'), value: stats?.pendingKYC || 0, icon: ShieldCheck, color: '#7C4DFF' },
  ];

  const PKG_LABELS = { pkg19: '#19', pkg49: '#49', pkg99: '#99', pkg199: '#199', pkg399: '#399', pkg799: '#799' };
  const TX_LABELS = t('tx_type_labels', {
    package_purchase: 'Paket alışı',
    referral_bonus: 'Referal bonusu',
    depth_bonus: 'Dərinlik bonusu',
    level_bonus: 'Level bonusu',
    daily_earning: 'Gündəlik qazanc',
    transfer: 'Köçürmə',
    deposit: 'Depozit',
    withdrawal: 'Çıxarış',
    admin_adjust: 'Admin düzəlişi',
  });

  const kyc = charts?.kyc_dist || {};
  const kycSegments = [
    { key: 'approved', label: t('kyc_seg_approved', 'Təsdiqlənib'), value: Number(kyc.approved || 0), color: 'var(--chart-good)' },
    { key: 'none', label: t('kyc_seg_none', 'Təqdim edilməyib'), value: Number(kyc.none || 0), color: 'var(--chart-neutral)' },
    { key: 'pending', label: t('kyc_seg_pending', 'Gözləyir'), value: Number(kyc.pending || 0), color: 'var(--chart-warn)' },
    { key: 'rejected', label: t('kyc_seg_rejected', 'Rədd edilib'), value: Number(kyc.rejected || 0), color: 'var(--chart-bad)' },
  ];

  return (
    <div>
      <h1 className={styles.pageTitle}>Admin Dashboard</h1>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        {statItems.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: `${stat.color}15`, color: stat.color }}>
                <Icon size={22} />
              </div>
              <div>
                <div className={styles.statValue}>{stat.value}</div>
                <div className={styles.statLabel}>{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts — dövr seçimi bütün aşağıdakı qrafiklərə şamildir */}
      {charts && (
        <>
          <RangeSelect value={range} onChange={handleRangeChange} />
          <div style={{ opacity: chartsLoading ? 0.55 : 1, transition: 'opacity 0.2s' }}>
            <div className={styles.chartsGrid}>
              <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>{t('chart_regs_title', 'Yeni Qeydiyyatlar')}</h3>
                <LineChart data={charts.regs_daily || []} color="var(--chart-1)" valueLabel={t('chart_regs_value', 'Qeydiyyat')} />
              </div>
              <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>{t('chart_money_title', 'Depozit / Çıxarış Həcmi ($)')}</h3>
                <DualBarChart
                  seriesA={charts.deposits_daily || []}
                  seriesB={charts.withdrawals_daily || []}
                  labelA={t('deposit', 'Depozit')}
                  labelB={t('withdrawal', 'Çıxarış')}
                  valueKey="a"
                  formatValue={(v) => `$${Number(v).toLocaleString('en-US')}`}
                />
              </div>
            </div>

            <div className={styles.chartsGrid3}>
              <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>{t('chart_activity_title', 'Əməliyyat Aktivliyi')}</h3>
                <LineChart data={charts.activity_daily || []} color="var(--chart-2)" valueLabel={t('chart_activity_value', 'Əməliyyat')} height={170} />
              </div>
              <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>{t('chart_pkg_title', 'Paket Paylanması')}</h3>
                <HBarChart
                  items={(charts.pkg_dist || []).map((p) => ({ label: PKG_LABELS[p.pkg] || p.pkg, value: p.c }))}
                  color="var(--chart-1)"
                />
              </div>
              <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>{t('chart_kyc_title', 'KYC Statusu')}</h3>
                <StatusStackedBar segments={kycSegments} />
              </div>
            </div>

            <div className={styles.chartsGrid}>
              <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>{t('chart_tx_title', 'Əməliyyat Növləri üzrə Həcm ($)')}</h3>
                <HBarChart
                  items={(charts.tx_types || []).map((x) => ({ label: TX_LABELS[x.type] || x.type, value: Number(x.a) }))}
                  color="var(--chart-2)"
                  formatValue={(v) => `$${Number(v).toLocaleString('en-US')}`}
                />
              </div>
              <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>{t('chart_tx_count_title', 'Əməliyyat Sayı üzrə')}</h3>
                <HBarChart
                  items={(charts.tx_types || []).map((x) => ({ label: TX_LABELS[x.type] || x.type, value: Number(x.c) }))}
                  color="var(--chart-1)"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Recent Users */}
      <h2 className={styles.sectionTitle}>{t('recent_signups', 'Son Qeydiyyatlar')}</h2>
      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span>{t('code', 'Kod')}</span>
          <span>{t('email', 'Email')}</span>
          <span>{t('date', 'Tarix')}</span>
          <span>{t('package', 'Paket')}</span>
        </div>
        {stats?.recentUsers.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>{t('no_users_found', 'İstifadəçi tapılmadı')}</div>
        ) : (
          stats?.recentUsers.map((u) => (
            <div key={u.id} className={styles.tableRow}>
              <span className={styles.bold}>{u.user_code}</span>
              <span>{u.email}</span>
              <span>{formatDate(u.created_at)}</span>
              <span className={styles.badge}>{getActivePkgString(u.active_packages)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
