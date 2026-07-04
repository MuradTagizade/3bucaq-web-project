'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from './charts.module.css';
import { LineChart, StatusStackedBar, RangeSelect } from './Charts';
import { getAdminChartData } from '@/lib/supabase/database';
import { useTranslation } from '@/lib/store/languageStore';

// Admin alt səhifələri üçün hazır qrafik bloku: dövr seçimi + istənilən kartlar.
// kinds: 'deposits_amount' | 'deposits_count' | 'withdrawals_amount' |
//        'withdrawals_count' | 'regs' | 'kyc'
export default function SectionCharts({ kinds = [] }) {
  const { t } = useTranslation();
  const [range, setRange] = useState('30d');
  const [charts, setCharts] = useState(null);
  const [dim, setDim] = useState(false);

  const load = useCallback(async (r) => {
    setDim(true);
    try {
      setCharts(await getAdminChartData(r));
    } catch (err) {
      console.error('Chart data:', err.message);
    } finally {
      setDim(false);
    }
  }, []);

  useEffect(() => { load('30d'); }, [load]);

  if (!charts) return null;

  const fmtUsd = (v) => `$${Number(v).toLocaleString('en-US')}`;
  const kyc = charts.kyc_dist || {};
  const kycSegments = [
    { key: 'approved', label: t('kyc_seg_approved', 'Təsdiqlənib'), value: Number(kyc.approved || 0), color: 'var(--chart-good)' },
    { key: 'none', label: t('kyc_seg_none', 'Təqdim edilməyib'), value: Number(kyc.none || 0), color: 'var(--chart-neutral)' },
    { key: 'pending', label: t('kyc_seg_pending', 'Gözləyir'), value: Number(kyc.pending || 0), color: 'var(--chart-warn)' },
    { key: 'rejected', label: t('kyc_seg_rejected', 'Rədd edilib'), value: Number(kyc.rejected || 0), color: 'var(--chart-bad)' },
  ];

  const CARDS = {
    deposits_amount: {
      title: t('chart_dep_amount', 'Depozit Həcmi ($)'),
      el: <LineChart data={charts.deposits_daily || []} valueKey="a" color="var(--chart-1)" valueLabel={t('deposit', 'Depozit')} formatValue={fmtUsd} height={170} />,
    },
    deposits_count: {
      title: t('chart_dep_count', 'Depozit Sayı'),
      el: <LineChart data={charts.deposits_daily || []} valueKey="c" color="var(--chart-1)" valueLabel={t('deposit', 'Depozit')} height={170} />,
    },
    withdrawals_amount: {
      title: t('chart_wd_amount', 'Çıxarış Həcmi ($)'),
      el: <LineChart data={charts.withdrawals_daily || []} valueKey="a" color="var(--chart-2)" valueLabel={t('withdrawal', 'Çıxarış')} formatValue={fmtUsd} height={170} />,
    },
    withdrawals_count: {
      title: t('chart_wd_count', 'Çıxarış Sayı'),
      el: <LineChart data={charts.withdrawals_daily || []} valueKey="c" color="var(--chart-2)" valueLabel={t('withdrawal', 'Çıxarış')} height={170} />,
    },
    regs: {
      title: t('chart_regs_title', 'Yeni Qeydiyyatlar'),
      el: <LineChart data={charts.regs_daily || []} color="var(--chart-1)" valueLabel={t('chart_regs_value', 'Qeydiyyat')} height={170} />,
    },
    kyc: {
      title: t('chart_kyc_title', 'KYC Statusu'),
      el: <StatusStackedBar segments={kycSegments} />,
    },
  };

  return (
    <div className={styles.sectionCharts}>
      <RangeSelect value={range} onChange={(r) => { setRange(r); load(r); }} />
      <div className={styles.grid2} style={{ opacity: dim ? 0.55 : 1, transition: 'opacity 0.2s' }}>
        {kinds.map((k) => (CARDS[k] ? (
          <div key={k} className={styles.card}>
            <h3 className={styles.cardTitle}>{CARDS[k].title}</h3>
            {CARDS[k].el}
          </div>
        ) : null))}
      </div>
    </div>
  );
}
