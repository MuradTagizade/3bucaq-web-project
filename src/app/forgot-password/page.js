'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../login/login.module.css';
import Logo from '@/components/layout/Logo';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { validateEmail } from '@/lib/utils/validators';
import { resetPassword } from '@/lib/supabase/auth';

export default function ForgotPasswordPage() {
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className={styles.page}>
        <div className={styles.bgGrid} />
        <div className={styles.container}>
          <div className={styles.card} style={{ textAlign: 'center' }}>
            <CheckCircle2 size={56} color="var(--color-success)" style={{ margin: '0 auto 16px' }} />
            <h1 className={styles.title}>Email Göndərildi</h1>
            <p className={styles.subtitle}>
              Parol sıfırlama linki <strong>{email}</strong> ünvanına göndərildi.
              Emailinizi yoxlayın.
            </p>
            <Link href="/login">
              <Button variant="ghost" size="lg" fullWidth icon={<ArrowLeft size={18} />}>
                Girişə Qayıt
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.bgGrid} />
      <div className={styles.container}>
        <div className={styles.card}>
          <Link href="/" className={styles.logoLink}>
            <Logo size={48} />
          </Link>

          <h1 className={styles.title}>Parolu Unutdum</h1>
          <p className={styles.subtitle}>
            Emailinizi daxil edin, parol sıfırlama linki göndərəcəyik.
          </p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="Email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              error={error}
              icon={<Mail size={18} />}
            />

            <Button type="submit" fullWidth size="lg" loading={loading}>
              Göndər
            </Button>
          </form>

          <div className={styles.links}>
            <Link href="/login" className={styles.link}>
              <ArrowLeft size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Girişə qayıt
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
