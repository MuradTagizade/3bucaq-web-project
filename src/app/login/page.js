'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';
import Logo from '@/components/layout/Logo';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import LanguageToggle from '@/components/ui/LanguageToggle';
import ThemeToggle from '@/components/ui/ThemeToggle';
import NeuralBackground from '@/components/ui/flow-field-background';
import { useTranslation } from '@/lib/store/languageStore';
import { Mail, Lock } from 'lucide-react';
import { validateEmail } from '@/lib/utils/validators';
import { loginUser } from '@/lib/supabase/auth';
import { getUserByUid } from '@/lib/supabase/database';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!validateEmail(email)) {
      newErrors.email = t('invalid_email', 'Düzgün email daxil edin');
    }
    if (!password) {
      newErrors.password = t('required_field', 'Bu sahə doldurulmalıdır');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const user = await loginUser(email, password);
      const dbUser = await getUserByUid(user.id);
      if (dbUser && dbUser.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setErrors({ general: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <div className={styles.bgGrid} />
      <div className={styles.bgGlow1} />
      <div className={styles.bgGlow2} />
      <div className={styles.bgGlow3} />
      <NeuralBackground color="var(--color-primary)" />
      <div className={styles.container}>
        <div className={styles.card}>
          <Link href="/" className={styles.logoLink}>
            <Logo size={48} />
          </Link>

          <h1 className={styles.title}>{t('welcome_back', 'Xoş gəldiniz')}</h1>
          <p className={styles.subtitle}>{t('login_subtitle', 'Hesabınıza daxil olun')}</p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label={t('email', 'Email')}
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              icon={<Mail size={18} />}
            />

            <Input
              label={t('password', 'Şifrə')}
              type="password"
              placeholder={t('password', 'Şifrə')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              icon={<Lock size={18} />}
            />

            {errors.general && (
              <div className={styles.errorBox}>
                <span>WRONG</span> — {errors.general}
              </div>
            )}

            <Button type="submit" fullWidth size="lg" loading={loading}>
              {t('login', 'Giriş')}
            </Button>
          </form>

          <div className={styles.links}>
            <Link href="/forgot-password" className={styles.link}>
              {t('forgot_password_btn', 'Parolu unutmuşam')}
            </Link>
            <span className={styles.divider}>•</span>
            <Link href="/register" className={styles.link}>
              {t('create_account', 'Hesab yarat')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
