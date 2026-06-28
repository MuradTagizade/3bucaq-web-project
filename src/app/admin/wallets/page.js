'use client';

import { useState, useEffect } from 'react';
import styles from './wallets.module.css';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { useAuthStore } from '@/lib/store/authStore';
import { useTranslation } from '@/lib/store/languageStore';
import { getSystemSetting, updateSystemSetting, addAdminLog } from '@/lib/supabase/database';
import { Coins, Save } from 'lucide-react';

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

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    async function loadWallets() {
      try {
        const [
          usdtTRC, usdtERC, usdtBEP,
          usdcTRC, usdcERC, usdcBEP
        ] = await Promise.all([
          getSystemSetting('wallet_usdt_trc20'),
          getSystemSetting('wallet_usdt_erc20'),
          getSystemSetting('wallet_usdt_bep20'),
          getSystemSetting('wallet_usdc_trc20'),
          getSystemSetting('wallet_usdc_erc20'),
          getSystemSetting('wallet_usdc_bep20'),
        ]);

        setWallets({
          wallet_usdt_trc20: usdtTRC || '',
          wallet_usdt_erc20: usdtERC || '',
          wallet_usdt_bep20: usdtBEP || '',
          wallet_usdc_trc20: usdcTRC || '',
          wallet_usdc_erc20: usdcERC || '',
          wallet_usdc_bep20: usdcBEP || '',
        });
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
            USDT Cüzdanları (Tether)
          </h3>
          <div className={styles.inputs}>
            <Input
              label="USDT TRC20 Cüzdan Ünvanı"
              placeholder="T... ilə başlayan ünvan"
              value={wallets.wallet_usdt_trc20}
              onChange={(e) => handleChange('wallet_usdt_trc20', e.target.value)}
            />
            <Input
              label="USDT ERC20 Cüzdan Ünvanı"
              placeholder="0x... ilə başlayan ünvan"
              value={wallets.wallet_usdt_erc20}
              onChange={(e) => handleChange('wallet_usdt_erc20', e.target.value)}
            />
            <Input
              label="USDT BEP20 Cüzdan Ünvanı"
              placeholder="0x... ilə başlayan ünvan"
              value={wallets.wallet_usdt_bep20}
              onChange={(e) => handleChange('wallet_usdt_bep20', e.target.value)}
            />
            <Button
              onClick={() => handleSave('usdt')}
              loading={saving}
              fullWidth
              style={{ marginTop: 8 }}
            >
              <Save size={16} /> USDT Cüzdanlarını Yadda Saxla
            </Button>
          </div>
        </div>

        {/* USDC Card */}
        <div className={styles.card}>
          <h3 className={styles.title}>
            <Coins size={18} color="var(--color-secondary)" />
            USDC Cüzdanları (USD Coin)
          </h3>
          <div className={styles.inputs}>
            <Input
              label="USDC TRC20 Cüzdan Ünvanı"
              placeholder="T... ilə başlayan ünvan"
              value={wallets.wallet_usdc_trc20}
              onChange={(e) => handleChange('wallet_usdc_trc20', e.target.value)}
            />
            <Input
              label="USDC ERC20 Cüzdan Ünvanı"
              placeholder="0x... ilə başlayan ünvan"
              value={wallets.wallet_usdc_erc20}
              onChange={(e) => handleChange('wallet_usdc_erc20', e.target.value)}
            />
            <Input
              label="USDC BEP20 Cüzdan Ünvanı"
              placeholder="0x... ilə başlayan ünvan"
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
              <Save size={16} /> USDC Cüzdanlarını Yadda Saxla
            </Button>
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
