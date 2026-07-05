'use client';

import { useState, useEffect } from 'react';
import styles from './wallets.module.css';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { useAuthStore } from '@/lib/store/authStore';
import { useTranslation } from '@/lib/store/languageStore';
import { getSystemSettings, updateSystemSetting, addAdminLog } from '@/lib/supabase/database';
import { Coins, Save, CreditCard } from 'lucide-react';

export default function AdminWalletsPage() {
  const { user: adminUser } = useAuthStore();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [wallets, setWallets] = useState({
    wallet_usdt_trc20: '',
    wallet_usdt_erc20: '',
    wallet_usdt_bep20: '',
    wallet_usdc_trc20: '',
    wallet_usdc_erc20: '',
    wallet_usdc_bep20: '',
  });

  const [depositCard, setDepositCard] = useState('');
  const [updatingCard, setUpdatingCard] = useState(false);
  const [isCardActive, setIsCardActive] = useState(false);
  const [updatingToggle, setUpdatingToggle] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    async function loadWallets() {
      try {
        const settings = await getSystemSettings([
          'wallet_usdt_trc20', 'wallet_usdt_erc20', 'wallet_usdt_bep20',
          'wallet_usdc_trc20', 'wallet_usdc_erc20', 'wallet_usdc_bep20',
          'admin_deposit_card', 'card_payment_active',
        ]);

        setWallets({
          wallet_usdt_trc20: settings.wallet_usdt_trc20 || '',
          wallet_usdt_erc20: settings.wallet_usdt_erc20 || '',
          wallet_usdt_bep20: settings.wallet_usdt_bep20 || '',
          wallet_usdc_trc20: settings.wallet_usdc_trc20 || '',
          wallet_usdc_erc20: settings.wallet_usdc_erc20 || '',
          wallet_usdc_bep20: settings.wallet_usdc_bep20 || '',
        });

        if (settings.admin_deposit_card) {
          setDepositCard(settings.admin_deposit_card);
        }
        setIsCardActive(settings.card_payment_active === 'true');
      } catch (err) {
        console.error('Failed to load wallet settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadWallets();
  }, []);

  const handleChange = (key, val) => {
    setWallets((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async (asset) => {
    setSaving(true);
    try {
      if (asset === 'usdt') {
        await Promise.all([
          updateSystemSetting('wallet_usdt_trc20', wallets.wallet_usdt_trc20),
          updateSystemSetting('wallet_usdt_erc20', wallets.wallet_usdt_erc20),
          updateSystemSetting('wallet_usdt_bep20', wallets.wallet_usdt_bep20),
        ]);
        await addAdminLog(adminUser?.uid, 'update_wallets_usdt', null, 
          `USDT wallets updated: TRC20=${wallets.wallet_usdt_trc20}, ERC20=${wallets.wallet_usdt_erc20}, BEP20=${wallets.wallet_usdt_bep20}`);
      } else {
        await Promise.all([
          updateSystemSetting('wallet_usdc_trc20', wallets.wallet_usdc_trc20),
          updateSystemSetting('wallet_usdc_erc20', wallets.wallet_usdc_erc20),
          updateSystemSetting('wallet_usdc_bep20', wallets.wallet_usdc_bep20),
        ]);
        await addAdminLog(adminUser?.uid, 'update_wallets_usdc', null, 
          `USDC wallets updated: TRC20=${wallets.wallet_usdc_trc20}, ERC20=${wallets.wallet_usdc_erc20}, BEP20=${wallets.wallet_usdc_bep20}`);
      }
      showToast(t('wallets_saved_success', 'Cüzdan ünvanları uğurla yeniləndi!'));
    } catch (err) {
      showToast(t('error_prefix', 'Xəta: ') + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCard = async () => {
    const cleanCard = depositCard.replace(/\s+/g, '');
    if (cleanCard.length !== 16 || isNaN(Number(cleanCard))) {
      showToast(t('card_number_16_digit_err', 'Kart nömrəsi 16 rəqəmli olmalıdır.'));
      return;
    }
    setUpdatingCard(true);
    try {
      await updateSystemSetting('admin_deposit_card', cleanCard);
      await addAdminLog(adminUser?.uid, 'update_admin_deposit_card', null, `Admin deposit card updated to: ${cleanCard}`);
      showToast(t('admin_deposit_card_updated', 'Mədaxil kart hesabı uğurla yeniləndi!'));
    } catch (err) {
      showToast(t('error_prefix', 'Xəta: ') + err.message);
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
      showToast(t('card_payment_active_msg', 'Kart ilə ödəniş sistemi {{status}}!').replace('{{status}}', statusText));
    } catch (err) {
      showToast(t('error_prefix', 'Xəta: ') + err.message);
    } finally {
      setUpdatingToggle(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0 24px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>
        <Coins size={22} color="var(--color-primary)" />
        {t('crypto_wallet_management', 'Kripto Cüzdan İdarəetməsi')}
      </h2>

      <div className={styles.grid}>
        {/* USDT Card */}
        <div className={styles.card}>
          <h3 className={styles.title}>
            <Coins size={18} color="var(--color-primary)" />
            {t('wallet_usdt_title', 'USDT Wallets (Tether)')}
          </h3>
          <div className={styles.inputs}>
            <Input
              label={t('wallet_usdt_trc20_label', 'USDT TRC20 Wallet Address')}
              placeholder={t('wallet_addr_t_placeholder', 'Address starting with T...')}
              value={wallets.wallet_usdt_trc20}
              onChange={(e) => handleChange('wallet_usdt_trc20', e.target.value)}
            />
            <Input
              label={t('wallet_usdt_erc20_label', 'USDT ERC20 Wallet Address')}
              placeholder={t('wallet_addr_0x_placeholder', 'Address starting with 0x...')}
              value={wallets.wallet_usdt_erc20}
              onChange={(e) => handleChange('wallet_usdt_erc20', e.target.value)}
            />
            <Input
              label={t('wallet_usdt_bep20_label', 'USDT BEP20 Wallet Address')}
              placeholder={t('wallet_addr_0x_placeholder', 'Address starting with 0x...')}
              value={wallets.wallet_usdt_bep20}
              onChange={(e) => handleChange('wallet_usdt_bep20', e.target.value)}
            />
            <Button
              onClick={() => handleSave('usdt')}
              loading={saving}
              fullWidth
              style={{ marginTop: 8 }}
            >
              <Save size={16} /> {t('wallet_save_usdt', 'Save USDT Wallets')}
            </Button>
          </div>
        </div>

        {/* USDC Card */}
        <div className={styles.card}>
          <h3 className={styles.title}>
            <Coins size={18} color="var(--color-secondary)" />
            {t('wallet_usdc_title', 'USDC Wallets (USD Coin)')}
          </h3>
          <div className={styles.inputs}>
            <Input
              label={t('wallet_usdc_trc20_label', 'USDC TRC20 Wallet Address')}
              placeholder={t('wallet_addr_t_placeholder', 'Address starting with T...')}
              value={wallets.wallet_usdc_trc20}
              onChange={(e) => handleChange('wallet_usdc_trc20', e.target.value)}
            />
            <Input
              label={t('wallet_usdc_erc20_label', 'USDC ERC20 Wallet Address')}
              placeholder={t('wallet_addr_0x_placeholder', 'Address starting with 0x...')}
              value={wallets.wallet_usdc_erc20}
              onChange={(e) => handleChange('wallet_usdc_erc20', e.target.value)}
            />
            <Input
              label={t('wallet_usdc_bep20_label', 'USDC BEP20 Wallet Address')}
              placeholder={t('wallet_addr_0x_placeholder', 'Address starting with 0x...')}
              value={wallets.wallet_usdc_bep20}
              onChange={(e) => handleChange('wallet_usdc_bep20', e.target.value)}
            />
            <Button
              onClick={() => handleSave('usdc')}
              loading={saving}
              fullWidth
              style={{ marginTop: 8 }}
              variant="secondary"
            >
              <Save size={16} /> {t('wallet_save_usdc', 'Save USDC Wallets')}
            </Button>
          </div>
        </div>

        {/* Bank Card Settings Card */}
        <div className={styles.card}>
          <h3 className={styles.title}>
            <CreditCard size={18} color="var(--color-primary)" />
            {t('wallet_bank_card_settings', 'Bank Card Settings')}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Toggle Status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ flex: 1, paddingRight: 12 }}>
                <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{t('card_active_system', 'Bank Card System Status')}</strong>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                  {t('card_active_desc', 'Enable or disable bank card deposit and withdrawal requests system-wide.')}
                </p>
              </div>
              <button
                type="button"
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
                  whiteSpace: 'nowrap'
                }}
              >
                {isCardActive ? t('deactivate', 'Deaktiv Et') : t('activate', 'Aktiv Et')}
              </button>
            </div>

            {/* Target Card Input */}
            <div className={styles.inputs}>
              <Input
                label={t('wallet_deposit_card_label', 'Deposit Card Account')}
                placeholder="1234 5678 1234 5678"
                value={depositCard}
                maxLength={19}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
                  setDepositCard(formatted.slice(0, 19));
                }}
              />
              <Button
                onClick={handleUpdateCard}
                loading={updatingCard}
                fullWidth
                style={{ marginTop: 8 }}
              >
                <Save size={16} /> {t('wallet_save_card', 'Save Card Account')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={styles.toast}>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
