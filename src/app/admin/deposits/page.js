'use client';

import { useState, useEffect } from 'react';
import styles from '../admin-dashboard.module.css';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useTranslation } from '@/lib/store/languageStore';
import { CheckCircle2, XCircle, Wallet, CreditCard, Save, Eye, FileText, Image as ImageIcon } from 'lucide-react';
import { getDeposits, approveDeposit, rejectDeposit, addAdminLog, getSystemSetting, updateSystemSetting } from '@/lib/supabase/database';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';
import { useAuthStore } from '@/lib/store/authStore';
import { supabase } from '@/lib/supabase/config';

export default function AdminDepositsPage() {
  const { user: adminUser } = useAuthStore();
  const { t } = useTranslation();
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  
  // Admin deposit card state
  const [depositCard, setDepositCard] = useState('');
  const [updatingCard, setUpdatingCard] = useState(false);
  const [isCardActive, setIsCardActive] = useState(false);
  const [updatingToggle, setUpdatingToggle] = useState(false);

  // Receipt Modal viewer
  const [viewerReceiptUrl, setViewerReceiptUrl] = useState(null);

  async function load() {
    try {
      const [data, activeCard, cardActiveSetting] = await Promise.all([
        getDeposits(),
        getSystemSetting('admin_deposit_card'),
        getSystemSetting('card_payment_active')
      ]);
      setDeposits(data);
      if (activeCard) {
        setDepositCard(activeCard);
      }
      setIsCardActive(cardActiveSetting === 'true');
    } catch (err) {
      console.error('Failed to load deposits:', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = deposits.filter((d) => d.status === tab);

  const handleUpdateCard = async () => {
    const cleanCard = depositCard.replace(/\s+/g, '');
    if (cleanCard.length !== 16 || isNaN(Number(cleanCard))) {
      alert(t('card_number_16_digit_err', 'Kart nömrəsi 16 rəqəmli olmalıdır.'));
      return;
    }
    setUpdatingCard(true);
    try {
      await updateSystemSetting('admin_deposit_card', cleanCard);
      await addAdminLog(adminUser?.uid, 'update_admin_deposit_card', null, `Admin deposit card updated to: ${cleanCard}`);
      alert(t('admin_deposit_card_updated', 'Mədaxil kart hesabı uğurla yeniləndi!'));
    } catch (err) {
      alert(t('error_prefix', 'Xəta: ') + err.message);
    } finally {
      setUpdatingCard(false);
    }
  };

  const handleToggleCardPayment = async () => {
    setUpdatingToggle(true);
    const newStatus = !isCardActive;
    try {
      await updateSystemSetting('card_payment_active', newStatus ? 'true' : 'false');
      await addAdminLog(
        adminUser?.uid,
        newStatus ? 'enable_card_payment' : 'disable_card_payment',
        null,
        `Admin ${newStatus ? 'enabled' : 'disabled'} card payments system-wide`
      );
      setIsCardActive(newStatus);
      const statusText = newStatus ? t('activate', 'aktiv edildi') : t('deactivate', 'deaktiv edildi');
      alert(t('card_payment_active_msg', 'Kart ilə ödəniş sistemi {{status}}!').replace('{{status}}', statusText));
    } catch (err) {
      alert(t('error_prefix', 'Xəta: ') + err.message);
    } finally {
      setUpdatingToggle(false);
    }
  };

  const handleApprove = async (deposit) => {
    try {
      await approveDeposit(deposit.id, adminUser?.uid);
      await addAdminLog(adminUser?.uid, 'approve_deposit', deposit.uid,
        `Approved deposit $${deposit.amount} from ${deposit.login}`);
      await load();
    } catch (err) {
      alert(t('error_prefix', 'Xəta: ') + err.message);
    }
  };

  const handleReject = async (deposit) => {
    try {
      await rejectDeposit(deposit.id);
      await addAdminLog(adminUser?.uid, 'reject_deposit', deposit.uid,
        `Rejected deposit $${deposit.amount} from ${deposit.login}`);
      await load();
    } catch (err) {
      alert(t('error_prefix', 'Xəta: ') + err.message);
    }
  };

  const handleViewReceipt = (receiptPath) => {
    const { data } = supabase.storage.from('kyc-documents').getPublicUrl(receiptPath);
    setViewerReceiptUrl(data.publicUrl);
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

      {/* Admin Deposit Card Configuration Card */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16,
        padding: 20, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card payment active toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{t('card_active_system', 'Kart ilə Ödəniş Sistemi')}</strong>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>{t('card_active_desc', 'Bütün istifadəçi profillərində kart ilə mədaxil və məxarici aktiv/deaktiv edin.')}</p>
            </div>
            <button
              onClick={handleToggleCardPayment}
              disabled={updatingToggle}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                background: isCardActive ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 23, 68, 0.1)',
                border: `1px solid ${isCardActive ? 'var(--color-success)' : 'var(--color-error)'}`,
                color: isCardActive ? 'var(--color-success)' : 'var(--color-error)',
                transition: 'all 0.2s ease',
              }}
            >
              {isCardActive ? t('deactivate', 'Deaktiv Et') : t('activate', 'Aktiv Et')}
            </button>
          </div>

          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12 }}>
              {t('deposit_card_setting', 'Mədaxil üçün Kart Hesabı Tənzimləməsi')}
            </h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 250px' }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{t('card_number_16_digit', '16 Rəqəmli Bank Kart Nömrəsi')}</label>
                <input
                  type="text"
                  value={depositCard}
                  maxLength={19}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
                    setDepositCard(formatted.slice(0, 19));
                  }}
                  placeholder="1234 5678 1234 5678"
                  style={{
                    width: '100%', height: 42, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    borderRadius: 8, padding: '0 12px', color: 'var(--text-primary)', outline: 'none', fontSize: 14, fontFamily: 'monospace'
                  }}
                />
              </div>
              <Button onClick={handleUpdateCard} loading={updatingCard}>
                <Save size={16} style={{ marginRight: 6 }} /> {t('save_btn', 'Yadda Saxla')}
              </Button>
            </div>
          </div>
        </div>
      </div>

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
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Şəbəkə: {d.network || 'TRC20'}</span>
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
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-success)' }}
                    title={t('approve_btn_title', 'Təsdiqlə')}>
                    <CheckCircle2 size={20} />
                  </button>
                  <button onClick={() => handleReject(d)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)' }}
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
