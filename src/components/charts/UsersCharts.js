'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from './charts.module.css';
import { LineChart, HBarChart, StatusStackedBar, RangeSelect } from './Charts';
import { getAdminChartData, getReferralStats } from '@/lib/supabase/database';
import { useTranslation } from '@/lib/store/languageStore';

// İstifadəçilər səhifəsi üçün statistika bloku: köçürmə həcmi, xətt 1-5 üzrə
// referal qazancı və xallar, level/gündəlik bonus cəmləri, qeydiyyat + KYC.
export default function UsersCharts() {
  const { t } = useTranslation();
  const [range, setRange] = useState('30d');
  const [charts, setCharts] = useState(null);
  const [refStats, setRefStats] = useState(null);
  const [dim, setDim] = useState(false);

  const load = useCallback(async (r) => {
    setDim(true);
    try {
      const [c, s] = await Promise.all([getAdminChartData(r), getReferralStats(r)]);
      setCharts(c);
      setRefStats(s);
    } catch (err) {
      console.error('Users charts:', err.message);
    } finally {
      setDim(false);
    }
  }, []);

  useEffect(() => { load('30d'); }, [load]);

  if (!charts || !refStats) return null;

  const fmtUsd = (v) => `$${Number(v).toLocaleString('en-US')}`;
  const totals = refStats.totals || {};
  const kyc = charts.kyc_dist || {};
  const kycSegments = [
    { key: 'approved', label: t('kyc_seg_approved', 'Təsdiqlənib'), value: Number(kyc.approved || 0), color: 'var(--chart-good)' },
    { key: 'none', label: t('kyc_seg_none', 'Təqdim edilməyib'), value: Number(kyc.none || 0), color: 'var(--chart-neutral)' },
    { key: 'pending', label: t('kyc_seg_pending', 'Gözləyir'), value: Number(kyc.pending || 0), color: 'var(--chart-warn)' },
    { key: 'rejected', label: t('kyc_seg_rejected', 'Rədd edilib'), value: Number(kyc.rejected || 0), color: 'var(--chart-bad)' },
  ];

  const statRow = [
    { label: t('stat_transfer_total', 'Ümumi Köçürmə'), value: fmtUsd(refStats.transfers?.total || 0) },
    { label: t('stat_ref_total', 'Referal Qazancı'), value: fmtUsd(totals.ref_money_total || 0) },
    { label: t('stat_points_total', 'Qazanılan Xal'), value: Number(totals.points_total || 0).toFixed(1) },
    { label: t('stat_level_total', 'Level Bonusları'), value: fmtUsd(totals.level_bonus_total || 0) },
    { label: t('stat_daily_total', 'Gündəlik Qazanc'), value: fmtUsd(totals.daily_earning_total || 0) },
  ];

  const LINE_LABEL = t('ref_line_label', 'Xətt');

  return (
    <div className={styles.sectionCharts}>
      <RangeSelect value={range} onChange={(r) => { setRange(r); load(r); }} />
      <div style={{ opacity: dim ? 0.55 : 1, transition: 'opacity 0.2s' }}>
        <div className={styles.statRow}>
          {statRow.map((s) => (
            <div key={s.label} className={styles.statMini}>
              <span className={styles.statMiniValue}>{s.value}</span>
              <span className={styles.statMiniLabel}>{s.label}</span>
            </div>
          ))}
        </div>
        <div className={styles.grid2}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>{t('chart_transfer_title', 'Köçürmə Həcmi ($)')}</h3>
            <LineChart data={refStats.transfers_daily || []} valueKey="a" color="var(--chart-2)"
              valueLabel={t('transfer_label', 'Köçürmə')} formatValue={fmtUsd} height={170} />
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>{t('chart_regs_title', 'Yeni Qeydiyyatlar')}</h3>
            <LineChart data={charts.regs_daily || []} color="var(--chart-1)"
              valueLabel={t('chart_regs_value', 'Qeydiyyat')} height={170} />
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>{t('chart_ref_line_title', 'Referal Qazancı Xətt üzrə ($)')}</h3>
            <HBarChart
              items={(refStats.ref_money_by_line || []).map((x) => ({ label: `${LINE_LABEL} ${x.line}`, value: Number(x.amount) }))}
              color="var(--chart-1)" formatValue={fmtUsd} />
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>{t('chart_points_line_title', 'Xallar Xətt üzrə')}</h3>
            <HBarChart
              items={(refStats.points_by_line || []).map((x) => ({ label: `${LINE_LABEL} ${x.line}`, value: Number(x.points) }))}
              color="var(--chart-2)" />
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>{t('chart_kyc_title', 'KYC Statusu')}</h3>
            <StatusStackedBar segments={kycSegments} />
          </div>
        </div>
      </div>
    </div>
  );
}
