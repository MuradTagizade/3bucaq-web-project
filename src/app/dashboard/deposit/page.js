'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './deposit.module.css';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { Wallet, ArrowDown, Clock, CheckCircle2, XCircle, Copy, Upload, CreditCard, Image as ImageIcon, ArrowUpRight, ArrowDownToLine } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';
import { validateAmount } from '@/lib/utils/validators';
import { useAuthStore } from '@/lib/store/authStore';
import { useTranslation } from '@/lib/store/languageStore';
import { createDeposit, getDeposits, getSystemSetting } from '@/lib/supabase/database';
import { supabase } from '@/lib/supabase/config';

export default function DepositPage() {
  const { user: authUser } = useAuthStore();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('usdt'); // 'usdt' or 'card'
  const [isCardActive, setIsCardActive] = useState(false); // Enable/Disable card payment setting
  
  // Crypto form state
  const [cryptoAsset, setCryptoAsset] = useState('usdt'); // 'usdt' or 'usdc'
  const [amount, setAmount] = useState('');
  const [txHash, setTxHash] = useState('');
  const [network, setNetwork] = useState('TRC20');
  const [cryptoWallets, setCryptoWallets] = useState({
    usdt_trc20: '',
    usdt_erc20: '',
    usdt_bep20: '',
    usdc_trc20: '',
    usdc_erc20: '',
    usdc_bep20: '',
  });
  
  // Card form state
  const [cardAmount, setCardAmount] = useState('');
  const [userCardNumber, setUserCardNumber] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [adminCardNumber, setAdminCardNumber] = useState('Yüklənir...');
  
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Receipt Modal viewer
  const [viewerReceiptUrl, setViewerReceiptUrl] = useState(null);

  useEffect(() => {
    async function loadData() {
      if (!authUser?.uid) return;
      try {
        const [
          historyData, activeCard, cardActiveSetting,
          usdtTRC, usdtERC, usdtBEP,
          usdcTRC, usdcERC, usdcBEP
        ] = await Promise.all([
          getDeposits(authUser.uid),
          getSystemSetting('admin_deposit_card'),
          getSystemSetting('card_payment_active'),
          getSystemSetting('wallet_usdt_trc20'),
          getSystemSetting('wallet_usdt_erc20'),
          getSystemSetting('wallet_usdt_bep20'),
          getSystemSetting('wallet_usdc_trc20'),
          getSystemSetting('wallet_usdc_erc20'),
          getSystemSetting('wallet_usdc_bep20'),
        ]);
        setDeposits(historyData);
        if (activeCard) {
          setAdminCardNumber(activeCard);
        } else {
          setAdminCardNumber(t('not_set', 'Təyin edilməyib'));
        }
        setIsCardActive(cardActiveSetting === 'true');
        setCryptoWallets({
          usdt_trc20: usdtTRC || '',
          usdt_erc20: usdtERC || '',
          usdt_bep20: usdtBEP || '',
          usdc_trc20: usdcTRC || '',
          usdc_erc20: usdcERC || '',
          usdc_bep20: usdcBEP || '',
        });
        // Force USDT if card system is disabled
        if (cardActiveSetting !== 'true') {
          setActiveTab('usdt');
        }
      } catch (err) {
        console.error('Failed to load deposit data:', err);
      } finally {
        setLoadingHistory(false);
      }
    }
    loadData();
  }, [authUser?.uid]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleCopyText = async (text, successMsg) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMsg);
    } catch (err) {
      showToast(t('receipt_copy_fail', 'Kopyalamaq alınmadı'));
    }
  };

  const handleCopyCard = () => handleCopyText(adminCardNumber, t('receipt_copied', 'Kart nömrəsi kopyalandı!'));
  
  const activeWalletAddress = cryptoWallets[`${cryptoAsset}_${network.toLowerCase()}`] || t('not_set', 'Təyin edilməyib');
  const handleCopyWallet = () => handleCopyText(activeWalletAddress, t('wallet_copied', 'Cüzdan ünvanı kopyalandı!'));

  // Upload file to Supabase storage bucket
  const uploadReceiptFile = async (file) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `deposit_${Date.now()}.${fileExt}`;
    const filePath = `receipts/${authUser.uid}/${fileName}`;
    
    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .upload(filePath, file, { upsert: true });
      
    if (error) throw new Error(error.message);
    return data.path;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (activeTab === 'usdt') {
      const amountErr = validateAmount(amount);
      if (amountErr) {
        showToast(amountErr);
        return;
      }

      if (!txHash.trim()) {
        showToast(t('enter_tx_hash', 'Transaction Hash daxil edin'));
        return;
      }

      setLoading(true);
      try {
        await createDeposit(authUser.uid, amount, txHash, `${cryptoAsset.toUpperCase()} ${network}`, cryptoAsset);
        showToast(t('deposit_success', 'Depozit sorğusu göndərildi! Sorğunuz 24 saat ərzində icra olunacaq.'));
        setAmount('');
        setTxHash('');
        const data = await getDeposits(authUser.uid);
        setDeposits(data);
      } catch (err) {
        showToast(t('error_prefix', 'Xəta: ') + err.message);
      } finally {
        setLoading(false);
      }
    } else {
      // Security check if card payments were deactivated in background
      if (!isCardActive) {
        showToast(t('card_payment_inactive', 'Kart ilə ödəniş hazırda aktiv deyil.'));
        return;
      }

      // Bank Card submission
      const amountErr = validateAmount(cardAmount);
      if (amountErr) {
        showToast(amountErr);
        return;
      }

      const formattedCard = userCardNumber.replace(/\s+/g, '');
      if (formattedCard.length !== 16 || isNaN(Number(formattedCard))) {
        showToast(t('card_number_16_digits', 'Kart nömrəsi 16 rəqəmdən ibarət olmalıdır'));
        return;
      }

      if (!receiptFile) {
        showToast(t('upload_receipt', 'Ödəniş qəbzi şəklini yükləyin'));
        return;
      }

      setLoading(true);
      try {
        const receiptPath = await uploadReceiptFile(receiptFile);
        await createDeposit(authUser.uid, cardAmount, null, null, 'card', formattedCard, receiptPath);
        showToast(t('card_deposit_success', 'Kart ilə depozit sorğusu göndərildi! Admin təsdiq edəcək.'));
        setCardAmount('');
        setUserCardNumber('');
        setReceiptFile(null);
        const data = await getDeposits(authUser.uid);
        setDeposits(data);
      } catch (err) {
        showToast(t('error_prefix', 'Xəta: ') + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      pending: { variant: 'warning', label: t('pending', 'Gözləyir') },
      approved: { variant: 'success', label: t('approved', 'Təsdiqlənib') },
      rejected: { variant: 'error', label: t('rejected', 'Rədd') },
    };
    const s = map[status] || { variant: 'info', label: status };
    return <Badge variant={s.variant} size="sm">{s.label}</Badge>;
  };

  // Helper to resolve receipt public url
  const handleViewReceipt = (receiptPath) => {
    const { data } = supabase.storage.from('kyc-documents').getPublicUrl(receiptPath);
    setViewerReceiptUrl(data.publicUrl);
  };

  const balance = authUser?.balance || 0;

  return (
    <div className={styles.page}>
      {/* Balance Display */}
      <div className={styles.balanceCard}>
        <span className={styles.balanceLabel}>{t('total_balance', 'Ümumi Balans')}</span>
        <span className={styles.balanceValue}>{formatCurrency(balance, '')}</span>
        <span className={styles.balanceCurrency}>USD</span>
      </div>

      {/* Operation Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${styles.tabActive}`}
          disabled
        >
          <ArrowDown size={16} /> {t('deposit', 'Depozit')}
        </button>
        <Link
          href="/dashboard/transfer?tab=transfer"
          className={styles.tab}
        >
          <ArrowUpRight size={16} /> {t('transfer', 'Köçürmə')}
        </Link>
        <Link
          href="/dashboard/transfer?tab=withdrawal"
          className={styles.tab}
        >
          <ArrowDownToLine size={16} /> {t('withdrawal', 'Çıxarış')}
        </Link>
      </div>

      {/* Payment Method Tabs (Only show if card payments are active in system_settings) */}
      {isCardActive && (
        <div className={styles.methodTabs}>
          <button
            type="button"
            className={`${styles.methodTab} ${activeTab === 'usdt' ? styles.methodTabActive : ''}`}
            onClick={() => setActiveTab('usdt')}
          >
            <Wallet size={16} />
            <span>Kripto (USDT / USDC)</span>
          </button>
          <button
            type="button"
            className={`${styles.methodTab} ${activeTab === 'card' ? styles.methodTabActive : ''}`}
            onClick={() => setActiveTab('card')}
          >
            <CreditCard size={16} />
            <span>{t('bank_card_manual', 'Bank Kartı')}</span>
          </button>
        </div>
      )}

      {activeTab === 'usdt' ? (
        <div className={styles.infoCard}>
          <div className={styles.infoIcon}>
            <ArrowDown size={20} />
          </div>
          <div>
            <strong>Kripto ilə Mədaxil</strong>
            <p>{t('usdt_deposit_desc', 'Kripto vasitəsilə balansınızı artırın. Transaction hash-i daxil edin, sorğunuz 24 saat ərzində icra olunacaq.')}</p>
          </div>
        </div>
      ) : (
        <div className={styles.infoCard}>
          <div className={styles.infoIcon} style={{ background: 'rgba(0, 230, 118, 0.1)' }}>
            <CreditCard size={20} color="var(--color-primary)" />
          </div>
          <div>
            <strong>{t('bank_card_manual', 'Bank Kartı (Manuel)')}</strong>
            <p>{t('card_deposit_desc', 'Aşağıda qeyd olunan bank kartına pulu göndərib, ödəniş qəbzi şəklini və kart nömrənizi daxil edin. Sorğunuz 24 saat ərzində icra olunacaq.')}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        {activeTab === 'usdt' ? (
          <>
            {/* Asset selection (USDT / USDC) */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setCryptoAsset('usdt')}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: cryptoAsset === 'usdt' ? 'var(--color-primary-subtle)' : 'var(--bg-secondary)',
                  border: `1px solid ${cryptoAsset === 'usdt' ? 'var(--color-primary)' : 'var(--border-default)'}`,
                  color: cryptoAsset === 'usdt' ? 'var(--color-primary)' : 'var(--text-secondary)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}
              >
                <span>USDT</span>
              </button>
              <button
                type="button"
                onClick={() => setCryptoAsset('usdc')}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: cryptoAsset === 'usdc' ? 'var(--color-primary-subtle)' : 'var(--bg-secondary)',
                  border: `1px solid ${cryptoAsset === 'usdc' ? 'var(--color-primary)' : 'var(--border-default)'}`,
                  color: cryptoAsset === 'usdc' ? 'var(--color-primary)' : 'var(--text-secondary)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}
              >
                <span>USDC</span>
              </button>
            </div>

            {/* Network selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{t('network', 'Şəbəkə')}</label>
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                className={styles.select}
              >
                <option value="TRC20">{cryptoAsset.toUpperCase()} TRC20</option>
                <option value="ERC20">{cryptoAsset.toUpperCase()} ERC20</option>
                <option value="BEP20">{cryptoAsset.toUpperCase()} BEP20</option>
              </select>
            </div>

            {/* Wallet Address Display Box */}
            <div className={styles.cardDisplay}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('wallet_address_to_send', 'Göndəriləcək Cüzdan Ünvanı')} ({cryptoAsset.toUpperCase()} {network})
              </span>
              <div className={styles.cardNumRow}>
                <span className={styles.cardNum} style={{ fontSize: 15, wordBreak: 'break-all' }}>
                  {activeWalletAddress}
                </span>
                <button type="button" className={styles.copyBtn} onClick={handleCopyWallet}>
                  <Copy size={12} />
                  <span>{t('copy', 'Kopyala')}</span>
                </button>
              </div>
            </div>

            <Input
              label={t('amount_usd', 'Məbləğ (USD)')}
              type="number"
              placeholder="100.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              icon={<Wallet size={18} />}
            />

            <Input
              label="Transaction Hash"
              placeholder={t('enter_tx_hash', 'Transaction Hash daxil edin')}
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
            />
          </>
        ) : (
          <>
            <div className={styles.cardDisplay}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('card_display_label', 'Göndəriləcək Kart Hesabı')}</span>
              <div className={styles.cardNumRow}>
                <span className={styles.cardNum}>{adminCardNumber}</span>
                <button type="button" className={styles.copyBtn} onClick={handleCopyCard}>
                  <Copy size={12} />
                  <span>{t('copy', 'Kopyala')}</span>
                </button>
              </div>
            </div>

            <Input
              label={t('amount_usd', 'Məbləğ (USD)')}
              type="number"
              placeholder="100.00"
              value={cardAmount}
              onChange={(e) => setCardAmount(e.target.value)}
              icon={<Wallet size={18} />}
            />

            <Input
              label={t('bank_card_label', 'Göndərən Kart Nömrəniz (16 rəqəmli)')}
              placeholder="1234 5678 1234 5678"
              value={userCardNumber}
              maxLength={19}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
                setUserCardNumber(formatted.slice(0, 19));
              }}
              icon={<CreditCard size={18} />}
            />

            <div className={styles.fileUploadGroup}>
              <span className={styles.fileUploadLabel}>{t('payment_receipt_photo', 'Ödəniş Qəbzi (Foto)')}</span>
              <label className={styles.fileUploader}>
                <Upload size={18} color="var(--color-primary)" />
                <span>{receiptFile ? receiptFile.name : t('select_receipt_file', 'Qəbzin şəklini seçin...')}</span>
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

        <Button type="submit" fullWidth size="lg" loading={loading}>
          {t('send_deposit_request', 'Depozit Sorğusu Göndər')}
        </Button>
      </form>

      {/* Deposit History */}
      <h3 className={styles.historyTitle}>{t('deposit_history', 'Depozit Tarixçəsi')}</h3>
      {loadingHistory ? (
        <div style={{ textAlign: 'center', padding: 20 }}>{t('loading', 'Yüklənir...')}</div>
      ) : deposits.length === 0 ? (
        <div className={styles.empty}>{t('no_deposits_yet', 'Hələ depozit yoxdur')}</div>
      ) : (
        <div className={styles.historyList}>
          {deposits.map((d) => (
            <div key={d.id} className={styles.historyItem}>
              <div className={styles.historyInfo}>
                <span className={styles.historyAmount}>{formatCurrency(d.amount)}</span>
                <span className={styles.historyDate}>{formatDateTime(d.created_at)}</span>
                {d.payment_method === 'card' ? (
                  <div className={styles.historyMethod}>
                    <span>{t('card_prefix', 'Kart: ****')} {d.card_number?.slice(-4)}</span>
                    {d.receipt_url && (
                      <div>
                        <button
                          type="button"
                          className={styles.viewReceiptLink}
                          onClick={() => handleViewReceipt(d.receipt_url)}
                        >
                          {t('view_receipt', 'Qəbzə Bax')}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className={styles.historyMethod}>USDT ({d.network || 'TRC20'})</span>
                )}
              </div>
              {getStatusBadge(d.status)}
            </div>
          ))}
        </div>
      )}

      {/* Receipt Preview Modal */}
      <Modal
        isOpen={!!viewerReceiptUrl}
        onClose={() => setViewerReceiptUrl(null)}
        title={t('deposit_receipt_title', 'Depozit Ödəniş Qəbzi')}
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

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
