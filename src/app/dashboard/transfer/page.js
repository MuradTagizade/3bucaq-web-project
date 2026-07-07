'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import styles from './transfer.module.css';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { formatCurrency, formatDateTime, withMinDuration } from '@/lib/utils/formatters';
import { validateAmount, validateUSDTAddress } from '@/lib/utils/validators';
import { ArrowUpRight, CheckCircle2, User, Wallet, ArrowDownToLine, CreditCard, Image as ImageIcon, ArrowDown, ChevronDown, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';
import { useTranslation } from '@/lib/store/languageStore';
import { transferFunds, lookupUserCode, getUserByUid, createWithdrawal, getWithdrawals, getSystemSetting, getMyTransfers } from '@/lib/supabase/database';
import { supabase } from '@/lib/supabase/config';

function TransferContent() {
  const { user: authUser, setUser } = useAuthStore();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('transfer');
  const searchParams = useSearchParams();

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'transfer' || tabParam === 'withdrawal') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Transfer state
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [recipientValid, setRecipientValid] = useState(null);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [kycPopup, setKycPopup] = useState(false);

  // Withdrawal state
  const [wdMethod, setWdMethod] = useState('usdt'); // 'usdt' or 'card'
  const [wdAmount, setWdAmount] = useState('');
  const [wdAddress, setWdAddress] = useState('');
  const [wdNetwork, setWdNetwork] = useState('TRC20');
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);
  const [wdCardNumber, setWdCardNumber] = useState('');
  const [wdErrors, setWdErrors] = useState({});
  const [wdLoading, setWdLoading] = useState(false);
  const [wdSuccess, setWdSuccess] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [wdHistoryLoading, setWdHistoryLoading] = useState(true);
  const [isCardActive, setIsCardActive] = useState(false);

  // Receipt Modal viewer
  const [viewerReceiptUrl, setViewerReceiptUrl] = useState(null);

  const balance = authUser?.balance || 0;

  useEffect(() => {
    async function loadWd() {
      if (!authUser?.uid) return;
      try {
        const [data, cardActiveSetting, transferData] = await Promise.all([
          getWithdrawals(authUser.uid),
          getSystemSetting('card_payment_active'),
          getMyTransfers(authUser.uid).catch(() => []),
        ]);
        setWithdrawals(data);
        setTransfers(transferData);
        const active = cardActiveSetting === 'true';
        setIsCardActive(active);
        if (!active) {
          setWdMethod('usdt');
        }
      } catch (err) {
        console.error('Failed to load withdrawals:', err);
      } finally {
        setWdHistoryLoading(false);
      }
    }
    loadWd();
  }, [authUser?.uid]);

  // --- Transfer handlers ---
  // Alıcı sorgusu debounce edilir (400ms) — her tuş vuruşunda RPC atma;
  // seq ile bayat (stale) cavablar atılır.
  const lookupTimerRef = useRef(null);
  const lookupSeqRef = useRef(0);

  useEffect(() => {
    return () => {
      if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    };
  }, []);

  const handleRecipientChange = (e) => {
    const val = e.target.value;
    setRecipient(val);
    setErrors((prev) => ({ ...prev, recipient: null }));

    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    const seq = ++lookupSeqRef.current;

    if (val.trim().length >= 5) {
      setRecipientValid(null);
      lookupTimerRef.current = setTimeout(async () => {
        try {
          const res = await lookupUserCode(val);
          if (seq !== lookupSeqRef.current) return; // bayat cavab — görməzdən gəl
          setRecipientValid(!!res.exists && res.user_code !== authUser.userCode);
        } catch {
          if (seq !== lookupSeqRef.current) return;
          setRecipientValid(false);
        }
      }, 400);
    } else {
      setRecipientValid(null);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();

    if (!isKycApproved) {
      setKycPopup(true);
      return;
    }

    const newErrors = {};

    if (!recipient.trim()) newErrors.recipient = t('enter_code', 'Kod yazın');
    else if (!recipientValid) newErrors.recipient = t('recipient_not_found', 'Qəbul edən tapılmadı');

    const amountErr = validateAmount(amount, balance);
    if (amountErr) newErrors.amount = amountErr;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      await withMinDuration(transferFunds(authUser.uid, recipient, amount), 2000);

      const updatedProfile = await getUserByUid(authUser.uid);
      if (updatedProfile) {
        setUser({
          ...authUser,
          balance: Number(updatedProfile.balance),
        });
      }

      setSuccess(true);
      getMyTransfers(authUser.uid).then(setTransfers).catch(() => {});
      setTimeout(() => {
        setSuccess(false);
        setRecipient('');
        setAmount('');
        setRecipientValid(null);
      }, 2500);
    } catch (err) {
      setErrors({ amount: err.message });
    } finally {
      setLoading(false);
    }
  };

  // --- Withdrawal handlers ---
  const handleWithdrawalSubmit = async (e) => {
    e.preventDefault();

    if (!isKycApproved) {
      setKycPopup(true);
      return;
    }

    const newErrors = {};

    const amountErr = validateAmount(wdAmount, balance);
    if (amountErr) newErrors.amount = amountErr;

    const formattedCard = wdCardNumber.replace(/\s+/g, '');

    if (wdMethod === 'usdt') {
      const addrErr = validateUSDTAddress(wdAddress);
      if (addrErr) newErrors.address = addrErr;
    } else {
      if (!isCardActive) {
        newErrors.cardNumber = t('card_withdrawal_inactive', 'Kart ilə çıxarış hazırda aktiv deyil.');
      } else if (formattedCard.length !== 16 || isNaN(Number(formattedCard))) {
        newErrors.cardNumber = t('card_number_16_digits', 'Kart nömrəsi 16 rəqəmdən ibarət olmalıdır');
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setWdErrors(newErrors);
      return;
    }

    setWdLoading(true);
    try {
      const wdPromise = wdMethod === 'usdt'
        ? createWithdrawal(authUser.uid, wdAmount, wdAddress, wdNetwork, 'usdt', null)
        : createWithdrawal(authUser.uid, wdAmount, null, null, 'card', formattedCard);
      await withMinDuration(wdPromise, 2000);

      const updatedProfile = await getUserByUid(authUser.uid);
      if (updatedProfile) {
        setUser({
          ...authUser,
          balance: Number(updatedProfile.balance),
        });
      }

      setWdSuccess(true);
      setTimeout(() => {
        setWdSuccess(false);
        setWdAmount('');
        setWdAddress('');
        setWdCardNumber('');
      }, 2500);

      const data = await getWithdrawals(authUser.uid);
      setWithdrawals(data);
    } catch (err) {
      setWdErrors({ amount: err.message });
    } finally {
      setWdLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      pending: { variant: 'warning', label: t('pending', 'Gözləyir') },
      approved: { variant: 'info', label: t('approved', 'Təsdiqlənib') },
      done: { variant: 'success', label: t('completed', 'Tamamlanıb') },
      rejected: { variant: 'error', label: t('rejected', 'Rədd') },
    };
    const s = map[status] || { variant: 'info', label: status };
    return <Badge variant={s.variant} size="sm">{s.label}</Badge>;
  };

  const handleViewReceipt = async (receiptPath) => {
    const { data, error } = await supabase.storage.from('kyc-documents').createSignedUrl(receiptPath, 3600);
    if (!error && data) setViewerReceiptUrl(data.signedUrl);
  };

  const kycStatus = authUser?.kycStatus || 'none';
  const isKycApproved = kycStatus === 'approved' || authUser?.role === 'admin';

  return (
    <div className={styles.transfer}>
      {/* Balance Display */}
      <div className={styles.balanceCard}>
        <span className={styles.balanceLabel}>{t('balance', 'Balans')}</span>
        <span className={styles.balanceValue}>{formatCurrency(balance, '')}</span>
        <span className={styles.balanceCurrency}>USD</span>
      </div>

      {/* KYC Warning Banner */}
      {!isKycApproved && (
        <div className={styles.kycWarningBanner}>
          <AlertTriangle size={18} className={styles.warningIcon} />
          <div className={styles.warningText}>
            <span>{t('kyc_required_desc', 'Köçürmə və çıxarış əməliyyatlarını həyata keçirmək üçün şəxsiyyətinizi təsdiq etməlisiniz.')}</span>
            <Link href="/dashboard/kyc" className={styles.warningLink}>
              {t('go_to_kyc_short', 'Doğrulamaya Get →')}
            </Link>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        <Link
          href="/dashboard/deposit"
          className={styles.tab}
        >
          <ArrowDown size={16} /> {t('deposit', 'Depozit')}
        </Link>
        <button
          className={`${styles.tab} ${activeTab === 'transfer' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('transfer')}
        >
          <ArrowUpRight size={16} /> {t('transfer', 'Köçürmə')}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'withdrawal' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('withdrawal')}
        >
          <ArrowDownToLine size={16} /> {t('withdrawal', 'Çıxarış')}
        </button>
      </div>

      {/* Transfer Form */}
      {activeTab === 'transfer' && (
        <>
          <div className={styles.infoCard}>
            <div className={styles.infoIcon} style={{ background: 'rgba(0, 240, 255, 0.1)' }}>
              <ArrowUpRight size={20} color="var(--color-secondary)" />
            </div>
            <div>
              <strong>{t('internal_transfer_title', 'Daxili Köçürmə')}</strong>
              <p>{t('internal_transfer_desc', 'Digər istifadəçilərə daxili balans köçürməsi edin. Köçürmə anında (dərhal) baş tutur.')}</p>
            </div>
          </div>

          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>{t('internal_transfer', 'Köçürmə')}</h2>
            <form onSubmit={handleTransferSubmit} className={styles.form}>
              <Input
                label={t('recipient_label', 'Kimə')}
                placeholder={t('recipient_code_or_username_placeholder', 'Kod və ya istifadəçi adı (məs. K7M2QX)')}
                value={recipient}
                onChange={handleRecipientChange}
                error={recipient.trim().length >= 5 && recipientValid === false ? t('recipient_not_found', 'Qəbul edən tapılmadı') : errors.recipient}
                success={recipientValid}
                icon={<User size={18} />}
              />

              <Input
                label={t('amount', 'Məbləğ')}
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setErrors((prev) => ({ ...prev, amount: null }));
                }}
                error={errors.amount}
                icon={<ArrowUpRight size={18} />}
              />

              <Button type="submit" fullWidth size="lg" loading={loading} disabled={loading || !recipientValid}>
                {t('submit', 'Göndər')}
              </Button>
            </form>
          </div>

          {/* Transfer History */}
          <h3 className={styles.historyTitle}>{t('transfer_history_title', 'Köçürmə Tarixçəsi')}</h3>
          {transfers.length === 0 ? (
            <div className={styles.empty}>{t('no_transfers_yet', 'Hələ köçürmə yoxdur')}</div>
          ) : (
            <div className={styles.historyList}>
              {transfers.map((tr) => {
                const isSent = tr.from_uid === authUser?.uid;
                return (
                  <div key={tr.id} className={styles.historyItem}>
                    <div className={styles.historyInfo}>
                      <span className={styles.historyAmount} style={{ color: isSent ? 'var(--color-error)' : 'var(--color-success)' }}>
                        {isSent ? '-' : '+'}{formatCurrency(tr.amount)}
                      </span>
                      <span className={styles.historyDate}>{formatDateTime(tr.created_at)}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {isSent
                          ? `${t('transfer_to', 'Kimə')}: ${tr.to_login || '—'}`
                          : `${t('transfer_from', 'Kimdən')}: ${tr.from_login || '—'}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Withdrawal Form */}
      {activeTab === 'withdrawal' && (
        <>
          {wdMethod === 'usdt' ? (
            <div className={styles.infoCard}>
              <div className={styles.infoIcon}>
                <ArrowDownToLine size={20} />
              </div>
              <div>
                <strong>{t('usdt_withdrawal_title', 'USDT Çıxarış')}</strong>
                <p>{t('usdt_withdrawal_desc', 'USDT TRC20 şəbəkəsi vasitəsilə balansınızı çıxarın. Sorğunuz 24 saat ərzində icra olunacaq.')}</p>
              </div>
            </div>
          ) : (
            <div className={styles.infoCard}>
              <div className={styles.infoIcon} style={{ background: 'rgba(0, 230, 118, 0.1)' }}>
                <CreditCard size={20} color="var(--color-primary)" />
              </div>
              <div>
                <strong>{t('card_withdrawal_title', 'Bank Kartına Çıxarış')}</strong>
                <p>{t('card_withdrawal_desc', 'Bank kartınıza birbaşa çıxarış edin. Sorğunuz 24 saat ərzində icra olunacaq.')}</p>
              </div>
            </div>
          )}

          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>{t('withdrawal_request', 'Çıxarış Sorğusu')}</h2>
            
            {/* Withdrawal Method Toggles */}
            {isCardActive && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => { setWdMethod('usdt'); setWdErrors({}); }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: wdMethod === 'usdt' ? 'var(--color-primary-subtle)' : 'var(--bg-secondary)',
                    border: `1px solid ${wdMethod === 'usdt' ? 'var(--color-primary)' : 'var(--border-default)'}`,
                    color: wdMethod === 'usdt' ? 'var(--color-primary)' : 'var(--text-secondary)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }}
                >
                  <Wallet size={14} />
                  <span>USDT</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setWdMethod('card'); setWdErrors({}); }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: wdMethod === 'card' ? 'var(--color-primary-subtle)' : 'var(--bg-secondary)',
                    border: `1px solid ${wdMethod === 'card' ? 'var(--color-primary)' : 'var(--border-default)'}`,
                    color: wdMethod === 'card' ? 'var(--color-primary)' : 'var(--text-secondary)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }}
                >
                  <CreditCard size={14} />
                  <span>{t('card_withdrawal_manual', 'Bank Kartı')}</span>
                </button>
              </div>
            )}

            <form onSubmit={handleWithdrawalSubmit} className={styles.form}>
              <Input
                label={t('amount_usd', 'Məbləğ (USD)')}
                type="number"
                placeholder="0.00"
                value={wdAmount}
                onChange={(e) => {
                  setWdAmount(e.target.value);
                  setWdErrors((prev) => ({ ...prev, amount: null }));
                }}
                error={wdErrors.amount}
                icon={<Wallet size={18} />}
              />

              {wdMethod === 'usdt' ? (
                <>
                  <Input
                    label={t('usdt_address', 'USDT Ünvanı')}
                    placeholder={t('usdt_address_placeholder', 'T... və ya 0x...')}
                    value={wdAddress}
                    onChange={(e) => {
                      setWdAddress(e.target.value);
                      setWdErrors((prev) => ({ ...prev, address: null }));
                    }}
                    error={wdErrors.address}
                  />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
                    <label style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{t('network', 'Şəbəkə')}</label>
                    <button
                      type="button"
                      onClick={() => setNetworkDropdownOpen(!networkDropdownOpen)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '10px 12px', borderRadius: 8,
                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                        border: '1px solid var(--border-default)', fontSize: 14, textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      <span>USDT {wdNetwork}</span>
                      <ChevronDown size={16} />
                    </button>
                    {networkDropdownOpen && (
                      <div
                        style={{
                          position: 'absolute', top: '100%', left: 0, right: 0,
                          background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                          borderRadius: 8, marginTop: 4, padding: 4, zIndex: 100,
                          display: 'flex', flexDirection: 'column', gap: 2,
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
                        }}
                      >
                        {['TRC20', 'ERC20', 'BEP20'].map((net) => (
                          <button
                            key={net}
                            type="button"
                            onClick={() => {
                              setWdNetwork(net);
                              setNetworkDropdownOpen(false);
                            }}
                            style={{
                              width: '100%', padding: '8px 12px', borderRadius: 6,
                              background: wdNetwork === net ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
                              color: wdNetwork === net ? 'var(--color-secondary)' : 'var(--text-primary)',
                              border: 'none', fontSize: 13, fontWeight: wdNetwork === net ? '600' : '500',
                              textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s ease'
                            }}
                          >
                            USDT {net}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <Input
                  label={t('bank_card_label', '16 rəqəmli Bank Kart Nömrəniz')}
                  placeholder="1234 5678 1234 5678"
                  value={wdCardNumber}
                  maxLength={19}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
                    setWdCardNumber(formatted.slice(0, 19));
                    setWdErrors((prev) => ({ ...prev, cardNumber: null }));
                  }}
                  error={wdErrors.cardNumber}
                  icon={<CreditCard size={18} />}
                />
              )}

              <Button type="submit" fullWidth size="lg" loading={wdLoading} disabled={wdLoading}>
                {t('send_withdrawal_request', 'Çıxarış Sorğusu Göndər')}
              </Button>
            </form>
          </div>

          {/* Withdrawal History */}
          <h3 className={styles.historyTitle}>{t('withdrawal_history', 'Çıxarış Tarixçəsi')}</h3>
          {wdHistoryLoading ? (
            <div style={{ textAlign: 'center', padding: 20 }}>{t('loading', 'Yüklənir...')}</div>
          ) : withdrawals.length === 0 ? (
            <div className={styles.empty}>{t('no_withdrawals_yet', 'Hələ çıxarış yoxdur')}</div>
          ) : (
            <div className={styles.historyList}>
              {withdrawals.map((w) => (
                <div key={w.id} className={styles.historyItem}>
                  <div className={styles.historyInfo}>
                    <span className={styles.historyAmount}>{formatCurrency(w.amount)}</span>
                    <span className={styles.historyDate}>{formatDateTime(w.created_at)}</span>
                    
                    {w.payment_method === 'card' ? (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        <span>{t('card_prefix', 'Kart: ****')} {w.card_number?.slice(-4)}</span>
                        {w.status === 'done' && w.receipt_url && (
                          <div>
                            <button
                              type="button"
                              onClick={() => handleViewReceipt(w.receipt_url)}
                              style={{
                                border: 'none', background: 'none', padding: 0,
                                fontSize: 11, color: 'var(--color-primary)',
                                textDecoration: 'underline', cursor: 'pointer', marginTop: 4
                              }}
                            >
                              {t('view_payment_receipt', 'Ödəniş Qəbzinə Bax')}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        USDT ({w.network || 'TRC20'})
                      </span>
                    )}
                  </div>
                  {getStatusBadge(w.status)}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Receipt Viewer Modal */}
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
              style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: 8, objectFit: 'contain', border: '1px solid var(--border-color)' }}
            />
            <Button onClick={() => window.open(viewerReceiptUrl, '_blank')}>
              {t('view_full_screen', 'Tam Ekran Bax')}
            </Button>
          </div>
        )}
      </Modal>

      {/* KYC Required Popup */}
      <Modal
        isOpen={kycPopup}
        onClose={() => setKycPopup(false)}
        title={t('kyc_popup_title', 'KYC Təsdiqi Tələb Olunur')}
        size="sm"
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16, padding: '8px 0' }}>
          <AlertTriangle size={48} color="var(--color-warning, #f59e0b)" />
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {t('kyc_popup_desc', 'Bu əməliyyatı həyata keçirmək üçün KYC təsdiqi tələb olunur. Zəhmət olmasa əvvəlcə şəxsiyyətinizi təsdiq edin.')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
            <Link href="/dashboard/kyc" style={{ textDecoration: 'none', display: 'block' }} onClick={() => setKycPopup(false)}>
              <Button fullWidth size="lg">{t('go_to_kyc', 'KYC Təsdiq Et')}</Button>
            </Link>
            <Button variant="ghost" fullWidth onClick={() => setKycPopup(false)}>
              {t('later', 'Sonra')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Success Popup */}
      {(success || wdSuccess) && (
        <div className={styles.successOverlay}>
          <div className={styles.successPopup}>
            <CheckCircle2 size={64} color="var(--color-success)" />
            <span className={styles.successText}>
              {success ? t('transfer_success', 'Transfer uğurlu!') : t('request_sent', 'Sorğu göndərildi!')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TransferPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
        <span>Loading...</span>
      </div>
    }>
      <TransferContent />
    </Suspense>
  );
}
