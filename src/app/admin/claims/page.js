'use client';

import { useState, useEffect } from 'react';
import styles from '../admin-dashboard.module.css';
import cStyles from './claims.module.css';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from '@/lib/store/languageStore';
import { getLevelClaims, approveClaim, rejectClaim, addAdminLog } from '@/lib/supabase/database';
import { useAuthStore } from '@/lib/store/authStore';

export default function AdminClaimsPage() {
  const { user: adminUser } = useAuthStore();
  const { t } = useTranslation();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approveModal, setApproveModal] = useState({ open: false, claim: null });
  const [txHash, setTxHash] = useState('');
  const [tab, setTab] = useState('pending');
  const [processingId, setProcessingId] = useState(null);

  async function loadClaims() {
    try {
      const data = await getLevelClaims();
      setClaims(data);
    } catch (err) {
      console.error('Failed to load claims: ', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClaims();
  }, []);

  const filtered = claims.filter((c) => c.status === tab);

  const handleApprove = async () => {
    if (!txHash.trim() || !approveModal.claim) return;
    try {
      await approveClaim(approveModal.claim.id, txHash, adminUser?.uid);
      await addAdminLog(
        adminUser?.uid,
        'approve_claim',
        approveModal.claim.uid,
        `Approved LVL ${approveModal.claim.level} claim. Hash: ${txHash}`
      );
      await loadClaims();
      setApproveModal({ open: false, claim: null });
      setTxHash('');
    } catch (err) {
      alert(t('error_prefix', 'Xəta: ') + err.message);
    }
  };

  const handleReject = async (claim) => {
    setProcessingId(claim.id);
    try {
      await rejectClaim(claim.id);
      await addAdminLog(
        adminUser?.uid,
        'reject_claim',
        claim.uid,
        `Rejected LVL ${claim.level} claim`
      );
      await loadClaims();
    } catch (err) {
      alert(t('error_prefix', 'Xəta: ') + err.message);
    } finally {
      setProcessingId(null);
    }
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
      <h1 className={styles.pageTitle}>Level Claims</h1>

      <div className={cStyles.tabs}>
        <button className={`${cStyles.tab} ${tab === 'pending' ? cStyles.tabActive : ''}`} onClick={() => setTab('pending')}>
          {t('claims_tabs.pending', 'Gözləyən')} ({claims.filter((c) => c.status === 'pending').length})
        </button>
        <button className={`${cStyles.tab} ${tab === 'done' ? cStyles.tabActive : ''}`} onClick={() => setTab('done')}>
          {t('claims_tabs.done', 'Tamamlanan')}
        </button>
      </div>

      <div className={styles.table}>
        <div className={cStyles.claimHeader}>
          <span>{t('claims_table_header.user', 'İstifadəçi')}</span>
          <span>{t('claims_table_header.level', 'Level')}</span>
          <span>{t('claims_table_header.bonus', 'Bonus')}</span>
          <span>{t('claims_table_header.type', 'Növ')}</span>
          <span>{t('claims_table_header.status', 'Status')}</span>
          <span></span>
        </div>
        {filtered.length === 0 && (
          <div className={cStyles.empty}>{t('no_claims_found', 'Heç bir iddia tapılmadı')}</div>
        )}
        {filtered.map((c) => (
          <div key={c.id} className={cStyles.claimRow}>
            <span className={styles.bold}>{c.login}</span>
            <span>LVL {c.level}</span>
            <span>${Number(c.bonus_amount).toLocaleString()}</span>
            <span>
              <Badge variant={c.claim_type === 'balance' ? 'info' : 'gold'} size="sm">
                {c.claim_type === 'balance' ? t('balance', 'Balans') : t('crypto', 'Kripto')}
              </Badge>
            </span>
            <span>
              <Badge variant={c.status === 'pending' ? 'warning' : 'success'} size="sm">
                {c.status === 'pending' ? t('pending', 'Gözləyir') : 'Done'}
              </Badge>
            </span>
            <div className={cStyles.actions}>
              {c.status === 'pending' && (
                <>
                  <button className={cStyles.approveBtn} onClick={() => setApproveModal({ open: true, claim: c })} disabled={processingId === c.id}>
                    <CheckCircle2 size={18} />
                  </button>
                  <button className={cStyles.rejectBtn} onClick={() => handleReject(c)} disabled={processingId === c.id}>
                    <XCircle size={18} />
                  </button>
                </>
              )}
              {c.status === 'done' && c.tx_hash && (
                <span className={cStyles.txHash} title={c.tx_hash}>{c.tx_hash.slice(0, 10)}...</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Approve Modal */}
      <Modal isOpen={approveModal.open} onClose={() => setApproveModal({ open: false, claim: null })} title={t('claim_approve_title', 'Claim Təsdiqlə')} size="sm">
        {approveModal.claim && (
          <div className={cStyles.approveContent}>
            <p><strong>{approveModal.claim.login}</strong> — LVL {approveModal.claim.level} — ${approveModal.claim.bonus_amount}</p>
            <p className={cStyles.approveAddress}>USDT: {approveModal.claim.usdt_address}</p>
            <Input label="Transaction Hash" placeholder="0x..." value={txHash} onChange={(e) => setTxHash(e.target.value)} />
            <Button fullWidth size="lg" onClick={handleApprove} disabled={!txHash.trim()} style={{ marginTop: 16 }}>
              {t('confirm', 'Təsdiqlə')}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
