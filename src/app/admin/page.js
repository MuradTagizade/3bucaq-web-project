'use client';

import { useState, useEffect } from 'react';
import styles from './admin-dashboard.module.css';
import { Users, DollarSign, TrendingUp, ClipboardCheck, Wallet, ArrowDownToLine, ShieldCheck } from 'lucide-react';
import { getAdminStats } from '@/lib/supabase/database';
import { useTranslation } from '@/lib/store/languageStore';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getAdminStats();
        setStats(data);
      } catch (err) {
        console.error('Failed to load admin stats:', err.message);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

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

  const statItems = [
    { label: t('admin_stats.totalUsers', 'Ümumi İstifadəçi'), value: stats?.totalUsers || 0, icon: Users, color: 'var(--color-primary)' },
    { label: t('admin_stats.totalBalance', 'Ümumi Balans'), value: formatCurrency(stats?.totalBalance || 0), icon: DollarSign, color: 'var(--color-warning)' },
    { label: t('admin_stats.dailyGrowth', 'Gündəlik Artım'), value: `+${stats?.dailyGrowth || 0}`, icon: TrendingUp, color: 'var(--color-secondary)' },
    { label: t('admin_stats.pendingClaims', 'Gözləyən Claims'), value: stats?.pendingClaims || 0, icon: ClipboardCheck, color: 'var(--color-error)' },
    { label: t('admin_stats.pendingDeposits', 'Gözləyən Depozit'), value: stats?.pendingDeposits || 0, icon: Wallet, color: '#00E5FF' },
    { label: t('admin_stats.pendingWithdrawals', 'Gözləyən Çıxarış'), value: stats?.pendingWithdrawals || 0, icon: ArrowDownToLine, color: '#FF9100' },
    { label: t('admin_stats.pendingKYC', 'Gözləyən KYC'), value: stats?.pendingKYC || 0, icon: ShieldCheck, color: '#7C4DFF' },
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

      {/* Recent Users */}
      <h2 className={styles.sectionTitle}>{t('recent_signups', 'Son Qeydiyyatlar')}</h2>
      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span>{t('login', 'Login')}</span>
          <span>{t('email', 'Email')}</span>
          <span>{t('date', 'Tarix')}</span>
          <span>{t('package', 'Paket')}</span>
        </div>
        {stats?.recentUsers.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>{t('no_users_found', 'İstifadəçi tapılmadı')}</div>
        ) : (
          stats?.recentUsers.map((u) => (
            <div key={u.id} className={styles.tableRow}>
              <span className={styles.bold}>{u.display_login}</span>
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
