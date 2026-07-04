'use client';

import { useState, useEffect } from 'react';
import styles from '../admin-dashboard.module.css';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useTranslation } from '@/lib/store/languageStore';
import { CheckCircle2, XCircle, ArrowDownToLine, CreditCard, Wallet, Upload, Eye, FileText } from 'lucide-react';
import { getWithdrawals, approveWithdrawal, rejectWithdrawal, addAdminLog } from '@/lib/supabase/database';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';
import { useAuthStore } from '@/lib/store/authStore';
import SectionCharts from '@/components/charts/SectionCharts';
import { supabase } from '@/lib/supabase/config';

export default function AdminWithdrawalsPage() {
  const { user: adminUser } = useAuthStore();
  const { t } = useTranslation();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  
  // Approval modal state
  const [approveModal, setApproveModal] = useState({ open: false, withdrawal: null });
  const [txHash, setTxHash] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  // Receipt Modal viewer
  const [viewerReceiptUrl, setViewerReceiptUrl] = useState(null);

  async function load() {
    try {
      const data = await getWithdrawals();
      setWithdrawals(data);
    } catch (err) {
      console.error('Failed to load withdrawals:', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = withdrawals.filter((w) => w.status === tab);

  // Upload admin bank receipt to storage bucket.
  // Qəbz çıxarış SAHİBİNİN uid qovluğuna yüklənir — storage RLS istifadəçiyə
  // yalnız receipts/<öz-uid>/... yolunu oxumağa icazə verir.
  const uploadAdminReceipt = async (file, withdrawalId, ownerUid) => {
    const fileExt = file.name.split('.').pop();
    const filePath = `receipts/${ownerUid}/receipt_${withdrawalId}_${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .upload(filePath, file, { upsert: true });

    if (error) throw new Error(error.message);
    return data.path;
  };

  const handleApprove = async () => {
    const w = approveModal.withdrawal;
    if (!w) return;

    if (w.payment_method === 'usdt' && !txHash.trim()) {
      alert(t('tx_hash_required', 'Transaction Hash daxil edilməlidir.'));
      return;
    }

    if (w.payment_method === 'card' && !receiptFile) {
      alert(t('bank_receipt_desc', 'Bank çıxarışı (ekstrası) şəkli yüklənməlidir.'));
      return;
    }

    // Client tərəfdə fayl yoxlaması (bucket server tərəfdə də 5MB/şəkil tətbiq edir)
    if (receiptFile) {
      if (!receiptFile.type?.startsWith('image/')) {
        alert(t('file_must_be_image', 'Yalnız şəkil faylı yükləmək olar.'));
        return;
      }
      if (receiptFile.size > 5 * 1024 * 1024) {
        alert(t('file_too_large', 'Şəkil faylı maksimum 5MB ola bilər.'));
        return;
      }
    }

    setSubmitting(true);
    try {
      let receiptPath = null;
      if (receiptFile) {
        receiptPath = await uploadAdminReceipt(receiptFile, w.id, w.uid);
      }

      await approveWithdrawal(w.id, txHash || null, adminUser?.uid, receiptPath);
      
      // Admin Action log
      await addAdminLog(adminUser?.uid, 'approve_withdrawal', w.uid,
        `Approved withdrawal $${w.amount} to ${w.login} (${w.payment_method})`);
      
      alert(t('withdrawal_approved_success', 'Çıxarış sorğusu uğurla təsdiqləndi!'));

      await load();
      setApproveModal({ open: false, withdrawal: null });
      setTxHash('');
      setReceiptFile(null);
    } catch (err) {
      alert(t('error_prefix', 'Xəta: ') + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (withdrawal) => {
    setProcessingId(withdrawal.id);
    try {
      await rejectWithdrawal(withdrawal.id);
      await addAdminLog(adminUser?.uid, 'reject_withdrawal', withdrawal.uid,
        `Rejected withdrawal $${withdrawal.amount}. Refunded.`);
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
        <ArrowDownToLine size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
        {t('withdrawals', 'Çıxarışlar')}
      </h1>

      <SectionCharts kinds={['withdrawals_amount', 'withdrawals_count']} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['pending', 'done', 'rejected'].map((tVal) => (
          <button key={tVal} onClick={() => setTab(tVal)}
            style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: tab === tVal ? 600 : 400,
              background: tab === tVal ? 'rgba(124,77,255,0.1)' : 'var(--bg-secondary)',
              border: `1px solid ${tab === tVal ? 'var(--color-primary)' : 'var(--border-color)'}`,
              color: tab === tVal ? 'var(--color-primary)' : 'var(--text-secondary)', cursor: 'pointer',
            }}>
            {tVal === 'pending' ? `${t('claims_tabs.pending', 'Gözləyən')} (${withdrawals.filter((w) => w.status === 'pending').length})` :
              tVal === 'done' ? t('claims_tabs.done', 'Tamamlanan') : t('reject', 'Rədd')}
          </button>
        ))}
      </div>

      <div className={styles.table}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 2fr 1fr 0.8fr', padding: '12px 16px',
          background: 'var(--bg-secondary)', fontWeight: 700, fontSize: 11, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.06em', borderRadius: '8px 8px 0 0' }}>
          <span>{t('withdrawals_table_header.user', 'İstifadəçi')}</span>
          <span>{t('withdrawals_table_header.amount', 'Məbləğ')}</span>
          <span>{t('withdrawals_table_header.method', 'Metod')}</span>
          <span>{t('withdrawals_table_header.detail', 'Çıxarış Detalı')}</span>
          <span>{t('withdrawals_table_header.date', 'Tarix')}</span>
          <span></span>
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>{t('empty_table', 'Tapılmadı')}</div>
        )}
        {filtered.map((w) => (
          <div key={w.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 2fr 1fr 0.8fr',
            padding: '12px 16px', borderTop: '1px solid var(--border-color)', alignItems: 'center', fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>{w.login}</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(w.amount)}</span>
            <span>
              <Badge variant={w.payment_method === 'card' ? 'gold' : 'info'} size="sm">
                {w.payment_method === 'card' ? t('bank_card_manual', 'Bank Kartı') : 'USDT'}
              </Badge>
            </span>
            <span>
              {w.payment_method === 'card' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12 }}>Kart: {w.card_number}</span>
                  {w.status === 'done' && w.receipt_url && (
                    <button
                      type="button"
                      onClick={() => handleViewReceipt(w.receipt_url)}
                      style={{
                        border: 'none', background: 'none', padding: 0, margin: 0,
                        fontSize: 11, color: 'var(--color-primary)', textDecoration: 'underline',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      <Eye size={12} /> {t('view_receipt', 'Bank Qəbzi')}
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }} title={w.crypto_address}>
                    Ünvan: {w.crypto_address || '—'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    Şəbəkə: {w.network || 'TRC20'} {w.tx_hash ? `| TX: ${w.tx_hash.slice(0, 8)}...` : ''}
                  </span>
                </div>
              )}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDateTime(w.created_at)}</span>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {w.status === 'pending' && (
                <>
                  <button onClick={() => { setApproveModal({ open: true, withdrawal: w }); setTxHash(''); setReceiptFile(null); }}
                    disabled={processingId === w.id}
                    style={{ background: 'none', border: 'none', cursor: processingId === w.id ? 'not-allowed' : 'pointer', color: 'var(--color-success)', opacity: processingId === w.id ? 0.5 : 1 }}
                    title={t('approve_btn_title', 'Təsdiqlə')}>
                    <CheckCircle2 size={20} />
                  </button>
                  <button onClick={() => handleReject(w)}
                    disabled={processingId === w.id}
                    style={{ background: 'none', border: 'none', cursor: processingId === w.id ? 'not-allowed' : 'pointer', color: 'var(--color-error)', opacity: processingId === w.id ? 0.5 : 1 }}
                    title={t('reject_btn_title', 'Rədd et')}>
                    <XCircle size={20} />
                  </button>
                </>
              )}
              {w.status !== 'pending' && (
                <Badge variant={w.status === 'done' ? 'success' : 'error'} size="sm">
                  {w.status === 'done' ? t('completed', 'Tamamlandı') : t('rejected', 'Rədd edilib')}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Approve Modal */}
      <Modal isOpen={approveModal.open} onClose={() => setApproveModal({ open: false, withdrawal: null })}
        title={t('claim_approve_title', 'Çıxarışı Təsdiqlə')} size="sm">
        {approveModal.withdrawal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <p style={{ margin: '0 0 4px 0' }}>{t('user', 'İstifadəçi')}: <strong>{approveModal.withdrawal.login}</strong></p>
              <p style={{ margin: 0 }}>{t('amount', 'Məbləğ')}: <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(approveModal.withdrawal.amount)}</strong></p>
            </div>

            {approveModal.withdrawal.payment_method === 'usdt' ? (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all', margin: 0 }}>
                  {t('usdt_address', 'Ünvan')}: <strong>{approveModal.withdrawal.crypto_address} ({approveModal.withdrawal.network || 'TRC20'})</strong>
                </p>
                <Input
                  label="Transaction Hash"
                  placeholder="0x..."
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                />
              </>
            ) : (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                  {t('bank_card_manual', 'Bank Kartı')}: <strong style={{ fontFamily: 'monospace' }}>{approveModal.withdrawal.card_number}</strong>
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{t('bank_receipt_statement', 'Bank Qəbzi / Çıxarışı (Ekstrası)')}</span>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'var(--bg-secondary)',
                    border: '1px dashed var(--border-color)', borderRadius: 8, cursor: 'pointer'
                  }}>
                    <Upload size={16} color="var(--color-primary)" />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {receiptFile ? receiptFile.name : t('select_statement_image', 'Ekstra şəklini seçin...')}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setReceiptFile(e.target.files[0])}
                      hidden
                    />
                  </label>
                </div>
              </>
            )}

            <Button
              fullWidth
              size="lg"
              onClick={handleApprove}
              loading={submitting}
              disabled={
                approveModal.withdrawal.payment_method === 'usdt' ? !txHash.trim() : !receiptFile
              }
            >
              {t('approve_paid_btn', 'Təsdiqlə (Ödənildi)')}
            </Button>
          </div>
        )}
      </Modal>

      {/* Receipt Preview Modal */}
      <Modal
        isOpen={!!viewerReceiptUrl}
        onClose={() => setViewerReceiptUrl(null)}
        title={t('admin_payment_receipt', 'Admin Ödəniş Qəbzi')}
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
