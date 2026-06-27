'use client';

import { useEffect } from 'react';
import Header from '@/components/layout/Header';
import FooterNav from '@/components/layout/FooterNav';
import SlideUpMenu from '@/components/layout/SlideUpMenu';
import Sidebar from '@/components/layout/Sidebar';
import { useAuthStore } from '@/lib/store/authStore';
import { useRouter } from 'next/navigation';
import { logoutUser } from '@/lib/supabase/auth';
import { useTranslation } from '@/lib/store/languageStore';
import { Ban, Clock } from 'lucide-react';

export default function DashboardLayout({ children }) {
  const { user, loading: authLoading, setUser, setLoading } = useAuthStore();
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role === 'admin') {
        router.push('/admin');
      }
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-secondary)'
      }}>
        <span>{t('loading', 'Yüklənir...')}</span>
      </div>
    );
  }

  if (!user) return null;

  const userName = user?.fullName?.split(' ')[0] || '';
  const transferBalance = user?.transferBalance || 0;
  const referralLink = user?.referralCode ? `https://levelup.com/register?ref=${user.referralCode}` : '';

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch { /* ignore */ }
    setUser(null);
    setLoading(false);
    router.push('/login');
  };

  // Block check
  if (user?.isBlocked) {
    let blockMessage = user?.blockReason || t('kyc_rejected_desc', 'Hesabınız bloklanıb.');
    if (user?.blockedUntil) {
      const endDate = new Date(user.blockedUntil);
      const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
      if (daysLeft > 0) {
        blockMessage += ` (${daysLeft} ${t('days_left', 'gün qalıb')})`;
      }
    }

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: 40, textAlign: 'center', background: 'var(--bg-primary)',
      }}>
        <Ban size={64} color="var(--color-error)" style={{ marginBottom: 20 }} />
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>
          {t('account_blocked', 'Hesab Bloklanıb')}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 400, marginBottom: 24 }}>
          {blockMessage}
        </p>
        <button onClick={handleLogout} style={{
          padding: '10px 24px', borderRadius: 10, background: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)', color: 'var(--text-primary)',
          fontSize: 14, cursor: 'pointer',
        }}>
          {t('logout', 'Çıxış')}
        </button>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar
        userName={userName}
        transferBalance={transferBalance}
        referralLink={referralLink}
        onLogout={handleLogout}
      />
      <div className="app-content-wrapper">
        <div className="mobile-only">
          <Header userName={userName} />
        </div>
        <main className="screen">
          <div className="page-container">
            {children}
          </div>
        </main>
        <div className="mobile-only">
          <FooterNav transferBalance={transferBalance} />
          <SlideUpMenu referralLink={referralLink} onLogout={handleLogout} />
        </div>
      </div>
    </div>
  );
}
