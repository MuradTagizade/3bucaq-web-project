'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../login/login.module.css';
import Logo from '@/components/layout/Logo';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import LanguageToggle from '@/components/ui/LanguageToggle';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { useTranslation } from '@/lib/store/languageStore';
import { Lock, CheckCircle2, ArrowLeft } from 'lucide-react';
import { validatePassword } from '@/lib/utils/validators';
import { supabase } from '@/lib/supabase/config';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  // Supabase, e-postadaki recovery linkindeki token'ı otomatik işleyip
  // PASSWORD_RECOVERY oturumu oluşturur; onu bekliyoruz.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const passErr = validatePassword(password);
    if (passErr) { setError(passErr); return; }
    if (password !== confirmPassword) {
      setError(t('passwords_mismatch', 'Şifrələr eyni deyil'));
      return;
    }

    setError('');
    setLoading(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw new Error(updErr.message);
      setDone(true);
      await supabase.auth.signOut();
      setTimeout(() => router.push('/login'), 2200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className={styles.page}>
        <div className={styles.topBar}>
          <LanguageToggle />
          <ThemeToggle />
        </div>
        <div className={styles.bgGrid} />
        <div className={styles.container}>
          <div className={styles.card} style={{ textAlign: 'center' }}>
            <CheckCircle2 size={56} color="var(--color-success)" style={{ margin: '0 auto 16px' }} />
            <h1 className={styles.title}>{t('password_changed_title', 'Şifrə Yeniləndi')}</h1>
            <p className={styles.subtitle}>
              {t('password_changed_desc', 'Şifrəniz uğurla dəyişdirildi. Girişə yönləndirilirsiniz...')}
            </p>
            <Link href="/login">
              <Button variant="ghost" size="lg" fullWidth icon={<ArrowLeft size={18} />}>
                {t('back_to_login', 'Girişə qayıt')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
      <div className={styles.bgGrid} />
      <div className={styles.container}>
        <div className={styles.card}>
          <Link href="/" className={styles.logoLink}>
            <Logo size={72} />
          </Link>

          <h1 className={styles.title}>{t('reset_password_title', 'Yeni Şifrə Təyin Et')}</h1>
          <p className={styles.subtitle}>
            {ready
              ? t('reset_password_desc', 'Yeni şifrənizi daxil edin.')
              : t('reset_password_wait', 'Link doğrulanır... Bu səhifəyə yalnız e-poçtdakı linkdən keçin.')}
          </p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label={t('new_password', 'Yeni Şifrə')}
              type="password"
              placeholder="Min 10 simvol..."
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              icon={<Lock size={18} />}
            />

            <Input
              label={t('confirm_password', 'Şifrənin Təsdiqi')}
              type="password"
              placeholder={t('confirm_password_placeholder', 'Şifrəni yenidən yazın')}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
              error={error}
              icon={<Lock size={18} />}
            />

            <Button type="submit" fullWidth size="lg" loading={loading}>
              {t('save', 'Yadda saxla')}
            </Button>
          </form>

          <div className={styles.links}>
            <Link href="/login" className={styles.link}>
              <ArrowLeft size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {t('back_to_login', 'Girişə qayıt')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
