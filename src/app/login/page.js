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
import { getUserByUid, getUserByLogin } from '@/lib/supabase/database';

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
    const inputVal = email.trim();

    if (!inputVal) {
      newErrors.email = t('required_field', 'Bu sahə doldurulmalıdır');
    } else if (inputVal.includes('@')) {
      const emailErr = validateEmail(inputVal);
      if (emailErr) {
        newErrors.email = emailErr;
      }
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
      let loginEmail = inputVal;
      if (!inputVal.includes('@')) {
        // Query email by username
        const profile = await getUserByLogin(inputVal);
        if (profile && profile.email) {
          loginEmail = profile.email;
        } else {
          throw new Error(t('user_not_found', 'İstifadəçi tapılmadı'));
        }
      }

      const user = await loginUser(loginEmail, password);
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
        <Link href="/" className={styles.topBarLogo}>
          <Logo size={54} showText={true} />
        </Link>
        <div className={styles.topBarRight}>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
      <div className={styles.bgGrid} />
      <div className={styles.bgGlow1} />
      <div className={styles.bgGlow2} />
      <div className={styles.bgGlow3} />
      <NeuralBackground color="var(--color-primary)" />
      <div className={styles.container}>
        <div className={styles.card}>
          <Link href="/" className={styles.logoLink}>
            <Logo size={72} />
          </Link>

          <h1 className={styles.title}>{t('welcome_back', 'Xoş gəldiniz')}</h1>
          <p className={styles.subtitle}>{t('login_subtitle', 'Hesabınıza daxil olun')}</p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label={t('email_or_username', 'Email və ya İstifadəçi adı')}
              type="text"
              placeholder={t('email_or_username_placeholder', 'email@example.com və ya istifadəçi adı')}
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
