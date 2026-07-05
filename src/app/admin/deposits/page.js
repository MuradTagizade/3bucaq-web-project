'use client';

import { useState, useEffect } from 'react';
import styles from '../admin-dashboard.module.css';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useTranslation } from '@/lib/store/languageStore';
import { CheckCircle2, XCircle, Wallet, CreditCard, Save, Eye, FileText, Image as ImageIcon } from 'lucide-react';
import { getDeposits, approveDeposit, rejectDeposit, addAdminLog } from '@/lib/supabase/database';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';
import { useAuthStore } from '@/lib/store/authStore';
import { supabase } from '@/lib/supabase/config';
import SectionCharts from '@/components/charts/SectionCharts';

export default function AdminDepositsPage() {
  const { user: adminUser } = useAuthStore();
  const { t } = useTranslation();
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [processingId, setProcessingId] = useState(null);

  // Removed admin deposit card config states (moved to /admin/wallets)

  // Receipt Modal viewer
  const [viewerReceiptUrl, setViewerReceiptUrl] = useState(null);

  async function load() {
    try {
      const data = await getDeposits();
      setDeposits(data);
    } catch (err) {
      console.error('Failed to load deposits:', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = deposits.filter((d) => d.status === tab);

  // Removed card config handlers (moved to /admin/wallets)

  const handleApprove = async (deposit) => {
    setProcessingId(deposit.id);
    try {
      await approveDeposit(deposit.id, adminUser?.uid);
      await addAdminLog(adminUser?.uid, 'approve_deposit', deposit.uid,
        `Approved deposit $${deposit.amount} from ${deposit.login}`);
      await load();
    } catch (err) {
      alert(t('error_prefix', 'Xəta: ') + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (deposit) => {
    setProcessingId(deposit.id);
    try {
      await rejectDeposit(deposit.id);
      await addAdminLog(adminUser?.uid, 'reject_deposit', deposit.uid,
        `Rejected deposit $${deposit.amount} from ${deposit.login}`);
      await load();
    } catch (err) {
      alert(t('error_prefix', 'Xəta: ') + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewReceipt = async (receiptPath) => {
    const { data, error } = await supabase.storage.from('kyc-documents').createSignedUrl(receiptPath, 3600);
    if (!error && data) setViewerReceiptUrl(data.signedUrl);
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px 0' }}>{t('loading', 'Yüklənir...')}</div>;
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>
        <Wallet size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
        {t('deposits', 'Depozitlər')}
      </h1>

      <SectionCharts kinds={['deposits_amount', 'deposits_count']} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['pending', 'approved', 'rejected'].map((tVal) => (
          <button key={tVal} onClick={() => setTab(tVal)}
            style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: tab === tVal ? 600 : 400,
              background: tab === tVal ? 'rgba(124,77,255,0.1)' : 'var(--bg-secondary)',
              border: `1px solid ${tab === tVal ? 'var(--color-primary)' : 'var(--border-color)'}`,
              color: tab === tVal ? 'var(--color-primary)' : 'var(--text-secondary)', cursor: 'pointer',
            }}>
            {tVal === 'pending' ? `${t('claims_tabs.pending', 'Gözləyən')} (${deposits.filter((d) => d.status === 'pending').length})` :
              tVal === 'approved' ? t('approved', 'Təsdiqlənən') : t('reject', 'Rədd')}
          </button>
        ))}
      </div>

      <div className={styles.table}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1.8fr 1fr 0.8fr', padding: '12px 16px',
          background: 'var(--bg-secondary)', fontWeight: 700, fontSize: 11, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.06em', borderRadius: '8px 8px 0 0' }}>
          <span>{t('deposits_table_header.user', 'İstifadəçi')}</span>
          <span>{t('deposits_table_header.amount', 'Məbləğ')}</span>
          <span>{t('deposits_table_header.method', 'Metod')}</span>
          <span>{t('deposits_table_header.detail', 'Ödəniş Detalı')}</span>
          <span>{t('deposits_table_header.date', 'Tarix')}</span>
          <span></span>
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>{t('empty_table', 'Tapılmadı')}</div>
        )}
        {filtered.map((d) => (
          <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1.8fr 1fr 0.8fr',
            padding: '12px 16px', borderTop: '1px solid var(--border-color)', alignItems: 'center', fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>{d.login}</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(d.amount)}</span>
            <span>
              <Badge variant={d.payment_method === 'card' ? 'gold' : 'info'} size="sm">
                {d.payment_method === 'card' ? t('bank_card_manual', 'Bank Kartı') : 'USDT'}
              </Badge>
            </span>
            <span>
              {d.payment_method === 'card' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12 }}>Kart: {d.card_number}</span>
                  {d.receipt_url && (
                    <button
                      type="button"
                      onClick={() => handleViewReceipt(d.receipt_url)}
                      style={{
                        border: 'none', background: 'none', padding: 0, margin: 0,
                        fontSize: 11, color: 'var(--color-primary)', textDecoration: 'underline',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      <Eye size={12} /> {t('view_receipt', 'Qəbzə bax')}
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('network', 'Network')}: {d.network || 'TRC20'}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }} title={d.tx_hash}>
                    TX: {d.tx_hash || '—'}
                  </span>
                </div>
              )}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDateTime(d.created_at)}</span>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {d.status === 'pending' && (
                <>
                  <button onClick={() => handleApprove(d)}
                    disabled={processingId === d.id}
                    style={{ background: 'none', border: 'none', cursor: processingId === d.id ? 'not-allowed' : 'pointer', color: 'var(--color-success)', opacity: processingId === d.id ? 0.5 : 1 }}
                    title={t('approve_btn_title', 'Təsdiqlə')}>
                    <CheckCircle2 size={20} />
                  </button>
                  <button onClick={() => handleReject(d)}
                    disabled={processingId === d.id}
                    style={{ background: 'none', border: 'none', cursor: processingId === d.id ? 'not-allowed' : 'pointer', color: 'var(--color-error)', opacity: processingId === d.id ? 0.5 : 1 }}
                    title={t('reject_btn_title', 'Rədd et')}>
                    <XCircle size={20} />
                  </button>
                </>
              )}
              {d.status !== 'pending' && (
                <Badge variant={d.status === 'approved' ? 'success' : 'error'} size="sm">
                  {d.status === 'approved' ? t('approved', 'Təsdiqləndi') : t('rejected', 'Rədd edilib')}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Receipt Preview Modal */}
      <Modal
        isOpen={!!viewerReceiptUrl}
        onClose={() => setViewerReceiptUrl(null)}
        title={t('deposit_receipt_title', 'Mədaxil Ödəniş Qəbzi')}
        size="md"
      >
        {viewerReceiptUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <img
              src={viewerReceiptUrl}
              alt="Receipt Preview"
              style={{ maxWidth: '100%', maxHeight: '420px', borderRadius: 8, objectFit: 'contain', border: '1px solid var(--border-color)' }}
            />
            <Button onClick={() => window.open(viewerReceiptUrl, '_blank')}>
              {t('view_full_screen', 'Tam Ekran Bax')}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
