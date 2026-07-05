'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from './verify.module.css';
import Logo from '@/components/layout/Logo';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase/config';
import { OTPInput } from '@/components/ui/be-ui-otp-input';
import LanguageToggle from '@/components/ui/LanguageToggle';
import ThemeToggle from '@/components/ui/ThemeToggle';
import NeuralBackground from '@/components/ui/flow-field-background';
import { useTranslation } from '@/lib/store/languageStore';

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const { t } = useTranslation();

  const [code, setCode] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // "Yenidən göndər" üçün 60 saniyəlik geri sayım
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSubmit = async () => {
    if (code.length !== 6) {
      setError(t('enter_6_digits', 'Enter 6-digit verification code'));
      setStatus('error');
      return;
    }

    if (!email) {
      setError(t('verify_email_not_found', 'Email address not found. Please register again.'));
      setStatus('error');
      return;
    }

    setLoading(true);
    setStatus('idle');
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup',
      });
      if (verifyErr) throw new Error(verifyErr.message);

      setStatus('success');
      setTimeout(() => {
        router.push('/dashboard');
      }, 800);
    } catch (err) {
      setError(err.message);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (completedCode) => {
    setError('');
    setStatus('idle');
    setLoading(true);
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email,
        token: completedCode,
        type: 'signup',
      });
      if (verifyErr) throw new Error(verifyErr.message);

      setStatus('success');
      setTimeout(() => {
        router.push('/dashboard');
      }, 800);
    } catch (err) {
      setError(err.message);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError(t('verify_email_missing', 'Email address not found.'));
      return;
    }
    if (cooldown > 0) return;
    setError('');
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (resendErr) throw new Error(resendErr.message);
      setCooldown(60);
      alert(t('otp_resent', 'Verification code resent successfully!'));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link href="/" className={styles.topBarLogo}>
          <Logo size={54} showText={true} />
        </Link>
        <div className={styles.topBarRight}>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
      <div className={styles.bgGlow1} />
      <div className={styles.bgGlow2} />
      <div className={styles.bgGlow3} />
      <NeuralBackground color="var(--color-primary)" />
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.logoWrap}>
            <Logo size={72} showText={false} />
          </div>

          <h1 className={styles.title}>{t('email_verification', 'Email Verification')}</h1>
          <p className={styles.subtitle}>
            {t('verify_code_sent', 'Enter the 6-digit code sent to')}{' '}
            {email ? <strong>{email}</strong> : 'Email'}
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0 16px' }}>
            <OTPInput
              length={6}
              value={code}
              status={status}
              onChange={(val) => {
                setCode(val);
                setError('');
                setStatus('idle');
              }}
              onComplete={handleComplete}
              autoFocus
            />
          </div>

          {error && <div className={styles.error} style={{ marginTop: '0', marginBottom: '16px' }}>{error}</div>}

          <Button fullWidth size="lg" onClick={handleSubmit} loading={loading} disabled={status === 'success'}>
            {t('verify_next', 'Next')}
          </Button>

          <button className={styles.resend} onClick={handleResend} disabled={!email || loading || cooldown > 0}>
            {cooldown > 0 ? `${t('resend_code', 'Resend Code')} (${cooldown}s)` : t('resend_code', 'Resend Code')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className={styles.page}>
          <div className={styles.container}>
            <div className={styles.card} style={{ textAlign: 'center', padding: '40px 0' }}>
              <span>{t('loading', 'Loading...')}</span>
            </div>
          </div>
        </div>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
