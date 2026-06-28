'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../login/login.module.css';
import Logo from '@/components/layout/Logo';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import LanguageToggle from '@/components/ui/LanguageToggle';
import { useTranslation } from '@/lib/store/languageStore';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { validateEmail } from '@/lib/utils/validators';
import { resetPassword } from '@/lib/supabase/auth';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailErr = validateEmail(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }

    setError('');
    setLoading(true);

    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      // Look up and format localized error if the email isn't in profiles
      if (err.message.includes('sistemdə tapılmadı') || err.message.includes('not found')) {
        setError(t('email_exist_err', 'Bu email ünvanı sistemdə tapılmadı. Keçərli bir email daxil edin.'));
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className={styles.page}>
        <div className={styles.topBar}>
          <LanguageToggle />
        </div>
        <div className={styles.bgGrid} />
        <div className={styles.container}>
          <div className={styles.card} style={{ textAlign: 'center' }}>
            <CheckCircle2 size={56} color="var(--color-success)" style={{ margin: '0 auto 16px' }} />
            <h1 className={styles.title}>{t('email_sent_title', 'Email Göndərildi')}</h1>
            <p className={styles.subtitle}>
              {t('email_sent_desc', 'Parol sıfırlama linki {{email}} ünvanına göndərildi. Emailinizi yoxlayın.')
                .replace('{{email}}', email)}
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
        </div>
      </div>
      <div className={styles.bgGrid} />
      <div className={styles.container}>
        <div className={styles.card}>
          <Link href="/" className={styles.logoLink}>
            <Logo size={72} />
          </Link>

          <h1 className={styles.title}>{t('forgot_password_title', 'Parolu Unutdum')}</h1>
          <p className={styles.subtitle}>
            {t('forgot_password_desc', 'Emailinizi daxil edin, parol sıfırlama linki göndərəcəyik.')}
          </p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label={t('email', 'Email')}
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              error={error}
              icon={<Mail size={18} />}
            />

            <Button type="submit" fullWidth size="lg" loading={loading}>
              {t('submit', 'Göndər')}
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
